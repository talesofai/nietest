"""
兼容层 - 已废弃

此模块仅为兼容性而保留，请使用 app.crud.subtask 模块替代
"""

from typing import Dict, Any, List, Optional

from app.crud.subtask import (
    create_subtask, get_subtask, get_subtask_by_variables, get_subtasks_by_parent_id,
    update_subtask, update_subtask_status, update_subtask_result, update_subtask_error,
    delete_subtasks_by_parent_id, get_oldest_pending_subtask, count_subtasks_by_status
)

# 兼容函数
async def create_dramatiq_task(db: Any, task_data: Dict[str, Any]) -> Dict[str, Any]:
    """
    创建新的Dramatiq任务 - 已废弃
    请使用 create_subtask 替代

    Args:
        db: 数据库连接
        task_data: 任务数据

    Returns:
        创建的任务
    """
    return await create_subtask(db, task_data)

async def get_dramatiq_task(db: Any, task_id: str) -> Optional[Dict[str, Any]]:
    """
    获取Dramatiq任务详情 - 已废弃
    请使用 get_subtask 替代

    Args:
        db: 数据库连接
        task_id: 任务ID

    Returns:
        任务详情，如果不存在则返回None
    """
    return await get_subtask(db, task_id)

async def get_dramatiq_task_by_variables(db: Any, parent_task_id: str, variable_indices: List[Optional[int]]) -> Optional[Dict[str, Any]]:
    """
    通过父任务ID和变量索引数组获取Dramatiq任务 - 已废弃
    请使用 get_subtask_by_variables 替代

    Args:
        db: 数据库连接
        parent_task_id: 父任务ID
        variable_indices: 变量索引数组，最多六个元素，对应v0-v5

    Returns:
        匹配的任务，如果不存在则返回None
    """
    return await get_subtask_by_variables(db, parent_task_id, variable_indices)


async def get_dramatiq_tasks_by_parent_id(
    db: Any,
    parent_task_id: str,
    status: Optional[str] = None
) -> List[Dict[str, Any]]:
    """
    获取父任务的所有Dramatiq子任务 - 已废弃
    请使用 get_subtasks_by_parent_id 替代

    Args:
        db: 数据库连接
        parent_task_id: 父任务ID
        status: 状态过滤（可选）

    Returns:
        任务列表
    """
    return await get_subtasks_by_parent_id(db, parent_task_id, status)

async def update_dramatiq_task(db: Any, task_id: str, update_data: Dict[str, Any]) -> Optional[Dict[str, Any]]:
    """
    更新Dramatiq任务 - 已废弃
    请使用 update_subtask 替代

    Args:
        db: 数据库连接
        task_id: 任务ID
        update_data: 更新数据

    Returns:
        更新后的任务，如果不存在则返回None
    """
    return await update_subtask(db, task_id, update_data)

async def update_dramatiq_task_status(db: Any, task_id: str, status: str) -> bool:
    """
    更新Dramatiq任务状态 - 已废弃
    请使用 update_subtask_status 替代

    Args:
        db: 数据库连接
        task_id: 任务ID
        status: 新状态

    Returns:
        更新是否成功
    """
    return await update_subtask_status(db, task_id, status)

async def update_dramatiq_task_result(db: Any, task_id: str, status: str, result: Dict[str, Any]) -> bool:
    """
    更新Dramatiq任务结果 - 已废弃
    请使用 update_subtask_result 替代

    Args:
        db: 数据库连接
        task_id: 任务ID
        status: 新状态
        result: 结果数据

    Returns:
        更新是否成功
    """
    return await update_subtask_result(db, task_id, status, result)

async def update_dramatiq_task_error(db: Any, task_id: str, status: str, error: str) -> bool:
    """
    更新Dramatiq任务错误 - 已废弃
    请使用 update_subtask_error 替代

    Args:
        db: 数据库连接
        task_id: 任务ID
        status: 新状态
        error: 错误信息

    Returns:
        更新是否成功
    """
    return await update_subtask_error(db, task_id, status, error)

async def delete_dramatiq_tasks_by_parent_id(db: Any, parent_task_id: str) -> int:
    """
    删除父任务的所有Dramatiq子任务 - 已废弃
    请使用 delete_subtasks_by_parent_id 替代

    Args:
        db: 数据库连接
        parent_task_id: 父任务ID

    Returns:
        删除的任务数量
    """
    return await delete_subtasks_by_parent_id(db, parent_task_id)

async def get_oldest_pending_dramatiq_task(db: Any) -> Optional[Dict[str, Any]]:
    """
    获取最旧的未执行任务 - 已废弃
    请使用 get_oldest_pending_subtask 替代

    Args:
        db: 数据库连接

    Returns:
        最旧的未执行任务，如果没有则返回None
    """
    return await get_oldest_pending_subtask(db)

async def count_dramatiq_tasks_by_status(db: Any, status: str) -> int:
    """
    计算指定状态的Dramatiq任务数量 - 已废弃
    请使用 count_subtasks_by_status 替代

    Args:
        db: 数据库连接
        status: 任务状态

    Returns:
        任务数量
    """
    return await count_subtasks_by_status(db, status)
