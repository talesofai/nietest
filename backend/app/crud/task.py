from datetime import datetime, timezone
from typing import Dict, Any, List, Optional
import uuid
import logging

from app.db.redis import get_redis_cache
from app.core.config import settings

from app.models.task import TaskStatus

# 配置日志
logger = logging.getLogger(__name__)

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
        "task_name": task_data.get("task_name"),
        "username": task_data.get("username"),
        "tags": task_data.get("tags"),
        "variables": processed_variables,
        "settings": task_data.get("settings"),
        "status": TaskStatus.PENDING.value,
        "created_at": datetime.now(timezone.utc),
        "updated_at": datetime.now(timezone.utc),
        "total_images": total_images,  # 设置计算出的图片总数
        "processed_images": 0,  # 初始化已处理图片数
        "progress": 0,  # 初始化进度
        "all_subtasks_completed": False,
        "is_deleted": False,
        "priority": task_data.get("priority", 1)
    }

    # 插入任务
    await db.tasks.insert_one(task)

    # 返回创建的任务
    created_task = await get_task(db, task_id)

    # 如果created_task不为None，移除processed_images和progress字段，以避免与默认值冲突
    if created_task:
        if "processed_images" in created_task:
            del created_task["processed_images"]
        if "progress" in created_task:
            del created_task["progress"]

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
    task_name: Optional[str] = None,
    page: int = 1,
    page_size: int = 10,
    created_before: Optional[datetime] = None
) -> Dict[str, Any]:
    """
    获取任务列表

    Args:
        db: 数据库连接
        username: 用户名过滤
        status: 状态过滤
        task_name: 任务名称搜索
        page: 页码
        page_size: 每页大小
        created_before: 创建时间在此之前（可选）

    Returns:
        任务列表和分页信息
    """
    # 构建查询条件
    query = {}

    # 只包含未删除的任务，但如果没有is_deleted字段也包含
    query["$or"] = [{"is_deleted": False}, {"is_deleted": {"$exists": False}}]

    if username:
        query["username"] = username

    if status:
        # 处理多状态查询，如果状态包含逗号，则拆分为多个状态
        if "," in status:
            status_list = status.split(",")
            query["status"] = {"$in": status_list}
        else:
            query["status"] = status

    # 添加任务名称搜索条件
    if task_name:
        # 使用正则表达式进行模糊搜索，忽略大小写
        query["task_name"] = {"$regex": task_name, "$options": "i"}

    # 添加创建时间过滤
    if created_before:
        query["created_at"] = {"$lt": created_before}

    # 记录查询条件
    logger.info(f"任务列表查询条件: {query}")

    # 计算总数
    total = await db.tasks.count_documents(query)
    logger.info(f"查询到 {total} 个任务")

    # 计算分页
    skip = (page - 1) * page_size

    # 查询任务
    cursor = db.tasks.find(query).sort("created_at", -1).skip(skip).limit(page_size)
    tasks = await cursor.to_list(length=page_size)

    # 记录查询结果
    logger.info(f"返回 {len(tasks)} 个任务")
    if tasks:
        logger.info(f"第一个任务ID: {tasks[0].get('id')}, 状态: {tasks[0].get('status')}")

    # 对每个任务计算进度
    # 在函数内部导入，避免循环导入
    from app.models.subtask import SubTaskStatus

    for task in tasks:
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
            # 在这里导入，避免循环导入
            from app.crud.dramatiq_task import get_dramatiq_tasks_by_parent_id
            # 获取子任务
            all_dramatiq_tasks = await get_dramatiq_tasks_by_parent_id(db, task_id)

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
                    await update_task_status(db, task_id, TaskStatus.COMPLETED.value)
                    task["status"] = TaskStatus.COMPLETED.value
                    logger.info(f"任务 {task_id} 已完成，更新状态")
            else:
                # 如果没有子任务，设置进度为0
                task["processed_images"] = 0
                task["progress"] = 0

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

async def update_task_progress(db: Any, task_id: str, processed_images: int, total_images: int) -> bool:
    """
    更新任务的进度信息

    Args:
        db: 数据库连接
        task_id: 任务ID
        processed_images: 已处理图片数
        total_images: 图片总数

    Returns:
        更新是否成功
    """
    # 计算进度百分比
    progress = 0
    if total_images > 0:
        progress = int((processed_images / total_images) * 100)

    # 更新任务
    result = await db.tasks.update_one(
        {"id": task_id},  # 直接使用id字段查询
        {
            "$set": {
                "processed_images": processed_images,
                "progress": progress,
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

async def increment_processed_images(db: Any, task_id: str) -> bool:
    """
    增加任务的已处理图片数量

    Args:
        db: 数据库连接
        task_id: 任务ID

    Returns:
        更新是否成功
    """
    # 获取当前任务信息
    task = await get_task(db, task_id)
    if not task:
        return False

    # 获取当前已处理图片数和总图片数
    current_processed = task.get("processed_images", 0)
    total_images = task.get("total_images", 0)

    # 增加已处理图片数
    new_processed = current_processed + 1

    # 计算新的进度百分比
    progress = 0
    if total_images > 0:
        progress = int((new_processed / total_images) * 100)

    # 更新任务
    result = await db.tasks.update_one(
        {"id": task_id},  # 直接使用id字段查询
        {
            "$set": {
                "processed_images": new_processed,
                "progress": progress,
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
