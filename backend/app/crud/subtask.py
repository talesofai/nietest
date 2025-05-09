from datetime import datetime, timezone
from typing import Dict, Any, List, Optional
from bson import ObjectId

from app.models.subtask import SubTaskStatus
from app.utils.timezone import get_beijing_now

import uuid

async def create_subtask(db: Any, task_data: Dict[str, Any]) -> Dict[str, Any]:
    """
    创建新的子任务

    Args:
        db: 数据库连接
        task_data: 任务数据

    Returns:
        创建的子任务
    """
    # 使用提供的ID或生成新的UUID
    task_id = task_data.get("id") or str(uuid.uuid4())

    # 准备任务数据
    # 构建变量索引数组
    variable_indices = task_data.get("variable_indices", [None] * 6)

    # 变量类型映射，使类型不与位置绑定
    variable_types_map = task_data.get("variable_types_map", {})
    type_to_variable = task_data.get("type_to_variable", {})

    task = {
        "id": task_id,  # 使用提供的ID或UUID作为主键
        "parent_task_id": task_data.get("parent_task_id"),
        "variable_indices": variable_indices,  # 使用变量索引数组
        "variable_types_map": variable_types_map,  # 变量类型映射
        "type_to_variable": type_to_variable,  # 类型到变量的映射
        "status": task_data.get("status", SubTaskStatus.PENDING.value),
        "result": task_data.get("result"),
        "error": task_data.get("error"),
        "retry_count": task_data.get("retry_count", 0),
        "prompts": task_data.get("prompts", []),  # 使用单一的prompts字段
        "ratio": task_data.get("ratio", "1:1"),
        "seed": task_data.get("seed"),
        "use_polish": task_data.get("use_polish", False),
        "created_at": get_beijing_now(),
        "updated_at": get_beijing_now()
    }

    # 插入任务
    await db.dramatiq_tasks.insert_one(task)

    # 返回创建的任务
    created_task = await get_subtask(db, task_id)
    return created_task

async def get_subtask(db: Any, task_id: str) -> Optional[Dict[str, Any]]:
    """
    获取子任务详情

    Args:
        db: 数据库连接
        task_id: 任务ID

    Returns:
        子任务详情，如果不存在则返回None
    """
    # 查询任务
    task = await db.dramatiq_tasks.find_one({"id": task_id})  # 直接使用id字段查询

    return task

async def get_subtask_by_variables(db: Any, parent_task_id: str, variable_indices: List[Optional[int]]) -> Optional[Dict[str, Any]]:
    """
    通过父任务ID和变量索引数组获取子任务

    Args:
        db: 数据库连接
        parent_task_id: 父任务ID
        variable_indices: 变量索引数组，最多六个元素，对应v0-v5

    Returns:
        匹配的子任务，如果不存在则返回None
    """
    # 构建查询条件
    query = {"parent_task_id": parent_task_id}

    # 添加变量索引数组条件
    # MongoDB中数组元素的精确匹配需要使用$elemMatch或精确的位置查询
    # 这里我们使用精确的位置查询
    for i, value in enumerate(variable_indices):
        if value is not None:
            query[f"variable_indices.{i}"] = value

    # 查询任务
    task = await db.dramatiq_tasks.find_one(query)

    return task


async def get_subtasks_by_parent_id(
    db: Any,
    parent_task_id: str,
    status: Optional[str] = None
) -> List[Dict[str, Any]]:
    """
    获取父任务的所有子任务

    Args:
        db: 数据库连接
        parent_task_id: 父任务ID
        status: 状态过滤（可选）

    Returns:
        子任务列表
    """
    # 构建查询条件
    query = {"parent_task_id": parent_task_id}

    if status:
        query["status"] = status

    # 查询任务
    cursor = db.dramatiq_tasks.find(query)
    tasks = await cursor.to_list(length=None)

    return tasks

async def update_subtask(db: Any, task_id: str, update_data: Dict[str, Any]) -> Optional[Dict[str, Any]]:
    """
    更新子任务

    Args:
        db: 数据库连接
        task_id: 任务ID
        update_data: 更新数据

    Returns:
        更新后的子任务，如果不存在则返回None
    """
    # 添加更新时间
    update_data["updated_at"] = get_beijing_now()

    # 更新任务
    result = await db.dramatiq_tasks.update_one(
        {"id": task_id},  # 直接使用id字段查询
        {"$set": update_data}
    )

    if result.modified_count == 0:
        return None

    # 获取更新后的任务
    updated_task = await get_subtask(db, task_id)
    return updated_task

async def update_subtask_status(db: Any, task_id: str, status: str) -> bool:
    """
    更新子任务状态

    Args:
        db: 数据库连接
        task_id: 任务ID
        status: 新状态

    Returns:
        更新是否成功
    """
    # 更新任务
    result = await db.dramatiq_tasks.update_one(
        {"id": task_id},  # 直接使用id字段查询
        {
            "$set": {
                "status": status,
                "updated_at": get_beijing_now()
            }
        }
    )

    return result.modified_count > 0

async def update_subtask_result(db: Any, task_id: str, status: str, result: Dict[str, Any]) -> bool:
    """
    更新子任务结果

    Args:
        db: 数据库连接
        task_id: 任务ID
        status: 新状态
        result: 结果数据

    Returns:
        更新是否成功
    """
    # 获取任务信息，以获取父任务ID
    task = await get_subtask(db, task_id)
    if not task:
        return False

    # 更新任务
    update_result = await db.dramatiq_tasks.update_one(
        {"id": task_id},  # 直接使用id字段查询
        {
            "$set": {
                "status": status,
                "result": result,
                "updated_at": get_beijing_now()
            }
        }
    )

    # 如果更新成功且状态为已完成，增加父任务的完成计数
    if update_result.modified_count > 0 and status == SubTaskStatus.COMPLETED.value:
        parent_task_id = task.get("parent_task_id")
        if parent_task_id:
            # 导入父任务的increment_processed_images函数
            from app.crud.task import increment_processed_images
            # 增加父任务的已处理图片数
            await increment_processed_images(db, parent_task_id)

    return update_result.modified_count > 0

async def update_subtask_error(db: Any, task_id: str, status: str, error: str) -> bool:
    """
    更新子任务错误

    Args:
        db: 数据库连接
        task_id: 任务ID
        status: 新状态
        error: 错误信息

    Returns:
        更新是否成功
    """
    # 获取任务信息，以获取父任务ID
    task = await get_subtask(db, task_id)
    if not task:
        return False

    # 更新任务
    result = await db.dramatiq_tasks.update_one(
        {"id": task_id},  # 直接使用id字段查询
        {
            "$set": {
                "status": status,
                "error": error,
                "updated_at": get_beijing_now()
            },
            "$inc": {
                "retry_count": 1
            }
        }
    )

    # 如果更新成功且状态为失败，增加父任务的完成计数
    if result.modified_count > 0 and status == SubTaskStatus.FAILED.value:
        parent_task_id = task.get("parent_task_id")
        if parent_task_id:
            # 导入父任务的increment_processed_images函数
            from app.crud.task import increment_processed_images
            # 增加父任务的已处理图片数
            await increment_processed_images(db, parent_task_id)

    return result.modified_count > 0

async def delete_subtasks_by_parent_id(db: Any, parent_task_id: str) -> int:
    """
    删除父任务的所有子任务

    Args:
        db: 数据库连接
        parent_task_id: 父任务ID

    Returns:
        删除的任务数量
    """
    # 删除任务
    result = await db.dramatiq_tasks.delete_many({"parent_task_id": parent_task_id})
    return result.deleted_count

async def get_oldest_pending_subtask(db: Any) -> Optional[Dict[str, Any]]:
    """
    获取最旧的未执行任务

    Args:
        db: 数据库连接

    Returns:
        最旧的未执行任务，如果没有则返回None
    """
    # 查询最旧的未执行任务
    task = await db.dramatiq_tasks.find_one(
        {"status": SubTaskStatus.PENDING.value},
        sort=[("created_at", 1)]
    )

    return task

async def count_subtasks_by_status(db: Any, status: str) -> int:
    """
    计算指定状态的子任务数量

    Args:
        db: 数据库连接
        status: 任务状态

    Returns:
        任务数量
    """
    # 计算任务数量
    count = await db.dramatiq_tasks.count_documents({"status": status})
    return count
