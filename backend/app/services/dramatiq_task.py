"""
任务处理服务模块 - 已废弃

注意：此模块大部分功能已移至 app.services.task_processor 模块
仅保留兼容性函数和清理过期任务的功能
"""

from typing import Dict, Any
import logging

from app.db.mongodb import get_database

# 配置日志
logger = logging.getLogger(__name__)

# 此函数已移至 app.services.task_processor 模块
# 请使用 app.services.task_processor.monitor_task_progress 替代
async def monitor_task_progress(task_id: str) -> Dict[str, Any]:
    """
    监控任务进度 - 已废弃
    此函数已移至 app.services.task_processor 模块，请使用那里的版本

    Args:
        task_id: 任务ID

    Returns:
        监控结果
    """
    from app.services.task_processor import monitor_task_progress as new_monitor_task_progress
    logger.warning(f"使用已废弃的 dramatiq_task.monitor_task_progress 函数，请改用 task_processor.monitor_task_progress")
    return await new_monitor_task_progress(task_id)

async def cleanup_expired_task_data() -> Dict[str, Any]:
    """
    清理过期的任务数据

    Returns:
        清理结果
    """
    try:
        # 计算过期时间（30天前）
        from datetime import datetime, timedelta, timezone
        expiration_date = datetime.now(timezone.utc) - timedelta(days=30)

        # 获取数据库连接
        db = await get_database()

        # 查找过期的任务
        from app.crud.task import list_tasks, delete_task
        from app.crud.dramatiq_task import delete_dramatiq_tasks_by_parent_id

        # 获取30天前的任务
        result = await list_tasks(
            db,
            status=None,
            page=1,
            page_size=1000,
            created_before=expiration_date
        )

        expired_tasks = result.get("items", [])
        deleted_count = 0

        # 删除过期任务
        for task in expired_tasks:
            task_id = task.get("id")
            if task_id:
                # 删除任务
                await delete_task(db, task_id)

                # 删除相关的子任务
                await delete_dramatiq_tasks_by_parent_id(db, task_id)

                deleted_count += 1
                logger.info(f"删除过期任务: {task_id}")

        return {
            "deleted_count": deleted_count,
            "expiration_date": expiration_date.isoformat()
        }
    except Exception as e:
        logger.error(f"清理过期任务时出错: {str(e)}")
        raise
