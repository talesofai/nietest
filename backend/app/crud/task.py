from datetime import datetime, timezone
from typing import Dict, Any, List, Optional, Union
from bson import ObjectId
import uuid

from app.db.redis import get_redis_cache
from app.core.config import settings

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
    task_id = str(uuid.uuid4())

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
        "id": task_id,  # 使用UUID作为主键
        "task_name": task_data.get("task_name", "无标题任务"),
        "username": task_data.get("username", ""),
        "tags": task_data.get("tags", []),
        "variables": processed_variables,  # 使用处理后的变量
        "settings": task_data.get("settings", {}),
        "status": TaskStatus.PENDING.value,
        "created_at": datetime.now(timezone.utc),
        "updated_at": datetime.now(timezone.utc),
        "total_images": total_images,  # 设置计算出的图片总数
        # 不存储 processed_images 和 progress 字段，在查询时动态计算
        "all_subtasks_completed": False,
        "is_deleted": False,
        "priority": task_data.get("priority", 1)
    }

    # 插入任务
    await db.tasks.insert_one(task)

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
    # 如果启用了缓存，先从缓存中获取
    if settings.CACHE_ENABLED:
        redis_cache = get_redis_cache()
        cache_key = f"task:{task_id}"
        cached_task = await redis_cache.get(cache_key)
        if cached_task:
            return cached_task

    # 查询任务
    task = await db.tasks.find_one({"id": task_id})  # 直接使用id字段查询

    if task and settings.CACHE_ENABLED:
        # 如果启用了缓存，将任务存入缓存
        redis_cache = get_redis_cache()
        cache_key = f"task:{task_id}"
        await redis_cache.set(cache_key, task, settings.CACHE_TASK_TTL)

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
    update_data["updated_at"] = datetime.now(timezone.utc)

    # 更新任务
    result = await db.tasks.update_one(
        {"id": task_id},  # 直接使用id字段查询
        {"$set": update_data}
    )

    if result.modified_count == 0:
        return None

    # 如果启用了缓存，清除缓存
    if settings.CACHE_ENABLED:
        redis_cache = get_redis_cache()
        cache_key = f"task:{task_id}"
        await redis_cache.delete(cache_key)

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
        "updated_at": datetime.now(timezone.utc)
    }

    if error:
        update_data["error"] = error

    # 如果状态是已完成，更新子任务完成状态
    if status == TaskStatus.COMPLETED.value:
        update_data["all_subtasks_completed"] = True

    # 更新任务
    result = await db.tasks.update_one(
        {"id": task_id},  # 直接使用id字段查询
        {"$set": update_data}
    )

    return result.modified_count > 0

async def update_subtasks_completion(db: Any, task_id: str, all_completed: bool) -> bool:
    """
    更新子任务完成状态

    Args:
        db: 数据库连接
        task_id: 任务ID
        all_completed: 所有子任务是否已完成

    Returns:
        更新是否成功
    """
    # 更新任务
    result = await db.tasks.update_one(
        {"id": task_id},  # 直接使用id字段查询
        {
            "$set": {
                "all_subtasks_completed": all_completed,
                "updated_at": datetime.now(timezone.utc)
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
        {"id": task_id},  # 直接使用id字段查询
        {
            "$set": {
                "total_images": total_images,
                "updated_at": datetime.now(timezone.utc)
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
        {"id": task_id},  # 直接使用id字段查询
        {
            "$set": {
                "is_deleted": True,
                "updated_at": datetime.now(timezone.utc)
            }
        }
    )

    # 如果启用了缓存，清除缓存
    if settings.CACHE_ENABLED and result.modified_count > 0:
        redis_cache = get_redis_cache()
        # 清除任务缓存
        await redis_cache.clear_task_cache(task_id)

    return result.modified_count > 0
