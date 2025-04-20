from typing import Dict, Any, List, Optional, Tuple
import logging
import uuid
import random

from app.db.mongodb import get_database
from app.crud import task as task_crud
from app.crud import dramatiq_task as dramatiq_task_crud
from app.models.task import TaskStatus
from app.models.dramatiq_task import DramatiqTaskStatus
from app.utils.make_image import create_image_generator
from app.dramatiq.tasks import generate_single_image

# 配置日志
logger = logging.getLogger(__name__)

async def create_task(task_data: Dict[str, Any]) -> Dict[str, Any]:
    """
    创建任务

    Args:
        task_data: 任务数据

    Returns:
        创建的任务
    """
    db = await get_database()

    # 创建任务
    task = await task_crud.create_task(db, task_data)

    # 返回创建的任务
    return task

async def get_task(task_id: str) -> Optional[Dict[str, Any]]:
    """
    获取任务详情

    Args:
        task_id: 任务ID

    Returns:
        任务详情，如果不存在则返回None
    """
    db = await get_database()
    task = await task_crud.get_task(db, task_id)

    # 如果任务存在且状态为已完成或处理中，获取结果
    if task and task.get("status") in [TaskStatus.COMPLETED.value, TaskStatus.PROCESSING.value]:
        # 获取子任务
        dramatiq_tasks = await dramatiq_task_crud.get_dramatiq_tasks_by_parent_id(
            db, task_id, DramatiqTaskStatus.COMPLETED.value
        )

        # 整理结果
        results = {}
        for dt in dramatiq_tasks:
            if dt.get("result"):
                results[dt.get("combination_key")] = dt.get("result")

        # 添加结果到任务
        if results:
            task["results"] = results

    return task

async def get_task_by_uuid(task_uuid: str) -> Optional[Dict[str, Any]]:
    """
    通过UUID获取任务详情

    Args:
        task_uuid: 任务UUID

    Returns:
        任务详情，如果不存在则返回None
    """
    db = await get_database()
    return await task_crud.get_task_by_uuid(db, task_uuid)

async def list_tasks(
    username: Optional[str] = None,
    status: Optional[str] = None,
    page: int = 1,
    page_size: int = 10
) -> Dict[str, Any]:
    """
    获取任务列表

    Args:
        username: 用户名过滤
        status: 状态过滤
        page: 页码
        page_size: 每页大小

    Returns:
        任务列表和分页信息
    """
    db = await get_database()
    return await task_crud.list_tasks(db, username, status, page, page_size)

async def cancel_task(task_id: str) -> bool:
    """
    取消任务

    Args:
        task_id: 任务ID

    Returns:
        取消是否成功
    """
    db = await get_database()
    return await task_crud.cancel_task(db, task_id)

async def delete_task(task_id: str) -> bool:
    """
    删除任务

    Args:
        task_id: 任务ID

    Returns:
        删除是否成功
    """
    db = await get_database()
    return await task_crud.delete_task(db, task_id)

async def prepare_dramatiq_tasks(task_id: str) -> Dict[str, Any]:
    """
    准备Dramatiq任务

    Args:
        task_id: 任务ID

    Returns:
        准备结果
    """
    try:
        logger.info(f"开始准备任务 {task_id} 的Dramatiq子任务")
        db = await get_database()

        # 获取任务
        task_data = await task_crud.get_task(db, task_id)
        if not task_data:
            logger.error(f"找不到任务 {task_id}")
            return {"status": "failed", "error": f"找不到任务 {task_id}"}

        # 获取必要的任务数据
        x_token = task_data.get("settings", {}).get("xToken", "")
        logger.info(f"任务 {task_id} 的xToken: {x_token}")

        # 创建图片生成器
        image_generator = create_image_generator(x_token)

        # 计算变量组合
        logger.info(f"开始计算任务 {task_id} 的变量组合")
        combinations = await calculate_combinations(task_id, task_data, image_generator)
        logger.info(f"任务 {task_id} 共有 {len(combinations)} 个变量组合")

        # 更新任务状态为处理中
        await task_crud.update_task_status(db, task_id, TaskStatus.PROCESSING.value)

        # 创建子任务
        created_tasks = 0
        for i, combination in enumerate(combinations):
            # 记录组合信息
            logger.debug(f"组合 {i+1}/{len(combinations)}: {combination}")

            # 提取参数
            prompts, ratio, seed, use_polish = await extract_parameters(
                task_data.get("tags", []),
                combination,
                image_generator
            )
            logger.debug(f"提取的参数: prompts={prompts}, ratio={ratio}, seed={seed}, use_polish={use_polish}")

            # 提取变量索引
            variable_indices = {}
            for var_name, var_data in combination.items():
                if var_name.startswith('v') and var_data:
                    # 提取变量索引
                    var_index = None
                    if isinstance(var_data, dict) and 'variable_id' in var_data:
                        # 如果有variable_id字段，使用它来提取索引
                        var_id = var_data['variable_id']
                        # 尝试从变量ID中提取索引
                        try:
                            if '_' in var_id:
                                var_index = int(var_id.split('_')[-1])
                            else:
                                var_index = 0
                        except (ValueError, TypeError):
                            var_index = 0
                    elif isinstance(var_data, dict) and 'id' in var_data:
                        # 如果有id字段，使用它来提取索引
                        var_id = var_data['id']
                        # 尝试从变量ID中提取索引
                        try:
                            if '_' in var_id:
                                var_index = int(var_id.split('_')[-1])
                            else:
                                var_index = 0
                        except (ValueError, TypeError):
                            var_index = 0

                    # 记录变量索引
                    variable_indices[var_name] = var_index

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
                                "name": character_value,
                                "weight": character_weight,
                                "header_url": character_header_url
                            })

                    # 如果是元素类型的变量
                    elif var_tag and var_tag.get("type") == "element":
                        element_value = var_data.get("value", "")
                        element_weight = var_data.get("weight", 1.0)
                        element_uuid = var_data.get("uuid", "")
                        element_header_url = var_data.get("header_img", "")

                        if element_value and element_uuid:
                            element_list.append({
                                "value": element_uuid,
                                "name": element_value,
                                "weight": element_weight,
                                "header_url": element_header_url
                            })

            # 处理变量中的提示词
            for var_name, var_data in combination.items():
                if var_name.startswith('v') and isinstance(var_data, dict) and "value" in var_data:
                    prompt_value = var_data.get("value", "")
                    prompt_weight = var_data.get("weight", 1.0)
                    if prompt_value:
                        prompt_item = {"value": prompt_value, "weight": prompt_weight}

            # 如果没有提示词，使用默认值
            if prompt_item is None:
                prompt_item = {"value": "", "weight": 1.0}

            # 创建Dramatiq任务记录
            dramatiq_task_data = {
                "parent_task_id": task_id,
                "status": DramatiqTaskStatus.PENDING.value,
                "prompt": prompt_item,
                "characters": character_list,
                "elements": element_list,
                "ratio": ratio,
                "seed": seed,
                "use_polish": use_polish,
                "v0": variable_indices.get("v0"),
                "v1": variable_indices.get("v1"),
                "v2": variable_indices.get("v2"),
                "v3": variable_indices.get("v3"),
                "v4": variable_indices.get("v4"),
                "v5": variable_indices.get("v5")
            }

            try:
                # 创建Dramatiq任务
                dramatiq_task = await dramatiq_task_crud.create_dramatiq_task(db, dramatiq_task_data)
                logger.debug(f"创建了Dramatiq任务: {dramatiq_task['id']}")

                # 发送子任务到Dramatiq队列
                message = generate_single_image.send(
                    parent_task_id=task_id,
                    prompt=prompt_item,
                    characters=character_list,
                    elements=element_list,
                    ratio=ratio,
                    seed=seed,
                    use_polish=use_polish,
                    x_token=x_token,
                    variable_indices=variable_indices,
                    combination=combination
                )
                logger.debug(f"发送了Dramatiq消息: {message.message_id}")

                # 更新Dramatiq任务的消息ID
                await dramatiq_task_crud.update_dramatiq_task_message_id(db, dramatiq_task["id"], message.message_id)
                created_tasks += 1
            except Exception as sub_error:
                logger.error(f"创建子任务时出错: {str(sub_error)}")

        logger.info(f"任务 {task_id} 已成功创建 {created_tasks} 个子任务")
        return {"status": "success", "message": f"已创建 {created_tasks} 个子任务"}

    except Exception as e:
        logger.error(f"准备Dramatiq任务时出错: {str(e)}")
        try:
            db = await get_database()
            await task_crud.update_task_status(db, task_id, TaskStatus.FAILED.value, str(e))
        except Exception as update_error:
            logger.error(f"更新任务状态时出错: {str(update_error)}")
        return {"status": "failed", "error": str(e)}

async def calculate_combinations(
    task_id: str,
    task_data: Dict[str, Any],
    image_generator
) -> List[Dict[str, Dict[str, str]]]:
    """
    计算所有变量组合

    Args:
        task_id: 任务ID
        task_data: 任务数据
        image_generator: 图片生成器

    Returns:
        变量组合列表
    """
    db = await get_database()

    # 获取变量
    variables = task_data.get("variables", {})

    # 记录变量结构
    logger.debug(f"任务 {task_id} 的变量结构: {variables}")

    # 手动计算组合数量
    manual_count = 1
    for var_key, var_data in variables.items():
        if var_key.startswith('v'):
            # 优先使用values_count字段
            values_count = var_data.get('values_count')
            if values_count is None and var_data.get('values'):
                values_count = len(var_data.get('values'))

            if values_count and values_count > 0:
                manual_count *= values_count

    logger.info(f"手动计算的组合数量: {manual_count}")

    # 计算组合
    combinations = await image_generator.calculate_combinations(variables)

    # 更新任务的图片总数
    total_images = len(combinations)
    logger.info(f"计算出的组合数量: {total_images}")

    # 如果计算出的组合数量与手动计算的不一致，使用手动计算的结果
    if total_images != manual_count and manual_count > 0:
        logger.warning(f"计算出的组合数量 ({total_images}) 与手动计算的 ({manual_count}) 不一致，使用手动计算的结果")

        # 如果组合为空或数量不正确，创建正确数量的组合
        if not combinations or len(combinations) != manual_count:
            logger.warning(f"组合数量不正确，创建 {manual_count} 个组合")

            # 如果有现有组合，使用第一个作为模板
            template_combination = combinations[0] if combinations else {}

            # 创建新的组合列表
            new_combinations = []
            for i in range(manual_count):
                if i < len(combinations):
                    new_combinations.append(combinations[i])
                else:
                    # 复制模板并修改ID以避免重复
                    new_combination = template_combination.copy()
                    for var_name in new_combination:
                        if isinstance(new_combination[var_name], dict):
                            new_dict = new_combination[var_name].copy()
                            if 'variable_id' in new_dict:
                                new_dict['variable_id'] = f"{new_dict['variable_id']}_{i}"
                            new_combination[var_name] = new_dict
                    new_combinations.append(new_combination)

            combinations = new_combinations

    # 记录组合详情
    for i, combination in enumerate(combinations):
        logger.debug(f"组合 {i+1}: {combination}")

    # 更新任务的图片总数
    await task_crud.update_task_total_images(db, task_id, total_images)

    return combinations

async def extract_parameters(
    tags: List[Dict[str, Any]],
    combination: Dict[str, Dict[str, str]],
    image_generator
) -> Tuple[List[str], str, Optional[int], bool]:
    """
    从标签和组合中提取参数

    Args:
        tags: 标签列表
        combination: 变量组合
        image_generator: 图片生成器

    Returns:
        提示词、比例、种子和是否使用润色
    """
    try:
        # 记录输入参数
        logger.debug(f"提取参数输入: tags={tags}, combination={combination}")

        # 使用图片生成器提取参数
        result = await image_generator.extract_parameters(tags, combination)

        # 记录提取结果
        logger.debug(f"提取参数结果: {result}")

        return result
    except Exception as e:
        logger.error(f"提取参数时出错: {str(e)}")
        # 返回默认值
        return [], "1:1", random.randint(1, 2147483647), False

def generate_combination_key(combination: Dict[str, Dict[str, str]]) -> str:
    """
    生成组合键

    Args:
        combination: 变量组合

    Returns:
        组合键
    """
    # 如果组合为空，返回默认键
    if not combination:
        return "default_combination"

    parts = []
    for var_name, var_data in sorted(combination.items()):
        # 处理不同类型的值
        if isinstance(var_data, dict):
            value = var_data.get('value', '')
        else:
            value = str(var_data)

        parts.append(f"{var_name}_{value}")

    # 如果没有部分，返回默认键
    if not parts:
        return "default_combination"

    return ":".join(parts)
