from datetime import datetime
from typing import Dict, Any, List, Optional, Union
from bson import ObjectId
import uuid

from app.models.task import TaskStatus
from app.schemas.task import TaskCreate, TaskUpdate

async def create_task(db: Any, task_data: Dict[str, Any]) -> Dict[str, Any]:
    """
    创建新任务

    Args:
        db: 数据库连接
        task_data: 任务数据

    Returns:
        创建的任务
    """
    # 生成任务UUID
    task_uuid = str(uuid.uuid4())

    # 计算图片总数
    total_images = 1
    variables = task_data.get("variables", {})

    # 处理变量，添加values_count字段
    processed_variables = {}
    for var_key, var_data in variables.items():
        if var_key.startswith('v'):
            # 复制变量数据
            processed_var = var_data.copy() if isinstance(var_data, dict) else {"name": "", "values": []}

            # 计算值数量
            values = processed_var.get("values", [])
            values_count = len(values) if values else 0

            # 添加values_count字段
            processed_var["values_count"] = values_count

            # 如果有值，计算总图片数
            if values_count > 0:
                total_images *= values_count

            processed_variables[var_key] = processed_var

    # 准备任务数据
    task = {
        "task_uuid": task_uuid,
        "task_name": task_data.get("task_name", "无标题任务"),
        "username": task_data.get("username", ""),
        "tags": task_data.get("tags", []),
        "variables": processed_variables,  # 使用处理后的变量
        "settings": task_data.get("settings", {}),
        "status": TaskStatus.PENDING.value,
        "created_at": datetime.utcnow(),
        "updated_at": datetime.utcnow(),
        "total_images": total_images,  # 设置计算出的图片总数
        "processed_images": 0,
        "progress": 0,
        "is_deleted": False,
        "priority": task_data.get("priority", 1)
    }

    # 插入任务
    result = await db.tasks.insert_one(task)
    task_id = str(result.inserted_id)

    # 返回创建的任务
    created_task = await get_task(db, task_id)
    return created_task

async def get_task(db: Any, task_id: str) -> Optional[Dict[str, Any]]:
    """
    获取任务详情

    Args:
        db: 数据库连接
        task_id: 任务ID

    Returns:
        任务详情，如果不存在则返回None
    """
    # 查询任务
    task = await db.tasks.find_one({"_id": ObjectId(task_id)})

    if task:
        # 转换ID为字符串
        task["id"] = str(task.pop("_id"))

    return task

async def get_task_by_uuid(db: Any, task_uuid: str) -> Optional[Dict[str, Any]]:
    """
    通过UUID获取任务详情

    Args:
        db: 数据库连接
        task_uuid: 任务UUID

    Returns:
        任务详情，如果不存在则返回None
    """
    # 查询任务
    task = await db.tasks.find_one({"task_uuid": task_uuid})

    if task:
        # 转换ID为字符串
        task["id"] = str(task.pop("_id"))

    return task

async def list_tasks(
    db: Any,
    username: Optional[str] = None,
    status: Optional[str] = None,
    page: int = 1,
    page_size: int = 10
) -> Dict[str, Any]:
    """
    获取任务列表

    Args:
        db: 数据库连接
        username: 用户名过滤
        status: 状态过滤
        page: 页码
        page_size: 每页大小

    Returns:
        任务列表和分页信息
    """
    # 构建查询条件
    query = {"is_deleted": False}

    if username:
        query["username"] = username

    if status:
        query["status"] = status

    # 计算总数
    total = await db.tasks.count_documents(query)

    # 计算分页
    skip = (page - 1) * page_size

    # 查询任务
    cursor = db.tasks.find(query).sort("created_at", -1).skip(skip).limit(page_size)
    tasks = await cursor.to_list(length=page_size)

    # 转换ID为字符串
    for task in tasks:
        task["id"] = str(task.pop("_id"))

    return {
        "items": tasks,
        "total": total,
        "page": page,
        "page_size": page_size
    }

async def update_task(db: Any, task_id: str, update_data: Dict[str, Any]) -> Optional[Dict[str, Any]]:
    """
    更新任务

    Args:
        db: 数据库连接
        task_id: 任务ID
        update_data: 更新数据

    Returns:
        更新后的任务，如果不存在则返回None
    """
    # 添加更新时间
    update_data["updated_at"] = datetime.utcnow()

    # 更新任务
    result = await db.tasks.update_one(
        {"_id": ObjectId(task_id)},
        {"$set": update_data}
    )

    if result.modified_count == 0:
        return None

    # 获取更新后的任务
    updated_task = await get_task(db, task_id)
    return updated_task

async def update_task_status(db: Any, task_id: str, status: str, error: Optional[str] = None) -> bool:
    """
    更新任务状态

    Args:
        db: 数据库连接
        task_id: 任务ID
        status: 新状态
        error: 错误信息（可选）

    Returns:
        更新是否成功
    """
    # 准备更新数据
    update_data = {
        "status": status,
        "updated_at": datetime.utcnow()
    }

    if error:
        update_data["error"] = error

    # 如果状态是已完成，更新进度
    if status == TaskStatus.COMPLETED.value:
        task = await get_task(db, task_id)
        if task:
            update_data["progress"] = 100
            update_data["processed_images"] = task.get("total_images", 0)

    # 更新任务
    result = await db.tasks.update_one(
        {"_id": ObjectId(task_id)},
        {"$set": update_data}
    )

    return result.modified_count > 0

async def update_task_progress(db: Any, task_id: str, processed_images: int, progress: int) -> bool:
    """
    更新任务进度

    Args:
        db: 数据库连接
        task_id: 任务ID
        processed_images: 已处理图片数
        progress: 进度百分比

    Returns:
        更新是否成功
    """
    # 更新任务
    result = await db.tasks.update_one(
        {"_id": ObjectId(task_id)},
        {
            "$set": {
                "processed_images": processed_images,
                "progress": progress,
                "updated_at": datetime.utcnow()
            }
        }
    )

    return result.modified_count > 0

async def update_task_total_images(db: Any, task_id: str, total_images: int) -> bool:
    """
    更新任务的图片总数

    Args:
        db: 数据库连接
        task_id: 任务ID
        total_images: 图片总数

    Returns:
        更新是否成功
    """
    # 更新任务
    result = await db.tasks.update_one(
        {"_id": ObjectId(task_id)},
        {
            "$set": {
                "total_images": total_images,
                "updated_at": datetime.utcnow()
            }
        }
    )

    return result.modified_count > 0

async def cancel_task(db: Any, task_id: str) -> bool:
    """
    取消任务

    Args:
        db: 数据库连接
        task_id: 任务ID

    Returns:
        取消是否成功
    """
    return await update_task_status(db, task_id, TaskStatus.CANCELLED.value)

async def delete_task(db: Any, task_id: str) -> bool:
    """
    删除任务（标记为已删除）

    Args:
        db: 数据库连接
        task_id: 任务ID

    Returns:
        删除是否成功
    """
    # 更新任务
    result = await db.tasks.update_one(
        {"_id": ObjectId(task_id)},
        {
            "$set": {
                "is_deleted": True,
                "updated_at": datetime.utcnow()
            }
        }
    )

    return result.modified_count > 0
