from typing import Dict, Any, Optional
import logging

from app.db.mongodb import get_database
from app.db.redis import get_redis_cache
from app.crud import task as task_crud
from app.crud import dramatiq_task as dramatiq_task_crud
from app.models.task import TaskStatus
from app.models.subtask import SubTaskStatus
from app.services.task_processor import prepare_dramatiq_tasks as processor_prepare_dramatiq_tasks

# 配置日志
logger = logging.getLogger(__name__)

async def clear_all_task_cache():
    """
    清理Redis中的所有任务缓存
    """
    redis_cache = get_redis_cache()
    # 清除所有task:开头的键
    deleted_count = await redis_cache.delete_pattern("task:*")
    logger.info(f"清除了 {deleted_count} 个任务缓存键")
    return deleted_count

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

async def get_task(db: Any, task_id: str) -> Optional[Dict[str, Any]]:
    """
    获取任务详情

    Args:
        db: 数据库连接
        task_id: 任务ID

    Returns:
        任务详情，如果不存在则返回None
    """
    task = await task_crud.get_task(db, task_id)

    if task:
        # 无论任务状态如何，都查询子任务状态并计算进度
        # 获取所有子任务
        all_dramatiq_tasks = await dramatiq_task_crud.get_dramatiq_tasks_by_parent_id(db, task_id)

        # 计算进度
        total_tasks = len(all_dramatiq_tasks)
        completed_tasks = sum(1 for dt in all_dramatiq_tasks if dt.get("status") == SubTaskStatus.COMPLETED.value)
        failed_tasks = sum(1 for dt in all_dramatiq_tasks if dt.get("status") == SubTaskStatus.FAILED.value)

        # 添加计算出的进度到任务
        if total_tasks > 0:
            task["processed_images"] = completed_tasks + failed_tasks
            task["progress"] = int((completed_tasks + failed_tasks) / total_tasks * 100)

            # 如果任务未完成，检查是否所有子任务都已完成
            if task.get("status") != TaskStatus.COMPLETED.value and completed_tasks + failed_tasks == total_tasks:
                # 更新任务状态为已完成
                await task_crud.update_task_status(db, task_id, TaskStatus.COMPLETED.value)
                task["status"] = TaskStatus.COMPLETED.value
        else:
            # 如果没有子任务，但任务状态为已完成，则设置进度为100%
            if task.get("status") == TaskStatus.COMPLETED.value:
                task["processed_images"] = task.get("total_images", 0)
                task["progress"] = 100
            else:
                task["processed_images"] = 0
                task["progress"] = 0

        # 如果任务状态为已完成或处理中，获取结果
        if task.get("status") in [TaskStatus.COMPLETED.value, TaskStatus.PROCESSING.value]:
            # 获取已完成的子任务
            all_dramatiq_tasks = await dramatiq_task_crud.get_dramatiq_tasks_by_parent_id(db, task_id)
            completed_dramatiq_tasks = [dt for dt in all_dramatiq_tasks if dt.get("status") == SubTaskStatus.COMPLETED.value]

            # 整理结果
            raw_results = {}
            for dt in completed_dramatiq_tasks:
                if dt.get("result"):
                    # 提取变量索引
                    v0 = dt.get("v0")
                    v1 = dt.get("v1")
                    v2 = dt.get("v2")
                    v3 = dt.get("v3")
                    v4 = dt.get("v4")
                    v5 = dt.get("v5")

                    # 构建组合键
                    combination_key = dt.get("combination_key", f"v0_{v0}:v1_{v1}")
                    raw_results[combination_key] = dt.get("result")

                    # 将变量索引添加到结果中
                    raw_results[combination_key]["v0"] = v0
                    raw_results[combination_key]["v1"] = v1
                    raw_results[combination_key]["v2"] = v2
                    raw_results[combination_key]["v3"] = v3
                    raw_results[combination_key]["v4"] = v4
                    raw_results[combination_key]["v5"] = v5

            # 转换结果格式为前端期望的格式
            if raw_results:
                # 获取任务变量
                variables = task.get("variables", {})

                # 创建矩阵结果结构
                matrix_results = {}

                # 遍历所有变量
                for var_name, var_data in variables.items():
                    if var_name.startswith('v') and var_data.get("values"):
                        # 创建变量索引映射
                        var_index = int(var_name[1:])
                        var_values = var_data.get("values", [])

                        # 初始化变量结果
                        matrix_results[var_name] = {}

                        # 遍历所有结果
                        for combination_key, result in raw_results.items():
                            # 获取当前变量的索引
                            current_var_index = result.get(var_name)

                            # 如果有效索引
                            if current_var_index is not None and current_var_index < len(var_values):
                                # 获取变量值
                                var_value = var_values[current_var_index].get("value", "")

                                # 将结果添加到矩阵中
                                if var_value not in matrix_results[var_name]:
                                    matrix_results[var_name][var_value] = result.get("url", "")

                # 添加结果到任务
                task["results"] = {
                    "matrix": matrix_results,
                    "raw": raw_results
                }

    return task

async def list_tasks(
    username: Optional[str] = None,
    status: Optional[str] = None,
    task_name: Optional[str] = None,
    page: int = 1,
    page_size: int = 10
) -> Dict[str, Any]:
    """
    获取任务列表

    Args:
        username: 用户名过滤
        status: 状态过滤
        task_name: 任务名称搜索
        page: 页码
        page_size: 每页大小

    Returns:
        任务列表和分页信息
    """
    # 记录查询参数
    logger.info(f"获取任务列表: username={username}, status={status}, task_name={task_name}, page={page}, page_size={page_size}")

    db = await get_database()

    # 查询最新的任务列表
    result = await task_crud.list_tasks(db, username, status, task_name, page, page_size)

    # 记录查询结果
    logger.info(f"任务列表查询结果: 总数={result.get('total', 0)}, 项目数={len(result.get('items', []))}")

    # 对每个任务计算进度
    for task in result.get("items", []):
        # 确保必要字段存在
        if "priority" not in task:
            task["priority"] = 1
        if "total_images" not in task:
            task["total_images"] = 0
        if "processed_images" not in task:
            task["processed_images"] = 0
        if "progress" not in task:
            task["progress"] = 0

        # 获取任务状态
        task_status = task.get("status")
        task_id = task.get("id")

        # 如果任务状态为已完成/失败/取消，则不需要重新计算进度
        if task_status in [TaskStatus.COMPLETED.value, TaskStatus.FAILED.value, TaskStatus.CANCELLED.value]:
            # 如果是已完成状态，确保进度为100%
            if task_status == TaskStatus.COMPLETED.value:
                task["processed_images"] = task.get("total_images", 0)
                task["progress"] = 100
            continue

        # 只对未完成的任务计算进度
        if task_id:
            # 获取子任务
            all_dramatiq_tasks = await dramatiq_task_crud.get_dramatiq_tasks_by_parent_id(db, task_id)

            # 计算进度
            total_tasks = len(all_dramatiq_tasks)
            completed_tasks = sum(1 for dt in all_dramatiq_tasks if dt.get("status") == SubTaskStatus.COMPLETED.value)
            failed_tasks = sum(1 for dt in all_dramatiq_tasks if dt.get("status") == SubTaskStatus.FAILED.value)

            # 记录子任务状态
            logger.debug(f"任务 {task_id} 的子任务状态: 总数={total_tasks}, 已完成={completed_tasks}, 失败={failed_tasks}")

            # 添加计算出的进度到任务
            if total_tasks > 0:
                task["processed_images"] = completed_tasks + failed_tasks
                task["progress"] = int((completed_tasks + failed_tasks) / total_tasks * 100)

                # 如果任务未完成，检查是否所有子任务都已完成
                if completed_tasks + failed_tasks == total_tasks:
                    # 更新任务状态为已完成
                    await task_crud.update_task_status(db, task_id, TaskStatus.COMPLETED.value)
                    task["status"] = TaskStatus.COMPLETED.value
                    logger.info(f"任务 {task_id} 已完成，更新状态")
            else:
                # 如果没有子任务，设置进度为0
                task["processed_images"] = 0
                task["progress"] = 0

        # 记录任务字段
        logger.debug(f"任务 {task_id} 的字段: {list(task.keys())}")

        # 如果任务状态为已完成或处理中，且有完成的子任务，获取结果
        if task_id and task.get("status") in [TaskStatus.COMPLETED.value, TaskStatus.PROCESSING.value] and task.get("processed_images", 0) > 0:
            # 获取子任务（如果还没有获取过）
            if not locals().get('all_dramatiq_tasks'):
                all_dramatiq_tasks = await dramatiq_task_crud.get_dramatiq_tasks_by_parent_id(db, task_id)

            # 获取已完成的子任务
            completed_dramatiq_tasks = [dt for dt in all_dramatiq_tasks if dt.get("status") == SubTaskStatus.COMPLETED.value]

            # 整理结果
            raw_results = {}
            for dt in completed_dramatiq_tasks:
                if dt.get("result"):
                    # 提取变量索引
                    v0 = dt.get("v0")
                    v1 = dt.get("v1")
                    v2 = dt.get("v2")
                    v3 = dt.get("v3")
                    v4 = dt.get("v4")
                    v5 = dt.get("v5")

                    # 构建组合键
                    combination_key = dt.get("combination_key", f"v0_{v0}:v1_{v1}")
                    raw_results[combination_key] = dt.get("result")

                    # 将变量索引添加到结果中
                    raw_results[combination_key]["v0"] = v0
                    raw_results[combination_key]["v1"] = v1
                    raw_results[combination_key]["v2"] = v2
                    raw_results[combination_key]["v3"] = v3
                    raw_results[combination_key]["v4"] = v4
                    raw_results[combination_key]["v5"] = v5

            # 转换结果格式为前端期望的格式
            if raw_results:
                # 获取任务变量
                task_detail = await get_task(db, task_id)
                variables = task_detail.get("variables", {})

                # 创建矩阵结果结构
                matrix_results = {}

                # 遍历所有变量
                for var_name, var_data in variables.items():
                    if var_name.startswith('v') and var_data.get("values"):
                        # 创建变量索引映射
                        var_values = var_data.get("values", [])

                        # 初始化变量结果
                        matrix_results[var_name] = {}

                        # 遍历所有结果
                        for combination_key, result in raw_results.items():
                            # 获取当前变量的索引
                            current_var_index = result.get(var_name)

                            # 如果有效索引
                            if current_var_index is not None and current_var_index < len(var_values):
                                # 获取变量值
                                var_value = var_values[current_var_index].get("value", "")

                                # 将结果添加到矩阵中
                                if var_value not in matrix_results[var_name]:
                                    matrix_results[var_name][var_value] = result.get("url", "")

                # 添加结果到任务
                task["results"] = {
                    "matrix": matrix_results,
                    "raw": raw_results
                }

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
    准备任务 - 包装函数

    此函数是对 app.services.task_processor.prepare_dramatiq_tasks 的包装

    Args:
        task_id: 任务ID

    Returns:
        准备结果
    """
    logger.info(f"调用任务准备函数: {task_id}")
    return await processor_prepare_dramatiq_tasks(task_id)
