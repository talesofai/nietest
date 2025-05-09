"""
任务处理服务模块

该模块负责处理图像生成任务，包括：
1. 处理单个图像生成任务
2. 监控任务进度
3. 清理过期任务
"""

from typing import Dict, Any, List, Optional, Tuple
import logging
import asyncio
import time
import os
import json
import uuid
import copy
from datetime import datetime, timezone
import random
from app.utils.timezone import get_beijing_now

from app.db.mongodb import get_database
from app.models.subtask import SubTaskStatus
from app.models.task import TaskStatus
from app.services.image import create_image_generator
from app.services.task_executor import get_task_executor, get_lumina_task_executor, submit_task, get_task_result
from app.core.config import settings
from app.crud.dramatiq_task import update_dramatiq_task_result, get_dramatiq_task
from app.crud.dramatiq_task import get_dramatiq_task, update_dramatiq_task_status, update_dramatiq_task_error
from app.crud.task import get_task
from app.crud import task as task_crud
from app.utils.feishu import feishu_notify

# 配置日志
logger = logging.getLogger(__name__)

async def prepare_dramatiq_tasks(task_id: str) -> Dict[str, Any]:
    """
    准备任务

    Args:
        task_id: 任务ID

    Returns:
        准备结果
    """
    logger.info(f"开始准备任务 {task_id} 的子任务")
    db = await get_database()

    # 获取任务
    task_data = await task_crud.get_task(db, task_id)
    if not task_data:
        logger.error(f"找不到任务 {task_id}")
        raise ValueError(f"找不到任务 {task_id}")

    # 计算变量组合
    logger.info(f"开始计算任务 {task_id} 的变量组合")
    combinations = await calculate_combinations(task_id, task_data)
    logger.info(f"任务 {task_id} 共有 {len(combinations)} 个变量组合")

    # 更新任务状态为处理中
    await task_crud.update_task_status(db, task_id, TaskStatus.PROCESSING.value)

    # 发送任务提交通知
    feishu_notify(
        event_type='task_submitted',
        task_id=task_id,
        task_name=task_data.get("task_name", "未命名任务"),
        submitter=task_data.get("username", "未知用户"),
        details={
            "变量组合数量": len(combinations),
            "预计图片数量": task_data.get("total_images", len(combinations))
        }
    )

    # 使用新的任务处理器创建和提交子任务
    # 将计算好的变量组合传递给create_and_submit_subtasks函数
    result = await create_and_submit_subtasks(task_id, combinations)

    if result.get("status") == "success":
        logger.info(f"任务 {task_id} 已成功创建子任务: {result.get('message')}")
        return result
    else:
        error_msg = result.get('error')
        logger.error(f"创建子任务失败: {error_msg}")
        await task_crud.update_task_status(db, task_id, TaskStatus.FAILED.value, error_msg)

        # 发送任务失败通知
        feishu_notify(
            event_type='task_failed',
            task_id=task_id,
            task_name=task_data.get("task_name", "未命名任务"),
            submitter=task_data.get("username", "未知用户"),
            details={
                "错误信息": error_msg,
                "失败阶段": "任务准备阶段"
            },
            message="任务在准备阶段失败，请检查任务配置"
        )

        raise ValueError(f"创建子任务失败: {error_msg}")

async def calculate_combinations(
    task_id: str,
    task_data: Dict[str, Any]
) -> List[Dict[str, Dict[str, str]]]:
    """
    计算所有变量组合

    Args:
        task_id: 任务ID
        task_data: 任务数据

    Returns:
        变量组合列表
    """
    db = await get_database()

    # 获取变量
    variables = task_data.get("variables", {})

    # 检查是否有batch标签
    batch_size = 1
    batch_tag = None
    for tag in task_data.get("tags", []):
        if tag.get("type") == "batch" and not tag.get("isVariable", False):
            try:
                batch_value = int(tag.get("value", "1"))
                if batch_value > 1:
                    batch_size = batch_value
                    batch_tag = tag
                    logger.info(f"检测到batch标签，值为: {batch_size}")
            except (ValueError, TypeError):
                logger.warning(f"无法将batch标签值 '{tag.get('value')}' 转换为整数，使用默认值1")

    # 计算组合
    import itertools

    # 准备变量值列表
    var_values = []
    var_names = []

    for var_name, var_data in sorted(variables.items()):
        if var_name.startswith('v'):
            values = var_data.get('values', [])
            if values:
                var_names.append(var_name)
                var_values.append(values)

    # 计算笛卡尔积
    base_combinations = []
    if var_values:
        logger.info(f"开始计算 {len(var_names)} 个变量的笛卡尔积")
        for values in itertools.product(*var_values):
            combination = {}
            for i, var_name in enumerate(var_names):
                # 保留变量值的完整信息，包括value等
                value_data = values[i].copy() if isinstance(values[i], dict) else {"value": values[i]}

                # 添加索引信息，用于后续查找
                if "index" not in value_data:
                    idx = -1
                    var_values_list = variables[var_name].get('values', [])
                    for j, v in enumerate(var_values_list):
                        if isinstance(v, dict) and isinstance(value_data, dict) and v.get('value') == value_data.get('value'):
                            idx = j
                            break
                    value_data["index"] = idx

                combination[var_name] = value_data
            base_combinations.append(combination)
    else:
        # 如果没有变量，返回一个空组合
        base_combinations = [{}]

    # 处理batch参数，为每个组合创建batch_size个副本
    combinations = []
    if batch_size > 1:
        logger.info(f"应用batch参数: {batch_size}，为每个组合创建{batch_size}个副本")
        for base_combo in base_combinations:
            for batch_index in range(batch_size):
                # 创建组合的副本，并添加batch索引
                combo_copy = copy.deepcopy(base_combo)
                combo_copy["_batch_index"] = {"value": str(batch_index), "index": batch_index}
                combinations.append(combo_copy)
    else:
        combinations = base_combinations

    # 记录组合数量
    total_images = len(combinations)
    logger.info(f"任务 {task_id} 的变量组合数量: {total_images}")

    # 更新任务的图片总数
    await task_crud.update_task_total_images(db, task_id, total_images)

    return combinations

async def process_image_task(task_id: str) -> Dict[str, Any]:
    """
    处理图像生成任务

    Args:
        task_id: 任务ID（UUID）

    Returns:
        处理结果
    """
    start_time = time.time()

    db = await get_database()

    task_data = await get_dramatiq_task(db, task_id)

    if not task_data:
        logger.error(f"找不到任务 {task_id}")
        raise ValueError(f"找不到任务 {task_id}")

    # 获取当前重试次数
    retry_count = task_data.get("retry_count", 0)
    max_timeout_retries = 5  # 超时错误最大重试次数
    max_other_retries = 2    # 其他错误最大重试次数

    variable_indices = task_data.get("variable_indices", [])
    logger.debug(f"任务 {task_id} 的变量索引数组: {variable_indices}, 当前重试次数: {retry_count}, 超时最大重试: {max_timeout_retries}, 其他错误最大重试: {max_other_retries}")

    # 更新任务状态为处理中
    await update_dramatiq_task_status(db, task_id, SubTaskStatus.PROCESSING.value)

    # 提取任务参数
    prompts = task_data.get("prompts", [])
    ratio = task_data.get("ratio", "1:1")
    seed = task_data.get("seed")
    use_polish = task_data.get("use_polish", False)

    # 检查是否是Lumina任务
    is_lumina_task = False
    for prompt in prompts:
        if prompt.get("name", "").lower().find("lumina") >= 0:
            is_lumina_task = True
            logger.info(f"检测到Lumina任务: {task_id}")
            break

    # 详细记录每个prompt的信息，特别是角色和元素类型
    logger.debug(f"任务 {task_id} 的prompts详细信息:")
    for i, prompt in enumerate(prompts):
        prompt_type = prompt.get("type")
        prompt_value = prompt.get("value", "")
        prompt_name = prompt.get("name", "")

        if prompt_type == "freetext":
            logger.debug(f"Prompt #{i+1}: 类型={prompt_type}, 值={prompt_value}")
        elif prompt_type in ["oc_vtoken_adaptor", "elementum"]:
            prompt_uuid = prompt.get("uuid", "")
            prompt_img_url = prompt.get("img_url", "")
            logger.debug(f"Prompt #{i+1}: 类型={prompt_type}, 名称={prompt_name}, UUID={prompt_uuid}, 图片URL={prompt_img_url}")
        else:
            logger.debug(f"Prompt #{i+1}: 类型={prompt_type}, 值={prompt_value if prompt_type=='freetext' else prompt_name}")

    try:
        image_generator = create_image_generator()
        width, height = await image_generator.calculate_dimensions(ratio)
        current_time = time.time()
        elapsed_time = current_time - start_time

        logger.debug(f"开始生成图像: {task_id}, 宽度={width}, 高度={height}, 种子={seed}, 使用文本润色={use_polish}。\n完整提示词内容: {json.dumps(prompts, ensure_ascii=False)}")

        # 设置超时时间
        timeout = 300  # 5分钟超时

        # 使用asyncio.wait_for设置超时
        try:
            # 发送图像生成请求
            result = await asyncio.wait_for(
                image_generator.generate_image(
                    prompts=prompts,
                    width=width,
                    height=height,
                    seed=seed,
                    advanced_translator=use_polish
                ),
                timeout=timeout
            )

            # 记录当前耗时
            current_time = time.time()
            elapsed_time = current_time - start_time
            logger.debug(f"提取图像URL前耗时: {elapsed_time:.2f} 秒, 任务ID: {task_id}")

            # 检查任务状态是否为ILLEGAL_IMAGE、FAILURE或TIMEOUT
            if isinstance(result, dict):
                task_status = result.get("task_status")
                if task_status == "ILLEGAL_IMAGE":
                    raise ValueError("图像生成API返回ILLEGAL_IMAGE状态，内容不合规")
                elif task_status == "FAILURE":
                    raise ValueError("图像生成API返回FAILURE状态，生成失败")
                elif task_status == "TIMEOUT":
                    # 触发超时错误的重试逻辑
                    raise asyncio.TimeoutError("图像生成API返回TIMEOUT状态，任务超时")

            # 提取图像URL
            image_url = await image_generator.extract_image_url(result)

            # 检查图像URL是否有效
            if not image_url:
                raise ValueError("无法获取有效的图像URL")

            # 创建结果项
            result_item = {
                "url": image_url,
                "width": width,
                "height": height,
                "seed": seed,
                "created_at": get_beijing_now().isoformat()
            }

            # 记录当前耗时
            current_time = time.time()
            elapsed_time = current_time - start_time
            await update_dramatiq_task_result(db, task_id, SubTaskStatus.COMPLETED.value, result_item)

            # 记录总耗时
            total_time = time.time() - start_time
            logger.debug(f"任务处理完成，总耗时: {total_time:.2f} 秒, 任务ID: {task_id}")

            return {
                "status": "completed",
                "result": result_item
            }

        except asyncio.TimeoutError:
            # 处理超时情况
            elapsed_time = time.time() - start_time
            error_msg = f"图像生成超时，已耗时: {elapsed_time:.2f}秒"
            logger.error(f"任务 {task_id} {error_msg}")

            # 检查是否达到超时错误最大重试次数
            if retry_count >= max_timeout_retries - 1:  # -1是因为当前这次也算一次
                # 已达到最大重试次数，标记为失败
                logger.warning(f"任务 {task_id} 已达到超时最大重试次数 ({max_timeout_retries})，标记为最终失败")
                await update_dramatiq_task_error(db, task_id, SubTaskStatus.FAILED.value, f"已重试 {max_timeout_retries} 次后仍然超时: {error_msg}")

                # 更新父任务进度，确保失败的任务也被计入进度
                parent_task_id = task_data.get("parent_task_id")
                if parent_task_id:
                    await task_crud.update_task_progress(db, parent_task_id)
                    logger.info(f"已更新父任务 {parent_task_id} 的进度")

                raise ValueError(f"图像生成失败: {error_msg}")
            else:
                # 未达到最大重试次数，增加重试计数并立即重新提交任务
                logger.info(f"任务 {task_id} 超时，将立即进行第 {retry_count + 1} 次重试")
                await update_dramatiq_task_error(db, task_id, SubTaskStatus.PROCESSING.value, f"第 {retry_count} 次尝试超时，准备重试: {error_msg}")

                # 立即重新提交任务，不等待时间
                from app.services.task_executor import submit_task

                # 检查是否是Lumina任务
                is_lumina_task = False
                for prompt in prompts:
                    if prompt.get("name", "").lower().find("lumina") >= 0:
                        is_lumina_task = True
                        break

                # 重新提交任务
                await submit_task(process_image_task(task_id), task_id, is_lumina=is_lumina_task)
                logger.info(f"已立即重新提交任务 {task_id} 进行第 {retry_count + 1} 次重试")

                # 返回一个特殊的结果，表示任务已重新提交
                return {
                    "status": "retrying",
                    "message": f"任务已重新提交进行第 {retry_count + 1} 次重试"
                }

    except Exception as e:
        # 处理其他异常
        elapsed_time = time.time() - start_time
        error_msg = f"图像生成失败: {str(e)}"
        logger.error(f"任务 {task_id} {error_msg}, 已耗时: {elapsed_time:.2f}秒")

        # 获取详细的异常信息
        import traceback
        error_details = traceback.format_exc()
        logger.error(f"任务 {task_id} 异常堆栈:\n{error_details}")

        # 检查是否是451错误（法律原因不可用）或ILLEGAL_IMAGE状态
        if "451 Unavailable For Legal Reasons" in str(e) or "451 Unavailable For Legal Reasons" in error_details or "ILLEGAL_IMAGE" in str(e) or "ILLEGAL_IMAGE" in error_details or "图像生成API返回ILLEGAL_IMAGE状态" in str(e):
            # 451错误或ILLEGAL_IMAGE状态不进行重试，直接标记为失败
            if "ILLEGAL_IMAGE" in str(e) or "ILLEGAL_IMAGE" in error_details:
                logger.warning(f"任务 {task_id} 返回ILLEGAL_IMAGE状态，不进行重试，直接标记为失败")
                await update_dramatiq_task_error(db, task_id, SubTaskStatus.FAILED.value, f"返回ILLEGAL_IMAGE状态，不进行重试: {error_msg}\n\n{error_details}")
            else:
                logger.warning(f"任务 {task_id} 返回451错误（法律原因不可用），不进行重试，直接标记为失败")
                await update_dramatiq_task_error(db, task_id, SubTaskStatus.FAILED.value, f"返回451错误（法律原因不可用），不进行重试: {error_msg}\n\n{error_details}")

            # 更新父任务进度
            parent_task_id = task_data.get("parent_task_id")
            if parent_task_id:
                await task_crud.update_task_progress(db, parent_task_id)
                logger.info(f"已更新父任务 {parent_task_id} 的进度")

            # 返回一个特殊的结果，表示任务已失败但不需要重试
            return {
                "status": "failed",
                "error": f"图像生成失败: {error_msg}",
                "reason": "451_or_illegal_image",
                "message": "内容不合规，不进行重试"
            }
        # 检查是否达到其他错误最大重试次数
        elif retry_count >= max_other_retries - 1:  # -1是因为当前这次也算一次
            # 已达到最大重试次数，标记为失败
            logger.warning(f"任务 {task_id} 已达到其他错误最大重试次数 ({max_other_retries})，标记为最终失败")
            await update_dramatiq_task_error(db, task_id, SubTaskStatus.FAILED.value, f"已重试 {max_other_retries} 次后失败: {error_msg}\n\n{error_details}")

            # 更新父任务进度，确保失败的任务也被计入进度
            parent_task_id = task_data.get("parent_task_id")
            if parent_task_id:
                await task_crud.update_task_progress(db, parent_task_id)
                logger.info(f"已更新父任务 {parent_task_id} 的进度")

            raise ValueError(f"图像生成失败: {error_msg}")
        else:
            # 未达到最大重试次数，增加重试计数并等待3秒后重新提交任务
            logger.info(f"任务 {task_id} 失败，将在3秒后进行第 {retry_count + 1} 次重试")
            await update_dramatiq_task_error(db, task_id, SubTaskStatus.PROCESSING.value, f"第 {retry_count} 次尝试失败，准备重试: {error_msg}")

            # 等待3秒后重新提交任务
            from app.services.task_executor import submit_task

            # 等待3秒
            await asyncio.sleep(3)
            logger.info(f"等待3秒后开始重试任务 {task_id}")

            # 检查是否是Lumina任务
            is_lumina_task = False
            for prompt in prompts:
                if prompt.get("name", "").lower().find("lumina") >= 0:
                    is_lumina_task = True
                    break

            # 重新提交任务
            await submit_task(process_image_task(task_id), task_id, is_lumina=is_lumina_task)
            logger.info(f"已重新提交任务 {task_id} 进行第 {retry_count + 1} 次重试")

            # 返回一个特殊的结果，表示任务已重新提交
            return {
                "status": "retrying",
                "message": f"任务已重新提交进行第 {retry_count + 1} 次重试"
            }

def format_prompt_for_api(prompt_data: Any, prompt_type: str) -> Dict[str, Any]:
    """
    将提示词、角色或元素数据转换为标准API格式

    Args:
        prompt_data: 提示词、角色或元素数据
        prompt_type: 指定类型，可以是'prompt'/'character'/'element'

    Returns:
        标准格式的提示词数据
    """
    # 记录输入参数
    logger.debug(f"格式化提示词输入: prompt_type={prompt_type}, prompt_data={json.dumps(prompt_data) if isinstance(prompt_data, (dict, list)) else prompt_data}")

    # 确保prompt_type符合要求
    if prompt_type not in [None, "prompt", "character", "element"]:
        raise ValueError("prompt_type必须是'prompt'/'character'/'element'中的一个")

    # 初始化结果字典
    result = {}

    # 如果是字符串，则创建一个freetext类型的提示词
    if isinstance(prompt_data, str):
        result = {
            "type": "freetext",
            "weight": 1,
            "value": prompt_data
        }
        logger.debug(f"字符串提示词格式化结果: {json.dumps(result)}")
        return result

    # 如果不是字典，报错
    if not isinstance(prompt_data, dict):
        raise TypeError(f"提示词数据必须是字符串或字典，当前类型: {type(prompt_data)}")

    # 如果是提示词类型，使用freetext类型
    if prompt_type == "prompt":
        result = {
            "type": "freetext",
            "weight": prompt_data.get("weight", 1),
            "value": prompt_data.get("value", "")
        }
        logger.debug(f"提示词格式化结果: {json.dumps(result)}")
        return result

    if not (prompt_type == "character" or prompt_type == "element"):
        raise ValueError(f"prompt_type必须是'prompt', 'character'或'element', 当前类型: {prompt_type}")

    # 如果是角色或元素类型
    # 首先检查是否有必要的字段
    if "uuid" not in prompt_data:
        # 如果有value字段，使用它作为uuid
        if "value" in prompt_data:
            prompt_data["uuid"] = prompt_data["value"]
            logger.debug(f"从 value 字段复制 uuid: {prompt_data['value']}")
        else:
            error_msg = f"提示词数据缺少uuid字段: {json.dumps(prompt_data)}"
            logger.error(error_msg)
            raise KeyError(error_msg)

    if "name" not in prompt_data:
        logger.warning(f"提示词数据缺少name字段: {json.dumps(prompt_data)}")
        # 如果没有name字段，使用uuid作为name
        prompt_data["name"] = prompt_data.get("uuid", "")
        logger.debug(f"使用 uuid 作为 name: {prompt_data['name']}")

    # 根据prompt_type或prompt_data["type"]决定类型
    is_character = False
    if prompt_type == "character":
        is_character = True
        logger.debug(f"根据 prompt_type 确定为角色类型")
    elif "type" in prompt_data and prompt_data["type"] == "character":
        is_character = True
        logger.debug(f"根据 prompt_data['type'] 确定为角色类型")

    # 构建结果字典
    result["type"] = "oc_vtoken_adaptor" if is_character else "elementum"
    result["uuid"] = prompt_data["uuid"]
    result["value"] = prompt_data["uuid"]  # value与uuid相同
    result["name"] = prompt_data["name"]
    result["weight"] = prompt_data.get("weight", 1)

    # 先检查header_img，再检查header_url
    if "header_img" in prompt_data:
        result["img_url"] = prompt_data["header_img"]
        logger.debug(f"使用header_img作为img_url: {prompt_data['header_img']}")
    elif "header_url" in prompt_data:
        result["img_url"] = prompt_data["header_url"]
        logger.debug(f"使用header_url作为img_url: {prompt_data['header_url']}")
    else:
        result["img_url"] = ""
        logger.debug("未找到header_img或header_url，使用空字符串作为img_url")

    result["domain"] = ""
    result["parent"] = ""
    result["label"] = None
    result["sort_index"] = 0
    result["status"] = "IN_USE"
    result["polymorphi_values"] = {}
    result["sub_type"] = None

    logger.debug(f"角色/元素格式化结果: {json.dumps(result)}")
    return result

async def create_and_submit_subtasks(parent_task_id: str, combinations: List[Dict[str, Dict[str, Any]]]) -> Dict[str, Any]:
    """
    创建并提交子任务

    Args:
        parent_task_id: 父任务ID
        combinations: 预先计算好的变量组合，如果为None则重新计算

    Returns:
        创建结果
    """
    try:
        db = await get_database()

        # 获取任务信息
        task_data = await get_task(db, parent_task_id)

        if not task_data:
            raise ValueError(f"找不到任务 {parent_task_id}")

        # 创建标签ID到标签类型的映射 - 简化为直接使用tag的type属性
        tag_id_to_type = {}

        # 记录变量的类型
        variables_info = {}

        # 创建变量类型映射，用于记录到子任务中
        variable_types_map = {}
        type_to_variable = {}

        logger.debug(f"task_data: {task_data}")

        # 遍历所有标签，提取标签类型
        for tag in task_data.get("tags", []):
            tag_id = tag.get("id")
            tag_type = tag.get("type")
            is_variable = tag.get("isVariable", False)  # 修正字段名称为isVariable

            if tag_id and tag_type:
                tag_id_to_type[tag_id] = tag_type
                logger.debug(f"标签 {tag_id} 的类型为 {tag_type}, is_variable={is_variable}")

                # 如果是变量标签，记录变量信息
                if is_variable:
                    # 查找与该标签关联的变量
                    for var_name, var_data in task_data.get("variables", {}).items():
                        if var_data.get("tag_id") == tag_id:
                            variables_info[var_name] = {
                                "tag_id": tag_id,
                                "type": tag_type,
                                "name": var_data.get("name", ""),
                                "values_count": len(var_data.get("values", []))
                            }
                            # 记录变量类型映射
                            variable_types_map[var_name] = tag_type
                            if tag_type not in type_to_variable:
                                type_to_variable[tag_type] = var_name
                            logger.debug(f"变量 {var_name} 的标签ID={tag_id}, 类型={tag_type}, 名称='{var_data.get('name', '')}', 值数量={len(var_data.get('values', []))}")
                            break

        logger.debug(f"variables_info: {variables_info}")

        # 获取子任务创建函数
        from app.crud.dramatiq_task import create_dramatiq_task, get_dramatiq_task_by_variables

        # 创建子任务并提交到执行器
        subtask_ids = []
        for i, combination in enumerate(combinations):
            # 一次性处理所有参数和索引
            subtask_data = await prepare_subtask_data(task_data, combination, tag_id_to_type, i)

            # 确保变量类型映射字段存在
            if "variable_types_map" not in subtask_data:
                subtask_data["variable_types_map"] = variable_types_map
            if "type_to_variable" not in subtask_data:
                subtask_data["type_to_variable"] = type_to_variable

            # 检查是否已存在相同的子任务
            existing_task = await get_dramatiq_task_by_variables(db, parent_task_id, subtask_data["variable_indices"])

            if existing_task:
                logger.debug(f"已存在相同的子任务: {existing_task['id']}, 跳过创建")
                subtask_ids.append(existing_task['id'])
                continue

            # 记录子任务的prompts详细信息
            prompts = subtask_data.get("prompts", [])
            logger.debug(f"子任务 {subtask_data['id']} 的prompts详细信息:")
            for i, prompt in enumerate(prompts):
                prompt_type = prompt.get("type")
                if prompt_type == "freetext":
                    logger.debug(f"Prompt #{i+1}: 类型={prompt_type}, 值={prompt.get('value', '')}")
                elif prompt_type in ["oc_vtoken_adaptor", "elementum"]:
                    logger.debug(f"Prompt #{i+1}: 类型={prompt_type}, 名称={prompt.get('name', '')}, UUID={prompt.get('uuid', '')}, 图片URL={prompt.get('img_url', '')}")
                else:
                    logger.debug(f"Prompt #{i+1}: 类型={prompt_type}, 值={prompt.get('value', '')}")

            # 直接保存到数据库并提交任务
            await create_dramatiq_task(db, subtask_data)

            # 检查是否是Lumina任务
            is_lumina_task = False
            for prompt in subtask_data.get("prompts", []):
                if prompt.get("name", "").lower().find("lumina") >= 0:
                    is_lumina_task = True
                    logger.info(f"检测到Lumina子任务: {subtask_data['id']}")
                    break

            # 根据任务类型选择不同的执行器
            from app.services.task_executor import submit_task, get_lumina_task_executor
            await submit_task(process_image_task(subtask_data["id"]), subtask_data["id"], is_lumina=is_lumina_task)

            subtask_ids.append(subtask_data["id"])
            logger.debug(f"创建并提交子任务: {subtask_data['id']}, 父任务: {parent_task_id}")

        return {
            "status": "success",
            "message": f"已创建并提交 {len(subtask_ids)} 个子任务",
            "subtask_ids": subtask_ids
        }
    except Exception as e:
        logger.error(f"创建子任务时出错: {str(e)}")
        return {
            "status": "failed",
            "error": str(e)
        }

async def prepare_subtask_data(
    task_data: Dict[str, Any],
    combination: Dict[str, Dict[str, Any]],
    tag_id_to_type: Dict[str, str],
    combination_index: int
) -> Dict[str, Any]:
    """
    准备子任务数据，整合参数提取和子任务数据构建

    Args:
        task_data: 父任务数据
        combination: 当前变量组合
        tag_id_to_type: 标签ID到类型的映射
        combination_index: 组合索引，用于日志记录

    Returns:
        完整的子任务数据
    """
    # 初始化参数
    all_prompts = []  # 所有提示词、角色和元素的有序列表
    ratio = "1:1"  # 默认比例
    seed = random.randint(1, 2147483647)  # 默认随机种子
    use_polish = False  # 默认不使用润色

    # 记录组合内容用于调试
    logger.debug(f"准备处理组合 {combination_index+1}: {json.dumps(combination, ensure_ascii=False)}")

    # 创建变量类型映射，用于记录到子任务中
    variable_types_map = {}
    type_to_variable = {}

    # 处理所有标签，按照原始顺序
    for tag in task_data.get("tags", []):
        tag_type = tag.get("type")
        tag_id = tag.get("id")
        is_variable = tag.get("isVariable", False)  # 修正字段名称为isVariable

        logger.debug(f"处理标签: type={tag_type}, id={tag_id}, is_variable={is_variable}")

        # 如果是变量标签，从变量映射中获取值
        if is_variable:
            # 找到与此标签关联的变量
            var_data = None
            var_name = None
            var_value = None

            # 查找与标签关联的变量
            variables = task_data.get("variables", {})
            tag_name = tag.get("name", "")
            logger.debug(f"查找变量标签 {tag_id}(类型:{tag_type}) 的关联变量，标签名称: {tag_name}")

            # 如果标签没有name字段，直接报错
            if not tag_name:
                logger.error(f"变量标签 {tag_id}(类型:{tag_type}) 没有name字段，无法匹配变量")
                raise ValueError(f"变量标签 {tag_id}(类型:{tag_type}) 没有name字段，无法匹配变量")

            found_variable = False
            for v_name, v_data in variables.items():
                var_name_in_data = v_data.get("name", "")

                # 当标签是变量时，通过name字段匹配变量
                if var_name_in_data and tag_name == var_name_in_data:
                    found_variable = True
                    # 找到关联变量，记录变量类型映射
                    variable_types_map[v_name] = tag_type
                    if tag_type not in type_to_variable:
                        type_to_variable[tag_type] = v_name

                    # 从组合中获取该变量的值
                    if v_name in combination:
                        var_name = v_name
                        var_data = combination[v_name]
                        var_value = var_data.get("value")
                        logger.debug(f"找到变量标签 {tag_id}(名称:{tag_name}) 关联的变量: {var_name}, 值: {var_value}")
                        break

            # 如果没有找到匹配的变量，报错
            if not found_variable:
                logger.error(f"未找到与标签名称 '{tag_name}' 匹配的变量，请检查变量配置")
                raise ValueError(f"未找到与标签名称 '{tag_name}' 匹配的变量，请检查变量配置")

            # 如果没有找到变量值，跳过
            if var_value is None:
                logger.warning(f"未找到变量标签 {tag_id}(类型:{tag_type}) 的值，跳过处理此标签")
                continue

            # 获取变量值的完整信息
            var_value_info = None
            var_values_list = variables.get(var_name, {}).get('values', [])
            var_index = var_data.get('index', -1)

            if var_index >= 0 and var_index < len(var_values_list):
                var_value_info = var_values_list[var_index]
                logger.debug(f"找到变量值的完整信息: {json.dumps(var_value_info, ensure_ascii=False)}")
            else:
                logger.warning(f"无法找到变量值的完整信息，索引 {var_index} 超出范围")

            # 根据标签类型处理变量值
            if tag_type == "prompt":
                logger.debug(f"应用prompt变量: {var_value}")
                all_prompts.append({
                    "type": "freetext",
                    "weight": var_data.get("weight", 1.0),
                    "value": var_value
                })
            elif tag_type == "character":
                # 获取角色的UUID和图片URL
                uuid_value = ""
                header_img = ""

                # 优先从变量值信息中获取
                if var_value_info and isinstance(var_value_info, dict):
                    uuid_value = var_value_info.get("uuid", "")
                    header_img = var_value_info.get("header_img", "")
                    logger.debug(f"从变量值信息中获取角色UUID: {uuid_value}, 图片: {header_img}")

                # 如果变量值信息中没有，尝试从组合中获取
                if not uuid_value and var_data and isinstance(var_data, dict):
                    uuid_value = var_data.get("uuid", "")
                    header_img = var_data.get("header_img", "")
                    logger.debug(f"从组合中获取角色UUID: {uuid_value}, 图片: {header_img}")

                logger.debug(f"应用character变量: {var_value}, uuid={uuid_value}, header_img={header_img}")
                all_prompts.append({
                    "type": "oc_vtoken_adaptor",
                    "uuid": uuid_value,
                    "value": uuid_value,  # value与uuid相同
                    "name": var_value,
                    "weight": var_data.get("weight", 1.0),
                    "img_url": header_img,
                    "domain": "",
                    "parent": "",
                    "label": None,
                    "sort_index": 0,
                    "status": "IN_USE",
                    "polymorphi_values": {},
                    "sub_type": None
                })
            elif tag_type == "element":
                # 获取元素的UUID和图片URL
                uuid_value = ""
                header_img = ""

                # 优先从变量值信息中获取
                if var_value_info and isinstance(var_value_info, dict):
                    uuid_value = var_value_info.get("uuid", "")
                    header_img = var_value_info.get("header_img", "")
                    logger.debug(f"从变量值信息中获取元素UUID: {uuid_value}, 图片: {header_img}")

                # 如果变量值信息中没有，尝试从组合中获取
                if not uuid_value and var_data and isinstance(var_data, dict):
                    uuid_value = var_data.get("uuid", "")
                    header_img = var_data.get("header_img", "")
                    logger.debug(f"从组合中获取元素UUID: {uuid_value}, 图片: {header_img}")

                logger.debug(f"应用element变量: {var_value}, uuid={uuid_value}, header_img={header_img}")
                all_prompts.append({
                    "type": "elementum",
                    "uuid": uuid_value,
                    "value": uuid_value,  # value与uuid相同
                    "name": var_value,
                    "weight": var_data.get("weight", 1.0),
                    "img_url": header_img,
                    "domain": "",
                    "parent": "",
                    "label": None,
                    "sort_index": 0,
                    "status": "IN_USE",
                    "polymorphi_values": {},
                    "sub_type": None
                })
            elif tag_type == "ratio":
                logger.debug(f"应用ratio变量: {var_value}")
                # 确保比例格式正确
                if ":" in var_value:
                    ratio = var_value
                    logger.debug(f"设置ratio={ratio}")
                else:
                    logger.warning(f"比例变量值格式不正确: {var_value}，使用默认值1:1")
                    ratio = "1:1"
            elif tag_type == "seed":
                try:
                    logger.debug(f"应用seed变量: {var_value}")
                    seed = int(var_value)
                except (ValueError, TypeError):
                    logger.error(f"无法将seed变量值 '{var_value}' 转换为整数")
                    pass
            elif tag_type == "polish":
                logger.debug(f"应用polish变量: {var_value}")
                # 明确将"true"和"false"字符串转为布尔值
                if isinstance(var_value, str):
                    use_polish = var_value.lower() == "true"
                else:
                    use_polish = bool(var_value)
                logger.debug(f"设置use_polish={use_polish}, 原始值={var_value}")
            elif tag_type == "batch":
                # batch是特殊类型，记录但不做特殊处理
                logger.debug(f"应用batch变量: {var_value}, 不做特殊处理")
        else:
            # 处理非变量标签
            tag_value = tag.get("value", "")
            logger.debug(f"处理非变量标签: type={tag_type}, value={tag_value}")

            if tag_type == "prompt":
                if tag_value:
                    logger.debug(f"应用非变量prompt: {tag_value}")
                    all_prompts.append({
                        "type": "freetext",
                        "weight": tag.get("weight", 1.0),
                        "value": tag_value
                    })
            elif tag_type == "character":
                # 获取角色的UUID和图片URL
                uuid_value = tag.get("uuid", "")
                header_img = tag.get("header_img", "")
                name_value = tag.get("value", "")

                logger.debug(f"应用非变量character: {name_value}, uuid={uuid_value}, header_img={header_img}")
                all_prompts.append({
                    "type": "oc_vtoken_adaptor",
                    "uuid": uuid_value,
                    "value": uuid_value,  # value与uuid相同
                    "name": name_value,
                    "weight": tag.get("weight", 1.0),
                    "img_url": header_img,
                    "domain": "",
                    "parent": "",
                    "label": None,
                    "sort_index": 0,
                    "status": "IN_USE",
                    "polymorphi_values": {},
                    "sub_type": None
                })
            elif tag_type == "element":
                # 获取元素的UUID和图片URL
                uuid_value = tag.get("uuid", "")
                header_img = tag.get("header_img", "")
                name_value = tag.get("value", "")

                logger.debug(f"应用非变量element: {name_value}, uuid={uuid_value}, header_img={header_img}")
                all_prompts.append({
                    "type": "elementum",
                    "uuid": uuid_value,
                    "value": uuid_value,  # value与uuid相同
                    "name": name_value,
                    "weight": tag.get("weight", 1.0),
                    "img_url": header_img,
                    "domain": "",
                    "parent": "",
                    "label": None,
                    "sort_index": 0,
                    "status": "IN_USE",
                    "polymorphi_values": {},
                    "sub_type": None
                })
            elif tag_type == "ratio":
                logger.debug(f"应用非变量ratio: {tag_value}")
                # 确保比例格式正确
                if ":" in tag_value:
                    ratio = tag_value
                    logger.debug(f"设置非变量ratio={ratio}")
                else:
                    logger.warning(f"非变量比例值格式不正确: {tag_value}，使用默认值1:1")
                    ratio = "1:1"
            elif tag_type == "seed":
                try:
                    if tag_value:
                        logger.debug(f"应用非变量seed: {tag_value}")
                        seed = int(tag_value)
                except (ValueError, TypeError):
                    logger.error(f"无法将seed值 '{tag_value}' 转换为整数")
                    pass
            elif tag_type == "polish":
                logger.debug(f"应用非变量polish: {tag_value}")
                # 使用相同的处理逻辑确保一致性
                if isinstance(tag_value, str):
                    use_polish = tag_value.lower() == "true"
                else:
                    use_polish = bool(tag_value)
                logger.debug(f"非变量标签设置use_polish={use_polish}, 原始值={tag_value}")
            elif tag_type == "batch":
                # batch是特殊类型，记录但不做特殊处理
                logger.debug(f"检测到batch标签，值为: {tag_value}")

    # 如果没有任何提示词，添加一个空占位符
    if not all_prompts:
        logger.warning("没有任何提示词，添加1girl")
        all_prompts = [{"type": "freetext", "weight": 1, "value": "1girl"}]

    # 计算变量索引 - 既可以基于变量类型工作，也兼容传统的v0,v1位置索引
    variable_indices = calculate_variable_indices(task_data.get("variables", {}), combination)
    logger.debug(f"计算出的变量索引数组: {variable_indices}")

    # 记录变量类型映射
    logger.debug(f"构建的变量类型映射: {json.dumps(variable_types_map, ensure_ascii=False)}")
    logger.debug(f"构建的类型到变量映射: {json.dumps(type_to_variable, ensure_ascii=False)}")

    # 创建子任务记录
    subtask_id = str(uuid.uuid4())
    subtask_data = {
        "id": subtask_id,
        "parent_task_id": task_data.get("id"),
        "status": SubTaskStatus.PENDING.value,
        "prompts": all_prompts,  # 所有提示词、角色和元素的有序列表
        "ratio": ratio,
        "seed": seed,
        "use_polish": use_polish,
        "variable_indices": variable_indices,
        "variable_types_map": variable_types_map,  # 添加变量类型映射
        "type_to_variable": type_to_variable,      # 添加类型到变量的映射
        "created_at": datetime.now(timezone.utc),
        "updated_at": datetime.now(timezone.utc)
    }

    # 记录子任务基本信息
    logger.debug(f"子任务 {combination_index+1} 数据准备完成: id={subtask_id}, prompts数量={len(all_prompts)}, ratio={ratio}, seed={seed}, use_polish={use_polish}")

    # 检查prompts中是否有空的UUID或name
    for i, prompt in enumerate(all_prompts):
        prompt_type = prompt.get("type")
        if prompt_type in ["oc_vtoken_adaptor", "elementum"]:
            uuid_value = prompt.get("uuid", "")
            name_value = prompt.get("name", "")
            img_url = prompt.get("img_url", "")
            if not uuid_value or not name_value:
                logger.warning(f"子任务 {subtask_id} 的prompt #{i+1} 存在空的UUID或name: type={prompt_type}, uuid={uuid_value}, name={name_value}, img_url={img_url}")

    # 记录更详细的变量信息
    vars_info = []
    for var_name, var_type in variable_types_map.items():
        if var_name in combination:
            var_value = combination[var_name].get("value")
            vars_info.append(f"{var_type}({var_name})={var_value}")

    if vars_info:
        logger.debug(f"子任务 {subtask_id} 的变量值: {', '.join(vars_info)}")

    # 记录详细的prompts内容
    logger.debug(f"子任务 {subtask_id} 详细prompts内容: {json.dumps(all_prompts, ensure_ascii=False)}")

    return subtask_data

def calculate_variable_indices(variables: Dict[str, Any], combination: Dict[str, Dict[str, Any]]) -> List[Optional[int]]:
    """
    计算变量索引数组，既可以基于变量类型工作，也兼容传统的v0,v1位置索引

    Args:
        variables: 任务变量定义
        combination: 当前变量组合

    Returns:
        变量索引数组，保持与v0,v1索引位置兼容
    """
    # 初始化所有变量索引为None
    variable_indices = [None] * 6

    try:
        # 第一步：处理位置索引变量（v0, v1等）
        for var_name, var_data in variables.items():
            if var_name.startswith('v') and var_data.get('values'):
                try:
                    var_index = int(var_name[1:])  # 从v0, v1等提取索引
                    if var_index < 0 or var_index >= 6:
                        continue

                    var_values = var_data.get('values', [])

                    # 获取当前组合中该变量的值
                    if var_name in combination and isinstance(combination[var_name], dict):
                        combo_var_value = combination[var_name].get('value')

                        # 在变量值列表中查找匹配的索引
                        for idx, val in enumerate(var_values):
                            if isinstance(val, dict) and val.get('value') == combo_var_value:
                                variable_indices[var_index] = idx
                                break
                except (ValueError, IndexError):
                    logger.warning(f"无法解析变量名 {var_name} 或访问值列表")
                    continue
        # 处理batch索引，如果存在
        if "_batch_index" in combination and isinstance(combination["_batch_index"], dict):
            batch_index = combination["_batch_index"].get("index", 0)
            # 将batch索引存储在变量索引数组的最后一个位置（v5）
            # 如果v5已经被使用，则不覆盖它
            if variable_indices[5] is None:
                variable_indices[5] = batch_index
                logger.debug(f"将batch索引 {batch_index} 存储在v5位置")
            else:
                logger.warning(f"v5已被使用，无法存储batch索引 {batch_index}")
    except Exception as e:
        logger.warning(f"计算变量索引时发生错误: {str(e)}")

    return variable_indices

async def monitor_task_progress(task_id: str) -> Dict[str, Any]:
    """
    监控任务进度

    Args:
        task_id: 任务ID

    Returns:
        监控结果
    """
    # 获取数据库连接
    db = await get_database()

    # 获取任务信息
    from app.crud.task import get_task, update_task_status, update_subtasks_completion
    task_data = await get_task(db, task_id)

    if not task_data:
        raise ValueError(f"找不到任务 {task_id}")

    # 获取子任务
    from app.crud.dramatiq_task import get_dramatiq_tasks_by_parent_id
    logger.debug(f"开始获取子任务: {task_id}")
    sub_tasks = await get_dramatiq_tasks_by_parent_id(db, task_id)
    logger.debug(f"子任务获取结果: 找到 {len(sub_tasks)} 个子任务, 任务ID: {task_id}")

    # 监控子任务执行
    logger.debug(f"开始监控子任务执行: {task_id}")
    monitoring_start_time = time.time()
    monitoring_iteration = 0

    while True:
        monitoring_iteration += 1
        elapsed_time = time.time() - monitoring_start_time
        logger.debug(f"监控循环第 {monitoring_iteration} 次迭代, 已耗时: {elapsed_time:.2f}秒, 任务ID: {task_id}")

        # 获取最新的任务状态
        logger.debug(f"获取最新的任务状态: {task_id}")
        task_data = await get_task(db, task_id)

        # 如果任务已取消，停止执行
        from app.models.task import TaskStatus
        if task_data.get("status") == TaskStatus.CANCELLED.value:
            logger.debug(f"任务已取消，停止监控: {task_id}")
            return {"status": "cancelled", "message": "任务已取消"}

        # 获取子任务状态
        logger.debug(f"获取子任务状态: {task_id}")
        sub_tasks = await get_dramatiq_tasks_by_parent_id(db, task_id)
        total_tasks = len(sub_tasks)
        completed_tasks = sum(1 for task in sub_tasks if task.get("status") == SubTaskStatus.COMPLETED.value)
        failed_tasks = sum(1 for task in sub_tasks if task.get("status") == SubTaskStatus.FAILED.value)
        processing_tasks = sum(1 for task in sub_tasks if task.get("status") == SubTaskStatus.PROCESSING.value)
        pending_tasks = total_tasks - completed_tasks - failed_tasks - processing_tasks

        logger.debug(f"子任务状态: 总数={total_tasks}, 完成={completed_tasks}, 失败={failed_tasks}, 处理中={processing_tasks}, 等待中={pending_tasks}, 任务ID: {task_id}")

        # 检查是否所有子任务已完成或失败
        all_completed = (completed_tasks + failed_tasks) >= total_tasks
        logger.debug(f"所有子任务是否已完成或失败: {all_completed}, 任务ID: {task_id}")

        # 如果所有子任务已完成或失败
        if all_completed:
            logger.debug(f"所有子任务已完成或失败，开始更新任务状态: {task_id}")
            # 更新子任务完成状态
            logger.debug(f"更新子任务完成状态: {task_id}")
            await update_subtasks_completion(db, task_id, True)
            logger.debug(f"子任务完成状态已更新: {task_id}")

            # 更新任务状态
            from app.models.task import TaskStatus
            total_time = time.time() - monitoring_start_time

            # 如果所有子任务都失败，则任务失败
            if failed_tasks == total_tasks:
                logger.debug(f"所有子任务均失败，更新任务状态为失败: {task_id}, 总耗时: {total_time:.2f}秒")
                # 更新任务状态
                await update_task_status(db, task_id, TaskStatus.FAILED.value)
                # 更新进度信息
                from app.crud.task import update_task_progress_with_counts
                await update_task_progress_with_counts(db, task_id, failed_tasks, total_tasks)

                # 发送任务失败通知
                feishu_notify(
                    event_type='task_failed',
                    task_id=task_id,
                    task_name=task_data.get("task_name", "未命名任务"),
                    submitter=task_data.get("username", "未知用户"),
                    details={
                        "失败数": f"{failed_tasks}/{total_tasks}",
                        "总耗时": f"{total_time:.2f}秒",
                        "失败阶段": "任务执行阶段"
                    },
                    message="所有子任务均失败，请检查任务配置和服务状态"
                )

                return {"status": "failed", "message": "所有子任务均失败"}
            # 如果有一些子任务失败，但不是全部，则任务部分完成
            elif failed_tasks > 0:
                logger.debug(f"部分子任务失败，更新任务状态为已完成: {task_id}, 失败数: {failed_tasks}/{total_tasks}, 总耗时: {total_time:.2f}秒")
                # 更新任务状态
                await update_task_status(db, task_id, TaskStatus.COMPLETED.value)
                # 更新进度信息
                from app.crud.task import update_task_progress_with_counts
                await update_task_progress_with_counts(db, task_id, completed_tasks + failed_tasks, total_tasks)

                # 发送任务部分成功通知
                feishu_notify(
                    event_type='task_partial_completed',
                    task_id=task_id,
                    task_name=task_data.get("task_name", "未命名任务"),
                    submitter=task_data.get("username", "未知用户"),
                    details={
                        "成功数": f"{completed_tasks}/{total_tasks}",
                        "失败数": f"{failed_tasks}/{total_tasks}",
                        "总耗时": f"{total_time:.2f}秒"
                    },
                    message="任务已部分完成，但有部分子任务失败"
                )

                return {"status": "completed_with_failures", "message": "任务已完成，但有部分子任务失败"}
            # 如果所有子任务都成功，则任务成功
            else:
                logger.debug(f"所有子任务均成功，更新任务状态为已完成: {task_id}, 完成数: {completed_tasks}/{total_tasks}, 总耗时: {total_time:.2f}秒")
                # 更新任务状态
                await update_task_status(db, task_id, TaskStatus.COMPLETED.value)
                # 更新进度信息
                from app.crud.task import update_task_progress_with_counts
                await update_task_progress_with_counts(db, task_id, completed_tasks, total_tasks)

                # 发送任务成功通知
                feishu_notify(
                    event_type='task_completed',
                    task_id=task_id,
                    task_name=task_data.get("task_name", "未命名任务"),
                    submitter=task_data.get("username", "未知用户"),
                    details={
                        "完成数": f"{completed_tasks}/{total_tasks}",
                        "总耗时": f"{total_time:.2f}秒",
                        "生成图片数": completed_tasks
                    },
                    message="所有任务已成功完成"
                )

                logger.debug(f"任务已成功完成: {task_id}, 总耗时: {total_time:.2f}秒")
                return {"status": "completed", "message": "任务已成功完成"}

        # 等待一段时间再检查
        await asyncio.sleep(5)

async def cleanup_expired_task_data() -> Dict[str, Any]:
    """
    清理过期的任务数据

    Returns:
        清理结果
    """
    # 计算过期时间（30天前）
    from datetime import datetime, timedelta, timezone
    expiration_date = datetime.now(timezone.utc) - timedelta(days=30)

    # 获取数据库连接
    db = await get_database()

    # 查找过期的任务
    from app.crud.task import list_tasks, delete_task
    from app.crud.dramatiq_task import delete_dramatiq_tasks_by_parent_id

    # 获取30天前的任务
    result = await list_tasks(
        db,
        status=None,
        page=1,
        page_size=1000,
        created_before=expiration_date
    )

    expired_tasks = result.get("items", [])
    deleted_count = 0

    # 标记为已删除
    for task in expired_tasks:
        task_id = task.get("id")
        if task_id:
            # 删除任务
            await delete_task(db, task_id)

            # 删除相关的子任务
            await delete_dramatiq_tasks_by_parent_id(db, task_id)

            deleted_count += 1

    return {
        "deleted_count": deleted_count,
        "expiration_date": expiration_date.isoformat()
    }

# 启动任务执行器和自动扩容
async def start_task_executor(
    min_concurrent_tasks: int = 5,
    max_concurrent_tasks: int = 50,
    scale_up_step: int = 5,
    scale_up_interval: int = 60,
    scale_down_interval: int = 300,
    lumina_min_concurrent_tasks: int = 2,
    lumina_max_concurrent_tasks: int = 20,
    lumina_scale_up_step: int = 2,
    lumina_scale_up_interval: int = 120,
    lumina_scale_down_interval: int = 180
):
    """
    启动任务执行器和自动扩容

    Args:
        min_concurrent_tasks: 标准执行器最小并发任务数
        max_concurrent_tasks: 标准执行器最大并发任务数
        scale_up_step: 标准执行器每次扩容增加的并发数
        scale_up_interval: 标准执行器扩容间隔（秒）
        scale_down_interval: 标准执行器缩容间隔（秒）
        lumina_min_concurrent_tasks: Lumina执行器最小并发任务数
        lumina_max_concurrent_tasks: Lumina执行器最大并发任务数
        lumina_scale_up_step: Lumina执行器每次扩容增加的并发数
        lumina_scale_up_interval: Lumina执行器扩容间隔（秒）
        lumina_scale_down_interval: Lumina执行器缩容间隔（秒）
    """
    from app.services.task_executor import start_auto_scaling

    # 启动标准任务执行器的自动扩容
    await start_auto_scaling(
        min_concurrent_tasks=min_concurrent_tasks,
        max_concurrent_tasks=max_concurrent_tasks,
        scale_up_step=scale_up_step,
        scale_up_interval=scale_up_interval,
        scale_down_interval=scale_down_interval,
        is_lumina=False
    )
    logger.debug(f"标准任务执行器已启动，初始并发任务数: {min_concurrent_tasks}, 最大并发任务数: {max_concurrent_tasks}")

    # 启动Lumina任务执行器的自动扩容
    await start_auto_scaling(
        min_concurrent_tasks=lumina_min_concurrent_tasks,
        max_concurrent_tasks=lumina_max_concurrent_tasks,
        scale_up_step=lumina_scale_up_step,
        scale_up_interval=lumina_scale_up_interval,
        scale_down_interval=lumina_scale_down_interval,
        is_lumina=True
    )
    logger.debug(f"Lumina任务执行器已启动，初始并发任务数: {lumina_min_concurrent_tasks}, 最大并发任务数: {lumina_max_concurrent_tasks}")
