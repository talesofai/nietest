from typing import Dict, Any, List, Optional, Tuple
import logging
import uuid
import random

from app.db.mongodb import get_database
from app.db.redis import get_redis_cache
from app.crud import task as task_crud
from app.crud import dramatiq_task as dramatiq_task_crud
from app.models.task import TaskStatus
from app.models.dramatiq_task import DramatiqTaskStatus
from app.services.task_processor import create_and_submit_subtasks, monitor_task_progress
from app.core.config import settings

# 配置日志
logger = logging.getLogger(__name__)

async def clear_all_task_cache():
    """
    清理Redis中的所有任务缓存
    """
    try:
        redis_cache = get_redis_cache()
        # 清除所有task:开头的键
        deleted_count = await redis_cache.delete_pattern("task:*")
        logger.info(f"清除了 {deleted_count} 个任务缓存键")
        return deleted_count
    except Exception as e:
        logger.error(f"清理任务缓存时出错: {str(e)}")
        return 0

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

    if task:
        # 如果任务未完成，查询子任务状态并更新进度
        if task.get("status") != TaskStatus.COMPLETED.value:
            # 获取所有子任务
            all_dramatiq_tasks = await dramatiq_task_crud.get_dramatiq_tasks_by_parent_id(db, task_id)

            # 计算进度
            total_tasks = len(all_dramatiq_tasks)
            completed_tasks = sum(1 for dt in all_dramatiq_tasks if dt.get("status") == DramatiqTaskStatus.COMPLETED.value)
            failed_tasks = sum(1 for dt in all_dramatiq_tasks if dt.get("status") == DramatiqTaskStatus.FAILED.value)

            # 添加计算出的进度到任务
            if total_tasks > 0:
                task["processed_images"] = completed_tasks + failed_tasks
                task["progress"] = int((completed_tasks + failed_tasks) / total_tasks * 100)

                # 检查是否所有子任务都已完成
                if completed_tasks + failed_tasks == total_tasks:
                    # 更新任务状态为已完成
                    await task_crud.update_task_status(db, task_id, TaskStatus.COMPLETED.value)
                    task["status"] = TaskStatus.COMPLETED.value
            else:
                task["processed_images"] = 0
                task["progress"] = 0

        # 如果任务状态为已完成或处理中，获取结果
        if task.get("status") in [TaskStatus.COMPLETED.value, TaskStatus.PROCESSING.value]:
            # 获取已完成的子任务
            all_dramatiq_tasks = await dramatiq_task_crud.get_dramatiq_tasks_by_parent_id(db, task_id)
            completed_dramatiq_tasks = [dt for dt in all_dramatiq_tasks if dt.get("status") == DramatiqTaskStatus.COMPLETED.value]

            # 整理结果
            results = {}
            for dt in completed_dramatiq_tasks:
                if dt.get("result"):
                    combination_key = dt.get("combination_key", f"v0_{dt.get('v0')}:v1_{dt.get('v1')}")
                    results[combination_key] = dt.get("result")

            # 添加结果到任务
            if results:
                task["results"] = results

    return task

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
    result = await task_crud.list_tasks(db, username, status, page, page_size)

    # 对每个任务计算进度
    for task in result.get("items", []):
        # 只对未完成的任务查询子任务状态
        if task.get("status") != TaskStatus.COMPLETED.value:
            # 获取子任务
            task_id = task.get("id")
            if task_id:
                all_dramatiq_tasks = await dramatiq_task_crud.get_dramatiq_tasks_by_parent_id(db, task_id)

                # 计算进度
                total_tasks = len(all_dramatiq_tasks)
                completed_tasks = sum(1 for dt in all_dramatiq_tasks if dt.get("status") == DramatiqTaskStatus.COMPLETED.value)
                failed_tasks = sum(1 for dt in all_dramatiq_tasks if dt.get("status") == DramatiqTaskStatus.FAILED.value)

                # 添加计算出的进度到任务
                if total_tasks > 0:
                    task["processed_images"] = completed_tasks + failed_tasks
                    task["progress"] = int((completed_tasks + failed_tasks) / total_tasks * 100)

                    # 检查是否所有子任务都已完成
                    if completed_tasks + failed_tasks == total_tasks:
                        # 更新任务状态为已完成
                        await task_crud.update_task_status(db, task_id, TaskStatus.COMPLETED.value)
                        task["status"] = TaskStatus.COMPLETED.value
                else:
                    task["processed_images"] = 0
                    task["progress"] = 0

    return result

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
    准备任务

    Args:
        task_id: 任务ID

    Returns:
        准备结果
    """
    try:
        logger.info(f"开始准备任务 {task_id} 的子任务")
        db = await get_database()

        # 获取任务
        task_data = await task_crud.get_task(db, task_id)
        if not task_data:
            logger.error(f"找不到任务 {task_id}")
            return {"status": "failed", "error": f"找不到任务 {task_id}"}

        # 计算变量组合
        logger.info(f"开始计算任务 {task_id} 的变量组合")
        combinations = await calculate_combinations(task_id, task_data)
        logger.info(f"任务 {task_id} 共有 {len(combinations)} 个变量组合")

        # 更新任务状态为处理中
        await task_crud.update_task_status(db, task_id, TaskStatus.PROCESSING.value)

        # 使用新的任务处理器创建和提交子任务
        result = await create_and_submit_subtasks(task_id)

        if result.get("status") == "success":
            logger.info(f"任务 {task_id} 已成功创建子任务: {result.get('message')}")
            return result
        else:
            logger.error(f"创建子任务失败: {result.get('error')}")
            await task_crud.update_task_status(db, task_id, TaskStatus.FAILED.value, result.get('error'))
            return result

    except Exception as e:
        logger.error(f"准备任务时出错: {str(e)}")
        try:
            db = await get_database()
            await task_crud.update_task_status(db, task_id, TaskStatus.FAILED.value, str(e))
        except Exception as update_error:
            logger.error(f"更新任务状态时出错: {str(update_error)}")
        return {"status": "failed", "error": str(e)}

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
    # 在这里我们需要实现一个简单的组合计算逻辑
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
    combinations = []
    if var_values:
        for values in itertools.product(*var_values):
            combination = {}
            for i, var_name in enumerate(var_names):
                combination[var_name] = values[i]
            combinations.append(combination)
    else:
        # 如果没有变量，返回一个空组合
        combinations = [{}]

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
    combination: Dict[str, Dict[str, str]]
) -> Tuple[List[str], str, Optional[int], bool]:
    """
    从标签和组合中提取参数

    Args:
        tags: 标签列表
        combination: 变量组合

    Returns:
        提示词、比例、种子和是否使用润色
    """
    try:
        # 记录输入参数
        logger.debug(f"提取参数输入: tags={tags}, combination={combination}")

        # 自己实现提取参数的逻辑
        # 提取提示词
        prompts = []
        ratio = "1:1"  # 默认比例
        seed = random.randint(1, 2147483647)  # 默认随机种子
        use_polish = False  # 默认不使用润色

        # 从组合中提取变量值
        for var_key, var_data in combination.items():
            if var_key.startswith('v') and isinstance(var_data, dict):
                var_value = var_data.get("value", "")
                if var_value:
                    # 将变量值添加到提示词列表
                    prompts.append(var_value)

        # 处理标签
        for tag in tags:
            tag_type = tag.get("type")
            is_variable = tag.get("is_variable", False)

            if tag_type == "prompt":
                # 提示词标签
                if not is_variable:
                    # 固定提示词
                    tag_value = tag.get("value", "")
                    if tag_value:
                        prompts.append(tag_value)

            elif tag_type == "ratio":
                # 比例标签
                ratio = tag.get("value", "1:1")

            elif tag_type == "seed":
                # 种子标签
                try:
                    seed_value = tag.get("value")
                    if seed_value:
                        seed = int(seed_value)
                except (ValueError, TypeError):
                    pass

            elif tag_type == "polish":
                # 润色标签
                use_polish = tag.get("value", "false").lower() == "true"

            elif tag_type == "character":
                # 角色标签
                if not is_variable:
                    tag_value = tag.get("value", "")
                    if tag_value:
                        prompts.append(tag_value)

        result = (prompts, ratio, seed, use_polish)

        # 记录提取结果
        logger.debug(f"提取参数结果: {result}")

        return result
    except Exception as e:
        logger.error(f"提取参数时出错: {str(e)}")
        # 返回默认值
        return [], "1:1", random.randint(1, 2147483647), False