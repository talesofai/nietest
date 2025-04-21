"""
Worker CRUD 操作模块

该模块提供Worker和WorkerManager的数据库操作。
"""

from typing import Dict, Any, List, Optional, Union
from datetime import datetime, timezone, timedelta
import uuid
from bson import ObjectId

from app.models.worker import Worker, WorkerManager, WorkerStatus

# Worker集合名称
WORKER_COLLECTION = "workers"
# Worker管理器集合名称
WORKER_MANAGER_COLLECTION = "worker_manager"
# Worker管理器ID
WORKER_MANAGER_ID = "worker_manager"

async def create_worker(db: Any, worker_id: str = None) -> Dict[str, Any]:
    """
    创建Worker

    Args:
        db: 数据库连接
        worker_id: Worker ID，如果为None则自动生成

    Returns:
        创建的Worker
    """
    # 生成Worker ID
    if not worker_id:
        worker_id = str(uuid.uuid4())

    # 创建Worker
    worker = Worker(
        worker_id=worker_id,
        status=WorkerStatus.IDLE,
        created_at=datetime.now(timezone.utc),
        updated_at=datetime.now(timezone.utc),
        last_active_at=datetime.now(timezone.utc),
        task_count=0,
        current_task_id=None
    )

    # 插入数据库
    worker_dict = worker.dict()
    result = await db[WORKER_COLLECTION].insert_one(worker_dict)

    # 获取创建的Worker
    created_worker = await db[WORKER_COLLECTION].find_one({"_id": result.inserted_id})
    if created_worker:
        created_worker["id"] = str(created_worker.pop("_id"))

    return created_worker

async def get_worker(db: Any, worker_id: str) -> Optional[Dict[str, Any]]:
    """
    获取Worker

    Args:
        db: 数据库连接
        worker_id: Worker ID

    Returns:
        Worker，如果不存在则返回None
    """
    worker = await db[WORKER_COLLECTION].find_one({"_id": ObjectId(worker_id)})
    if worker:
        worker["id"] = str(worker.pop("_id"))
    return worker

async def get_worker_by_worker_id(db: Any, worker_id: str) -> Optional[Dict[str, Any]]:
    """
    通过worker_id获取Worker

    Args:
        db: 数据库连接
        worker_id: Worker ID

    Returns:
        Worker，如果不存在则返回None
    """
    worker = await db[WORKER_COLLECTION].find_one({"worker_id": worker_id})
    if worker:
        worker["id"] = str(worker.pop("_id"))
    return worker

async def list_workers(
    db: Any,
    status: Optional[str] = None,
    page: int = 1,
    page_size: int = 10
) -> Dict[str, Any]:
    """
    获取Worker列表

    Args:
        db: 数据库连接
        status: 状态过滤
        page: 页码
        page_size: 每页大小

    Returns:
        Worker列表和分页信息
    """
    # 构建查询条件
    query = {}
    if status:
        query["status"] = status

    # 计算总数
    total = await db[WORKER_COLLECTION].count_documents(query)

    # 计算分页
    skip = (page - 1) * page_size

    # 查询数据
    cursor = db[WORKER_COLLECTION].find(query).sort("created_at", -1).skip(skip).limit(page_size)
    workers = await cursor.to_list(length=page_size)

    # 转换ID为字符串
    for worker in workers:
        worker["id"] = str(worker.pop("_id"))

    # 构建结果
    result = {
        "items": workers,
        "total": total,
        "page": page,
        "page_size": page_size,
        "pages": (total + page_size - 1) // page_size
    }

    return result

async def update_worker_status(db: Any, worker_id: str, status: str) -> bool:
    """
    更新Worker状态

    Args:
        db: 数据库连接
        worker_id: Worker ID
        status: 新状态

    Returns:
        更新是否成功
    """
    # 更新状态
    result = await db[WORKER_COLLECTION].update_one(
        {"_id": ObjectId(worker_id)},
        {
            "$set": {
                "status": status,
                "updated_at": datetime.now(timezone.utc),
                "last_active_at": datetime.now(timezone.utc)
            }
        }
    )

    return result.modified_count > 0

async def increment_worker_task_count(db: Any, worker_id: str) -> bool:
    """
    增加Worker已处理任务数

    Args:
        db: 数据库连接
        worker_id: Worker ID

    Returns:
        更新是否成功
    """
    # 增加任务数
    result = await db[WORKER_COLLECTION].update_one(
        {"_id": ObjectId(worker_id)},
        {
            "$inc": {"task_count": 1},
            "$set": {
                "updated_at": datetime.now(timezone.utc),
                "last_active_at": datetime.now(timezone.utc)
            }
        }
    )

    return result.modified_count > 0

async def terminate_idle_workers(db: Any, idle_timeout_seconds: int = 60) -> int:
    """
    终止空闲超时的Worker

    Args:
        db: 数据库连接
        idle_timeout_seconds: 空闲超时秒数

    Returns:
        终止的Worker数量
    """
    # 计算超时时间
    current_time = datetime.now(timezone.utc)
    idle_datetime = current_time - timedelta(seconds=idle_timeout_seconds)

    # 查询空闲超时的Worker
    query = {
        "status": WorkerStatus.IDLE.value,
        "last_active_at": {"$lt": idle_datetime}
    }

    # 更新状态为已终止
    result = await db[WORKER_COLLECTION].update_many(
        query,
        {
            "$set": {
                "status": WorkerStatus.TERMINATED.value,
                "updated_at": datetime.now(timezone.utc)
            }
        }
    )

    return result.modified_count

async def get_worker_manager(db: Any) -> Dict[str, Any]:
    """
    获取Worker管理器

    Args:
        db: 数据库连接

    Returns:
        Worker管理器，如果不存在则创建
    """
    # 查询Worker管理器
    manager = await db[WORKER_MANAGER_COLLECTION].find_one({"_id": WORKER_MANAGER_ID})

    # 如果不存在，创建默认管理器
    if not manager:
        # 创建默认管理器
        manager = WorkerManager(
            total_workers=0,
            active_workers=0,
            pending_tasks=0,
            updated_at=datetime.now(timezone.utc)
        )

        # 插入数据库
        manager_dict = manager.dict()
        manager_dict["_id"] = WORKER_MANAGER_ID
        await db[WORKER_MANAGER_COLLECTION].insert_one(manager_dict)

        # 获取创建的管理器
        manager = await db[WORKER_MANAGER_COLLECTION].find_one({"_id": WORKER_MANAGER_ID})

    # 转换ID为字符串
    if manager:
        manager["id"] = str(manager.pop("_id"))

    return manager

async def update_worker_manager(db: Any, update_data: Dict[str, Any]) -> bool:
    """
    更新Worker管理器

    Args:
        db: 数据库连接
        update_data: 更新数据

    Returns:
        更新是否成功
    """
    # 添加更新时间
    update_data["updated_at"] = datetime.now(timezone.utc)

    # 更新管理器
    result = await db[WORKER_MANAGER_COLLECTION].update_one(
        {"_id": WORKER_MANAGER_ID},
        {"$set": update_data},
        upsert=True
    )

    return result.modified_count > 0 or result.upserted_id is not None

async def count_active_workers(db: Any) -> int:
    """
    统计活动Worker数量

    Args:
        db: 数据库连接

    Returns:
        活动Worker数量
    """
    # 查询非终止状态的Worker
    query = {"status": {"$ne": WorkerStatus.TERMINATED.value}}

    # 统计数量
    count = await db[WORKER_COLLECTION].count_documents(query)

    return count
