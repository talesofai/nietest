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
from datetime import datetime, timezone

from app.db.mongodb import get_database
from app.models.dramatiq_task import DramatiqTaskStatus
from app.services.image import create_image_generator, format_prompt_for_api
from app.services.task_executor import get_task_executor, submit_task, get_task_result
from app.core.config import settings

# 配置日志
logger = logging.getLogger(__name__)

async def process_image_task(task_id: str) -> Dict[str, Any]:
    """
    处理图像生成任务

    Args:
        task_id: 任务ID（UUID）

    Returns:
        处理结果
    """
    # 记录开始时间，用于计算总耗时
    start_time = time.time()

    # 获取数据库连接
    db = await get_database()

    # 获取任务数据
    from app.crud.dramatiq_task import get_dramatiq_task, update_dramatiq_task_status
    logger.info(f"开始获取任务数据: {task_id}")
    task_data = await get_dramatiq_task(db, task_id)

    if not task_data:
        logger.error(f"找不到任务 {task_id}")
        raise ValueError(f"找不到任务 {task_id}")

    logger.info(f"成功获取任务数据: {task_id}, 父任务ID: {task_data.get('parent_task_id')}")

    # 更新任务状态为处理中
    logger.info(f"更新任务状态为处理中: {task_id}")
    await update_dramatiq_task_status(db, task_id, DramatiqTaskStatus.PROCESSING.value)
    logger.info(f"任务状态已更新为处理中: {task_id}")

    try:
        # 提取任务参数
        prompt = task_data.get("prompt", {})
        characters = task_data.get("characters", [])
        elements = task_data.get("elements", [])
        ratio = task_data.get("ratio", "1:1")
        seed = task_data.get("seed")
        use_polish = task_data.get("use_polish", False)

        # 创建图像生成服务
        image_generator = create_image_generator()

        # 计算宽高
        width, height = await image_generator.calculate_dimensions(ratio)

        # 格式化提示词
        formatted_prompt = format_prompt_for_api(prompt, "prompt") if prompt else None
        formatted_characters = [format_prompt_for_api(char, "character") for char in characters] if characters else []
        formatted_elements = [format_prompt_for_api(elem, "element") for elem in elements] if elements else []

        # 合并所有提示词
        all_prompts = []

        # 添加主提示词
        if formatted_prompt:
            all_prompts.append(formatted_prompt)

        # 添加角色
        all_prompts.extend(formatted_characters)

        # 添加元素
        all_prompts.extend(formatted_elements)

        # 如果没有任何提示词，添加一个空占位符
        if not all_prompts:
            all_prompts = [{"type": "freetext", "weight": 1, "value": "placeholder"}]

        # 生成图像
        logger.info(f"开始生成图像: {task_id}, 宽度={width}, 高度={height}, 种子={seed}, 使用文本润色={use_polish}")

        # 记录当前耗时
        current_time = time.time()
        elapsed_time = current_time - start_time
        logger.info(f"生成图像前耗时: {elapsed_time:.2f} 秒, 任务ID: {task_id}")

        logger.info(f"发送图像生成请求: {task_id}, 提示词数量: {len(all_prompts)}")
        try:
            result = await image_generator.generate_image(
                prompts=all_prompts,
                width=width,
                height=height,
                seed=seed,
                advanced_translator=use_polish
            )
            logger.info(f"图像生成请求已发送并返回结果: {task_id}")
            logger.debug(f"图像生成结果数据结构: {type(result)}, 包含字段: {list(result.keys()) if isinstance(result, dict) else 'not a dict'}")
            logger.debug(f"图像生成结果: {json.dumps(result, ensure_ascii=False)}")
        except Exception as e:
            logger.error(f"图像生成请求失败: {task_id}, 错误: {str(e)}")
            # 打印异常堆栈
            import traceback
            logger.error(f"图像生成异常堆栈:\n{traceback.format_exc()}")
            raise

        # 提取图像URL
        logger.info(f"开始提取图像URL: {task_id}")

        # 记录当前耗时
        current_time = time.time()
        elapsed_time = current_time - start_time
        logger.info(f"提取图像URL前耗时: {elapsed_time:.2f} 秒, 任务ID: {task_id}")

        try:
            image_url = await image_generator.extract_image_url(result)
            logger.info(f"成功提取图像URL: {task_id}, URL: {image_url[:50] if image_url else 'None'}")
        except Exception as e:
            logger.error(f"提取图像URL失败: {task_id}, 错误: {str(e)}")
            # 打印异常堆栈
            import traceback
            logger.error(f"提取URL异常堆栈:\n{traceback.format_exc()}")
            raise

        # 创建结果项
        result_item = {
            "url": image_url,
            "width": width,
            "height": height,
            "seed": seed,
            "created_at": datetime.now(timezone.utc).isoformat()
        }

        # 更新任务状态为已完成
        from app.crud.dramatiq_task import update_dramatiq_task_result, get_dramatiq_task
        logger.info(f"开始更新任务状态为已完成: {task_id}")

        # 记录当前耗时
        current_time = time.time()
        elapsed_time = current_time - start_time
        logger.info(f"更新任务状态前耗时: {elapsed_time:.2f} 秒, 任务ID: {task_id}")

        await update_dramatiq_task_result(db, task_id, DramatiqTaskStatus.COMPLETED.value, result_item)
        logger.info(f"任务状态已更新为已完成: {task_id}")

        # 记录总耗时
        total_time = time.time() - start_time
        logger.info(f"任务处理完成，总耗时: {total_time:.2f} 秒, 任务ID: {task_id}")

        return {
            "status": "completed",
            "result": result_item
        }
    except Exception as e:
        # 记录错误并更新任务状态
        total_time = time.time() - start_time
        logger.error(f"生成图像时出错: {str(e)}, 耗时: {total_time:.2f} 秒, 任务ID: {task_id}")

        # 打印异常堆栈
        import traceback
        logger.error(f"异常堆栈:\n{traceback.format_exc()}")

        try:
            from app.crud.dramatiq_task import update_dramatiq_task_error
            logger.info(f"开始更新任务状态为失败: {task_id}")
            await update_dramatiq_task_error(db, task_id, DramatiqTaskStatus.FAILED.value, str(e))
            logger.info(f"任务状态已更新为失败: {task_id}")
        except Exception as update_error:
            logger.error(f"更新任务状态时出错: {str(update_error)}, 任务ID: {task_id}")

        raise

async def create_and_submit_subtasks(parent_task_id: str, combinations: List[Dict[str, Dict[str, Any]]] = None) -> Dict[str, Any]:
    """
    创建并提交子任务

    Args:
        parent_task_id: 父任务ID
        combinations: 预先计算好的变量组合，如果为None则重新计算

    Returns:
        创建结果
    """
    try:
        # 获取数据库连接
        db = await get_database()

        # 获取任务信息
        from app.crud.task import get_task
        task_data = await get_task(db, parent_task_id)

        if not task_data:
            raise ValueError(f"找不到任务 {parent_task_id}")

        # 获取任务变量
        variables = task_data.get("variables", {})

        # 创建子任务
        from app.crud.dramatiq_task import create_dramatiq_task

        logger.info(f"为任务 {parent_task_id} 使用预先计算好的 {len(combinations)} 个变量组合")

        # 使用task.py中的参数提取逻辑
        from app.services.task import extract_parameters

        # 创建子任务并提交到执行器
        subtask_ids = []
        for i, combination in enumerate(combinations):
            # 提取参数
            prompts, ratio, seed, use_polish = await extract_parameters(
                task_data.get("tags", []),
                combination
            )
            logger.debug(f"提取的参数: prompts={prompts}, ratio={ratio}, seed={seed}, use_polish={use_polish}")

            # 提取变量索引
            variable_indices = {}
            # 初始化所有变量索引为Null
            for i in range(6):
                variable_indices[f"v{i}"] = None

            # 创建标签ID到标签类型的映射
            tag_id_to_type = {}
            for tag in task_data.get("tags", []):
                if tag.get("id") and tag.get("type"):
                    tag_id_to_type[tag.get("id")] = tag.get("type")

            # 遍历变量定义，找出每个变量在其值列表中的索引
            for var_name, var_data in variables.items():
                if var_name.startswith('v') and var_data.get('values'):
                    var_values = var_data.get('values', [])

                    # 获取当前组合中该变量的值
                    if var_name in combination and isinstance(combination[var_name], dict):
                        combo_var_data = combination[var_name]
                        combo_var_value = combo_var_data.get('value')

                        # 在变量值列表中查找匹配的索引
                        found_index = False
                        for idx, val in enumerate(var_values):
                            if isinstance(val, dict) and val.get('value') == combo_var_value:
                                variable_indices[var_name] = idx
                                found_index = True
                                logger.debug(f"变量 {var_name} 的值 {combo_var_value} 在列表中的索引是 {idx}")
                                break

                        if not found_index:
                            logger.warning(f"无法找到变量 {var_name} 的值 {combo_var_value} 在列表中的索引")

            # 记录变量索引
            logger.info(f"变量索引: {variable_indices}")

            # 记录变量索引数组
            variable_indices_array = [
                variable_indices.get("v0"),
                variable_indices.get("v1"),
                variable_indices.get("v2"),
                variable_indices.get("v3"),
                variable_indices.get("v4"),
                variable_indices.get("v5")
            ]
            logger.info(f"变量索引数组: {variable_indices_array}")

            # 检查是否已存在相同的子任务
            from app.crud.dramatiq_task import get_dramatiq_task_by_variables
            existing_task = await get_dramatiq_task_by_variables(db, parent_task_id, variable_indices_array)

            if existing_task:
                logger.info(f"已存在相同的子任务: {existing_task['id']}, 跳过创建")
                subtask_ids.append(existing_task['id'])
                continue

            # 分离提示词、角色和元素
            prompt_item = None
            character_list = []
            element_list = []

            # 处理标签中的角色和元素
            for tag in task_data.get("tags", []):
                # 处理角色
                if tag.get("type") == "character" and not tag.get("is_variable", False):
                    character_value = tag.get("value", "")
                    character_weight = tag.get("weight", 1.0)
                    character_uuid = tag.get("uuid", "")
                    character_header_url = tag.get("header_img", "")

                    if character_value:
                        character_list.append({
                            "value": character_uuid,  # 使用前端传递的UUID
                            "name": character_value,
                            "weight": character_weight,
                            "header_url": character_header_url  # 使用前端传递的header_img
                        })

                # 处理元素
                elif tag.get("type") == "element" and not tag.get("is_variable", False):
                    element_value = tag.get("value", "")
                    element_weight = tag.get("weight", 1.0)
                    element_uuid = tag.get("uuid", "")
                    element_header_url = tag.get("header_img", "")

                    if element_value:
                        element_list.append({
                            "value": element_uuid,  # 使用前端传递的UUID
                            "name": element_value,
                            "weight": element_weight,
                            "header_url": element_header_url  # 使用前端传递的header_img
                        })

            # 处理变量中的角色和元素
            for var_name, var_data in combination.items():
                if var_name.startswith('v') and isinstance(var_data, dict) and "value" in var_data:
                    # 获取变量的标签类型
                    var_tag_id = var_data.get("tag_id", "")
                    var_tag = next((tag for tag in task_data.get("tags", []) if tag.get("id") == var_tag_id), None)

                    # 如果是角色类型的变量
                    if var_tag and var_tag.get("type") == "character":
                        character_value = var_data.get("value", "")
                        character_weight = var_data.get("weight", 1.0)
                        character_uuid = var_data.get("uuid", "")
                        character_header_url = var_data.get("header_img", "")

                        if character_value and character_uuid:
                            character_list.append({
                                "value": character_uuid,
                                "uuid": character_uuid,  # 确保有uuid字段
                                "name": character_value,
                                "weight": character_weight,
                                "header_url": character_header_url,
                                "type": "character"  # 添加类型字段
                            })
                            logger.info(f"添加角色: uuid={character_uuid}, name={character_value}")

                    # 如果是元素类型的变量
                    elif var_tag and var_tag.get("type") == "element":
                        element_value = var_data.get("value", "")
                        element_weight = var_data.get("weight", 1.0)
                        element_uuid = var_data.get("uuid", "")
                        element_header_url = var_data.get("header_img", "")

                        if element_value and element_uuid:
                            element_list.append({
                                "value": element_uuid,
                                "uuid": element_uuid,  # 确保有uuid字段
                                "name": element_value,
                                "weight": element_weight,
                                "header_url": element_header_url,
                                "type": "element"  # 添加类型字段
                            })
                            logger.info(f"添加元素: uuid={element_uuid}, name={element_value}")

            # 处理标签中的提示词
            for tag in task_data.get("tags", []):
                if tag.get("type") == "prompt" and not tag.get("is_variable", False):
                    prompt_value = tag.get("value", "")
                    prompt_weight = tag.get("weight", 1.0)
                    if prompt_value:
                        prompt_item = {"value": prompt_value, "weight": prompt_weight}
                        logger.info(f"从标签中提取到提示词: {prompt_value}, 权重: {prompt_weight}")

            # 处理变量中的提示词
            for var_name, var_data in combination.items():
                if var_name.startswith('v') and isinstance(var_data, dict) and "value" in var_data:
                    # 获取变量的标签类型
                    var_tag_id = var_data.get("tag_id", "")
                    var_tag = next((tag for tag in task_data.get("tags", []) if tag.get("id") == var_tag_id), None)

                    # 只处理提示词类型的变量
                    if var_tag and var_tag.get("type") == "prompt":
                        prompt_value = var_data.get("value", "")
                        prompt_weight = var_data.get("weight", 1.0)
                        if prompt_value:
                            prompt_item = {"value": prompt_value, "weight": prompt_weight}
                            logger.info(f"从变量中提取到提示词: {prompt_value}, 权重: {prompt_weight}")

            # 如果没有提示词，使用默认值
            if prompt_item is None:
                prompt_item = {"value": "", "weight": 1.0}

            # 创建子任务记录
            subtask_id = str(uuid.uuid4())
            subtask_data = {
                "id": subtask_id,
                "parent_task_id": parent_task_id,
                "status": DramatiqTaskStatus.PENDING.value,
                "prompt": prompt_item,
                "characters": character_list,
                "elements": element_list,
                "ratio": ratio,
                "seed": seed,
                "use_polish": use_polish,
                # 构建变量索引数组
                "variable_indices": [
                    variable_indices.get("v0"),
                    variable_indices.get("v1"),
                    variable_indices.get("v2"),
                    variable_indices.get("v3"),
                    variable_indices.get("v4"),
                    variable_indices.get("v5")
                ],
                "created_at": datetime.now(timezone.utc),
                "updated_at": datetime.now(timezone.utc)
            }

            # 保存到数据库
            await create_dramatiq_task(db, subtask_data)

            # 提交到任务执行器
            await submit_task(process_image_task(subtask_id), subtask_id)

            subtask_ids.append(subtask_id)
            logger.info(f"创建并提交子任务: {subtask_id}, 父任务: {parent_task_id}")

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



async def monitor_task_progress(task_id: str) -> Dict[str, Any]:
    """
    监控任务进度

    Args:
        task_id: 任务ID

    Returns:
        监控结果
    """
    try:
        # 获取数据库连接
        db = await get_database()

        # 获取任务信息
        from app.crud.task import get_task, update_task_status, update_subtasks_completion
        task_data = await get_task(db, task_id)

        if not task_data:
            raise ValueError(f"找不到任务 {task_id}")

        # 检查任务状态
        from app.crud.dramatiq_task import get_dramatiq_tasks_by_parent_id

        # 获取子任务
        logger.info(f"开始获取子任务: {task_id}")
        sub_tasks = await get_dramatiq_tasks_by_parent_id(db, task_id)
        logger.info(f"子任务获取结果: 找到 {len(sub_tasks)} 个子任务, 任务ID: {task_id}")

        # 如果子任务未创建，创建子任务
        if not sub_tasks:
            logger.info(f"子任务不存在，开始创建子任务: {task_id}")

            # 计算变量组合
            from app.services.task import calculate_combinations
            combinations = await calculate_combinations(task_id, task_data)
            logger.info(f"任务 {task_id} 共有 {len(combinations)} 个变量组合")

            # 创建子任务，传递预先计算好的变量组合
            creation_result = await create_and_submit_subtasks(task_id, combinations)

            if creation_result.get("status") == "failed":
                error_msg = f"创建子任务失败: {creation_result.get('error')}"
                logger.error(error_msg)
                raise Exception(error_msg)

            logger.info(f"子任务创建成功，开始重新获取子任务: {task_id}")
            # 重新获取子任务
            sub_tasks = await get_dramatiq_tasks_by_parent_id(db, task_id)
            logger.info(f"重新获取子任务结果: 找到 {len(sub_tasks)} 个子任务, 任务ID: {task_id}")

            if not sub_tasks:
                error_msg = f"无法创建任务 {task_id} 的子任务"
                logger.error(error_msg)
                raise Exception(error_msg)

        # 监控子任务执行
        logger.info(f"开始监控子任务执行: {task_id}")
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
                logger.info(f"任务已取消，停止监控: {task_id}")
                return {"status": "cancelled", "message": "任务已取消"}

            # 获取子任务状态
            logger.debug(f"获取子任务状态: {task_id}")
            sub_tasks = await get_dramatiq_tasks_by_parent_id(db, task_id)
            total_tasks = len(sub_tasks)
            completed_tasks = sum(1 for task in sub_tasks if task.get("status") == DramatiqTaskStatus.COMPLETED.value)
            failed_tasks = sum(1 for task in sub_tasks if task.get("status") == DramatiqTaskStatus.FAILED.value)
            processing_tasks = sum(1 for task in sub_tasks if task.get("status") == DramatiqTaskStatus.PROCESSING.value)
            pending_tasks = total_tasks - completed_tasks - failed_tasks - processing_tasks

            logger.debug(f"子任务状态: 总数={total_tasks}, 完成={completed_tasks}, 失败={failed_tasks}, 处理中={processing_tasks}, 等待中={pending_tasks}, 任务ID: {task_id}")

            # 检查是否所有子任务已完成或失败
            all_completed = (completed_tasks + failed_tasks) >= total_tasks
            logger.debug(f"所有子任务是否已完成或失败: {all_completed}, 任务ID: {task_id}")

            # 如果所有子任务已完成或失败
            if all_completed:
                logger.info(f"所有子任务已完成或失败，开始更新任务状态: {task_id}")
                # 更新子任务完成状态
                logger.info(f"更新子任务完成状态: {task_id}")
                await update_subtasks_completion(db, task_id, True)
                logger.info(f"子任务完成状态已更新: {task_id}")

                # 更新任务状态
                from app.models.task import TaskStatus
                total_time = time.time() - monitoring_start_time

                # 如果所有子任务都失败，则任务失败
                if failed_tasks == total_tasks:
                    logger.info(f"所有子任务均失败，更新任务状态为失败: {task_id}, 总耗时: {total_time:.2f}秒")
                    # 更新任务状态
                    await update_task_status(db, task_id, TaskStatus.FAILED.value)
                    # 更新进度信息
                    from app.crud.task import update_task_progress
                    await update_task_progress(db, task_id, failed_tasks, total_tasks)
                    return {"status": "failed", "message": "所有子任务均失败"}
                # 如果有一些子任务失败，但不是全部，则任务部分完成
                elif failed_tasks > 0:
                    logger.info(f"部分子任务失败，更新任务状态为已完成: {task_id}, 失败数: {failed_tasks}/{total_tasks}, 总耗时: {total_time:.2f}秒")
                    # 更新任务状态
                    await update_task_status(db, task_id, TaskStatus.COMPLETED.value)
                    # 更新进度信息
                    from app.crud.task import update_task_progress
                    await update_task_progress(db, task_id, completed_tasks + failed_tasks, total_tasks)
                    return {"status": "completed_with_failures", "message": "任务已完成，但有部分子任务失败"}
                # 如果所有子任务都成功，则任务成功
                else:
                    logger.info(f"所有子任务均成功，更新任务状态为已完成: {task_id}, 完成数: {completed_tasks}/{total_tasks}, 总耗时: {total_time:.2f}秒")
                    # 更新任务状态
                    await update_task_status(db, task_id, TaskStatus.COMPLETED.value)
                    # 更新进度信息
                    from app.crud.task import update_task_progress
                    await update_task_progress(db, task_id, completed_tasks, total_tasks)

                    logger.info(f"任务已成功完成: {task_id}, 总耗时: {total_time:.2f}秒")
                    return {"status": "completed", "message": "任务已成功完成"}

            # 等待一段时间再检查
            await asyncio.sleep(5)

    except Exception as e:
        # 记录错误并更新任务状态
        logger.error(f"监控任务 {task_id} 进度时出错: {str(e)}")

        try:
            db = await get_database()
            from app.crud.task import update_task_status
            from app.models.task import TaskStatus
            await update_task_status(db, task_id, TaskStatus.FAILED.value, str(e))
        except Exception as update_error:
            logger.error(f"更新任务状态时出错: {str(update_error)}")

        raise

async def cleanup_expired_task_data() -> Dict[str, Any]:
    """
    清理过期的任务数据

    Returns:
        清理结果
    """
    try:
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
    except Exception as e:
        logger.error(f"清理过期任务时出错: {str(e)}")
        raise

# 启动任务执行器和自动扩容
async def start_task_executor(min_concurrent_tasks: int = 5, max_concurrent_tasks: int = 50, scale_up_step: int = 5, scale_up_interval: int = 60, scale_down_interval: int = 300):
    """
    启动任务执行器和自动扩容

    Args:
        min_concurrent_tasks: 最小并发任务数
        max_concurrent_tasks: 最大并发任务数
    """
    from app.services.task_executor import start_auto_scaling

    # 启动自动扩容
    await start_auto_scaling(
        min_concurrent_tasks=min_concurrent_tasks,
        max_concurrent_tasks=max_concurrent_tasks,
        scale_up_step=scale_up_step,  # 每次增加5个并发任务
        scale_up_interval=scale_up_interval,  # 每分钟最多扩容一次
        scale_down_interval=scale_down_interval  # 每5分钟最多缩容一次
    )

    logger.info(f"任务执行器已启动，初始并发任务数: {min_concurrent_tasks}, 最大并发任务数: {max_concurrent_tasks}")
