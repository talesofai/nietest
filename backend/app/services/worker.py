from datetime import datetime, timezone
from typing import Dict, Any, Optional, Tuple
import logging

from app.core.config import settings
from app.db.mongodb import get_database
from app.crud import worker as worker_crud
from app.crud import dramatiq_task as dramatiq_task_crud
from app.models.worker import WorkerStatus
from app.models.dramatiq_task import DramatiqTaskStatus

# 配置日志
logger = logging.getLogger(__name__)

async def create_worker() -> Dict[str, Any]:
    """
    创建新Worker

    Returns:
        创建的Worker
    """
    db = await get_database()

    # 创建Worker
    worker = await worker_crud.create_worker(db)

    # 更新Worker管理器
    manager = await worker_crud.get_worker_manager(db)
    await worker_crud.update_worker_manager(db, {
        "active_workers": manager.get("active_workers", 0) + 1,
        "total_workers": manager.get("total_workers", 0) + 1
    })

    # 返回创建的Worker
    return worker

async def get_worker(worker_id: str) -> Optional[Dict[str, Any]]:
    """
    获取Worker详情

    Args:
        worker_id: Worker ID

    Returns:
        Worker详情，如果不存在则返回None
    """
    db = await get_database()
    return await worker_crud.get_worker(db, worker_id)

async def get_worker_by_worker_id(worker_id: str) -> Optional[Dict[str, Any]]:
    """
    通过worker_id获取Worker详情

    Args:
        worker_id: Worker ID

    Returns:
        Worker详情，如果不存在则返回None
    """
    db = await get_database()
    return await worker_crud.get_worker_by_worker_id(db, worker_id)

async def list_workers(
    status: Optional[str] = None,
    page: int = 1,
    page_size: int = 10
) -> Dict[str, Any]:
    """
    获取Worker列表

    Args:
        status: 状态过滤
        page: 页码
        page_size: 每页大小

    Returns:
        Worker列表和分页信息
    """
    db = await get_database()
    return await worker_crud.list_workers(db, status, page, page_size)

async def update_worker_status(worker_id: str, status: str) -> bool:
    """
    更新Worker状态

    Args:
        worker_id: Worker ID
        status: 新状态

    Returns:
        更新是否成功
    """
    db = await get_database()
    return await worker_crud.update_worker_status(db, worker_id, status)

async def increment_worker_task_count(worker_id: str) -> bool:
    """
    增加Worker已处理任务数

    Args:
        worker_id: Worker ID

    Returns:
        更新是否成功
    """
    db = await get_database()
    return await worker_crud.increment_worker_task_count(db, worker_id)

async def terminate_idle_workers(idle_timeout_seconds: int = None) -> int:
    """
    终止空闲超时的Worker

    Args:
        idle_timeout_seconds: 空闲超时秒数，默认60秒

    Returns:
        终止的Worker数量
    """
    db = await get_database()
    # 使用配置参数或默认值
    timeout = idle_timeout_seconds if idle_timeout_seconds is not None else settings.WORKER_IDLE_TIMEOUT
    terminated_count = await worker_crud.terminate_idle_workers(db, timeout)

    if terminated_count > 0:
        # 更新Worker管理器
        manager = await worker_crud.get_worker_manager(db)
        await worker_crud.update_worker_manager(db, {
            "active_workers": max(0, manager.get("active_workers", 0) - terminated_count)
        })

    return terminated_count

async def get_worker_manager() -> Dict[str, Any]:
    """
    获取Worker管理器

    Returns:
        Worker管理器
    """
    db = await get_database()
    return await worker_crud.get_worker_manager(db)

async def update_worker_manager(update_data: Dict[str, Any]) -> bool:
    """
    更新Worker管理器

    Args:
        update_data: 更新数据

    Returns:
        更新是否成功
    """
    db = await get_database()
    return await worker_crud.update_worker_manager(db, update_data)

async def scale_workers() -> Tuple[int, int]:
    """
    根据任务情况动态调整Worker数量

    Returns:
        创建的Worker数量和终止的Worker数量
    """
    db = await get_database()

    # 获取Worker管理器
    manager = await worker_crud.get_worker_manager(db)

    # 获取待处理任务数
    pending_tasks = await dramatiq_task_crud.count_dramatiq_tasks_by_status(db, DramatiqTaskStatus.PENDING.value)

    # 更新待处理任务数
    await worker_crud.update_worker_manager(db, {
        "pending_tasks": pending_tasks
    })

    # 终止空闲超时的Worker
    terminated_count = await terminate_idle_workers()

    # 检查是否需要增加Worker
    active_workers = manager.get("active_workers", 0)
    max_workers = settings.WORKER_MAX_COUNT
    last_scale_up_at = manager.get("last_scale_up_at")

    # 如果没有待处理任务，不需要增加Worker
    if pending_tasks == 0:
        return 0, terminated_count

    # 检查是否可以增加Worker
    can_scale_up = True
    if active_workers >= max_workers:
        can_scale_up = False
    elif last_scale_up_at:
        time_since_last_scale = (datetime.now(timezone.utc) - last_scale_up_at).total_seconds()
        can_scale_up = time_since_last_scale >= settings.WORKER_SCALE_INTERVAL

    # 检查是否应该增加Worker
    should_scale_up = False
    if active_workers == 0:
        should_scale_up = True
    else:
        should_scale_up = pending_tasks > active_workers * settings.WORKER_SCALE_THRESHOLD

    # 如果可以且应该增加Worker，创建新Worker
    created_count = 0
    if can_scale_up and should_scale_up:
        # 计算需要创建的Worker数量
        to_create = min(settings.WORKER_MAX_SCALE_PER_INTERVAL, max_workers - active_workers)

        # 创建Worker
        for _ in range(to_create):
            await create_worker()
            created_count += 1

        # 更新上次增加时间
        await worker_crud.update_worker_manager(db, {
            "last_scale_up_at": datetime.now(timezone.utc)
        })

    return created_count, terminated_count

async def get_next_task_for_worker(worker_id: str) -> Optional[Dict[str, Any]]:
    """
    获取Worker的下一个任务

    Args:
        worker_id: Worker ID

    Returns:
        任务详情，如果没有任务则返回None
    """
    db = await get_database()

    # 获取Worker
    worker = await worker_crud.get_worker_by_worker_id(db, worker_id)

    if not worker:
        logger.error(f"找不到Worker {worker_id}")
        return None

    # 如果Worker已终止，不分配任务
    if worker.get("status") == WorkerStatus.TERMINATED.value:
        logger.warning(f"Worker {worker_id} 已终止，不分配任务")
        return None

    # 获取最旧的未执行任务
    task = await dramatiq_task_crud.get_oldest_pending_dramatiq_task(db)

    if not task:
        # 如果没有待处理任务，将Worker标记为空闲
        await worker_crud.update_worker_status(db, worker["id"], WorkerStatus.IDLE.value)
        return None

    # 将Worker标记为忙碌
    await worker_crud.update_worker_status(db, worker["id"], WorkerStatus.BUSY.value)

    return task

async def complete_task_for_worker(worker_id: str) -> bool:
    """
    完成Worker的任务

    Args:
        worker_id: Worker ID

    Returns:
        完成是否成功
    """
    db = await get_database()

    # 获取Worker
    worker = await worker_crud.get_worker_by_worker_id(db, worker_id)

    if not worker:
        logger.error(f"找不到Worker {worker_id}")
        return False

    # 增加Worker已处理任务数
    await worker_crud.increment_worker_task_count(db, worker["id"])

    # 将Worker标记为空闲
    await worker_crud.update_worker_status(db, worker["id"], WorkerStatus.IDLE.value)

    return True

async def fail_task_for_worker(worker_id: str) -> bool:
    """
    标记Worker的任务为失败

    Args:
        worker_id: Worker ID

    Returns:
        标记是否成功
    """
    db = await get_database()

    # 获取Worker
    worker = await worker_crud.get_worker_by_worker_id(db, worker_id)

    if not worker:
        logger.error(f"找不到Worker {worker_id}")
        return False

    # 将Worker标记为空闲
    await worker_crud.update_worker_status(db, worker["id"], WorkerStatus.IDLE.value)

    return True
