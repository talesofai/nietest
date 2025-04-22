"""
兼容层模块，用于保持与旧代码的兼容性
所有函数都是对 app.crud.subtask 模块中函数的简单包装
"""

from typing import Dict, Any, List, Optional
import logging

from app.crud.subtask import (
    create_subtask,
    get_subtask,
    get_subtask_by_variables,
    get_subtasks_by_parent_id,
    update_subtask,
    update_subtask_status,
    update_subtask_result,
    update_subtask_error,
    delete_subtasks_by_parent_id,
    get_oldest_pending_subtask,
    count_subtasks_by_status
)

logger = logging.getLogger(__name__)

# 兼容性函数
async def create_dramatiq_task(db: Any, task_data: Dict[str, Any]) -> Dict[str, Any]:
    """创建新的Dramatiq任务（兼容层）"""
    logger.debug("使用兼容层函数 create_dramatiq_task")
    return await create_subtask(db, task_data)

async def get_dramatiq_task(db: Any, task_id: str) -> Optional[Dict[str, Any]]:
    """获取Dramatiq任务详情（兼容层）"""
    logger.debug(f"使用兼容层函数 get_dramatiq_task: {task_id}")
    return await get_subtask(db, task_id)

async def get_dramatiq_task_by_variables(db: Any, parent_task_id: str, variable_indices: List[Optional[int]]) -> Optional[Dict[str, Any]]:
    """通过父任务ID和变量索引数组获取Dramatiq任务（兼容层）"""
    logger.debug(f"使用兼容层函数 get_dramatiq_task_by_variables: {parent_task_id}")
    return await get_subtask_by_variables(db, parent_task_id, variable_indices)

async def get_dramatiq_tasks_by_parent_id(db: Any, parent_task_id: str, status: Optional[str] = None) -> List[Dict[str, Any]]:
    """获取父任务的所有Dramatiq任务（兼容层）"""
    logger.debug(f"使用兼容层函数 get_dramatiq_tasks_by_parent_id: {parent_task_id}")
    return await get_subtasks_by_parent_id(db, parent_task_id, status)

async def update_dramatiq_task(db: Any, task_id: str, update_data: Dict[str, Any]) -> Optional[Dict[str, Any]]:
    """更新Dramatiq任务（兼容层）"""
    logger.debug(f"使用兼容层函数 update_dramatiq_task: {task_id}")
    return await update_subtask(db, task_id, update_data)

async def update_dramatiq_task_status(db: Any, task_id: str, status: str) -> bool:
    """更新Dramatiq任务状态（兼容层）"""
    logger.debug(f"使用兼容层函数 update_dramatiq_task_status: {task_id}")
    return await update_subtask_status(db, task_id, status)

async def update_dramatiq_task_result(db: Any, task_id: str, status: str, result: Dict[str, Any]) -> bool:
    """更新Dramatiq任务结果（兼容层）"""
    logger.debug(f"使用兼容层函数 update_dramatiq_task_result: {task_id}")
    return await update_subtask_result(db, task_id, status, result)

async def update_dramatiq_task_error(db: Any, task_id: str, status: str, error: str) -> bool:
    """更新Dramatiq任务错误（兼容层）"""
    logger.debug(f"使用兼容层函数 update_dramatiq_task_error: {task_id}")
    return await update_subtask_error(db, task_id, status, error)

async def delete_dramatiq_tasks_by_parent_id(db: Any, parent_task_id: str) -> int:
    """删除父任务的所有Dramatiq任务（兼容层）"""
    logger.debug(f"使用兼容层函数 delete_dramatiq_tasks_by_parent_id: {parent_task_id}")
    return await delete_subtasks_by_parent_id(db, parent_task_id)

async def get_oldest_pending_dramatiq_task(db: Any) -> Optional[Dict[str, Any]]:
    """获取最旧的未执行Dramatiq任务（兼容层）"""
    logger.debug("使用兼容层函数 get_oldest_pending_dramatiq_task")
    return await get_oldest_pending_subtask(db)

async def count_dramatiq_tasks_by_status(db: Any, status: str) -> int:
    """计算指定状态的Dramatiq任务数量（兼容层）"""
    logger.debug(f"使用兼容层函数 count_dramatiq_tasks_by_status: {status}")
    return await count_subtasks_by_status(db, status)
