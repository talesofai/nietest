"""
Dramatiq任务处理服务模块

该模块负责处理Dramatiq任务，包括：
1. 处理单个Dramatiq任务的图像生成逻辑
2. 监控任务进度
3. 清理过期任务
"""

from typing import Dict, Any
import logging
import asyncio
import time
import os
import json
from datetime import datetime, timezone

from app.db.mongodb import get_database
from app.db.redis import get_redis_cache
from app.models.dramatiq_task import DramatiqTaskStatus
from app.services.image import create_image_generator, format_prompt_for_api
from app.core.config import settings

# 配置日志
logger = logging.getLogger(__name__)

async def monitor_task_progress(task_id: str) -> Dict[str, Any]:
    """
    监控任务进度

    Args:
        task_id: 任务ID

    Returns:
        监控结果
    """
    try:
        # 确保我们在当前事件循环中创建所有异步对象
        # 获取数据库连接
        db = await get_database()

        # 获取任务信息
        from app.crud.task import get_task, update_task_status, update_subtasks_completion
        task_data = await get_task(db, task_id)

        if not task_data:
            raise ValueError(f"找不到任务 {task_id}")

        # 检查任务状态
        from app.crud.dramatiq_task import get_dramatiq_tasks_by_parent_id

        # 获取子任务
        logger.info(f"开始获取子任务: {task_id}")
        sub_tasks = await get_dramatiq_tasks_by_parent_id(db, task_id)
        logger.info(f"子任务获取结果: 找到 {len(sub_tasks)} 个子任务, 任务ID: {task_id}")

        # 如果子任务未创建，创建子任务
        if not sub_tasks:
            logger.info(f"子任务不存在，开始创建子任务: {task_id}")
            # 创建子任务
            from app.services.task import prepare_dramatiq_tasks
            preparation_result = await prepare_dramatiq_tasks(task_id)

            if preparation_result.get("status") == "failed":
                error_msg = f"创建子任务失败: {preparation_result.get('error')}"
                logger.error(error_msg)
                raise Exception(error_msg)

            logger.info(f"子任务创建成功，开始重新获取子任务: {task_id}")
            # 重新获取子任务
            sub_tasks = await get_dramatiq_tasks_by_parent_id(db, task_id)
            logger.info(f"重新获取子任务结果: 找到 {len(sub_tasks)} 个子任务, 任务ID: {task_id}")

            if not sub_tasks:
                error_msg = f"无法创建任务 {task_id} 的子任务"
                logger.error(error_msg)
                raise Exception(error_msg)

        # 监控子任务执行
        logger.info(f"开始监控子任务执行: {task_id}")
        monitoring_start_time = time.time()
        monitoring_iteration = 0

        while True:
            monitoring_iteration += 1
            elapsed_time = time.time() - monitoring_start_time
            logger.info(f"监控循环第 {monitoring_iteration} 次迭代, 已耗时: {elapsed_time:.2f}秒, 任务ID: {task_id}")

            # 获取最新的任务状态
            logger.debug(f"获取最新的任务状态: {task_id}")
            task_data = await get_task(db, task_id)

            # 如果任务已取消，停止执行
            from app.models.task import TaskStatus
            if task_data.get("status") == TaskStatus.CANCELLED.value:
                logger.info(f"任务已取消，停止监控: {task_id}")
                return {"status": "cancelled", "message": "任务已取消"}

            # 获取子任务状态
            logger.debug(f"获取子任务状态: {task_id}")
            sub_tasks = await get_dramatiq_tasks_by_parent_id(db, task_id)
            total_tasks = len(sub_tasks)
            completed_tasks = sum(1 for task in sub_tasks if task.get("status") == DramatiqTaskStatus.COMPLETED.value)
            failed_tasks = sum(1 for task in sub_tasks if task.get("status") == DramatiqTaskStatus.FAILED.value)
            processing_tasks = sum(1 for task in sub_tasks if task.get("status") == DramatiqTaskStatus.PROCESSING.value)
            pending_tasks = total_tasks - completed_tasks - failed_tasks - processing_tasks

            logger.info(f"子任务状态: 总数={total_tasks}, 完成={completed_tasks}, 失败={failed_tasks}, 处理中={processing_tasks}, 等待中={pending_tasks}, 任务ID: {task_id}")

            # 检查是否所有子任务已完成或失败
            all_completed = (completed_tasks + failed_tasks) >= total_tasks
            logger.debug(f"所有子任务是否已完成或失败: {all_completed}, 任务ID: {task_id}")

            # 如果所有子任务已完成或失败
            if all_completed:
                logger.info(f"所有子任务已完成或失败，开始更新任务状态: {task_id}")
                # 更新子任务完成状态
                logger.info(f"更新子任务完成状态: {task_id}")
                await update_subtasks_completion(db, task_id, True)
                logger.info(f"子任务完成状态已更新: {task_id}")

                # 更新任务状态
                from app.models.task import TaskStatus
                total_time = time.time() - monitoring_start_time

                # 如果所有子任务都失败，则任务失败
                if failed_tasks == total_tasks:
                    logger.info(f"所有子任务均失败，更新任务状态为失败: {task_id}, 总耗时: {total_time:.2f}秒")
                    await update_task_status(db, task_id, TaskStatus.FAILED.value)
                    return {"status": "failed", "message": "所有子任务均失败"}
                # 如果有一些子任务失败，但不是全部，则任务部分完成
                elif failed_tasks > 0:
                    logger.info(f"部分子任务失败，更新任务状态为已完成: {task_id}, 失败数: {failed_tasks}/{total_tasks}, 总耗时: {total_time:.2f}秒")
                    await update_task_status(db, task_id, TaskStatus.COMPLETED.value)
                    return {"status": "completed_with_failures", "message": "任务已完成，但有部分子任务失败"}
                # 如果所有子任务都成功，则任务成功
                else:
                    logger.info(f"所有子任务均成功，更新任务状态为已完成: {task_id}, 完成数: {completed_tasks}/{total_tasks}, 总耗时: {total_time:.2f}秒")
                    await update_task_status(db, task_id, TaskStatus.COMPLETED.value)

                    # 如果配置了持久化后清除Redis缓存，则清除任务缓存
                    if settings.CACHE_CLEANUP_AFTER_PERSIST:
                        logger.info(f"开始清除任务缓存: {task_id}")
                        # 清除任务缓存
                        redis_cache = get_redis_cache()
                        deleted_count = await redis_cache.clear_task_cache(task_id)
                        if deleted_count > 0:
                            logger.info(f"清除了任务 {task_id} 的 {deleted_count} 个缓存项")
                        else:
                            logger.info(f"任务 {task_id} 没有缓存项需要清除")

                        # 清除所有子任务的Dramatiq结果
                        logger.info(f"开始清除子任务的Dramatiq结果: {task_id}, 子任务数量: {len(sub_tasks)}")
                        cleaned_count = 0
                        for sub_task in sub_tasks:
                            sub_task_id = sub_task.get("id")
                            if sub_task_id:
                                cleaned = await redis_cache.clear_dramatiq_results(sub_task_id)  # 直接使用id字段
                                if cleaned:
                                    cleaned_count += 1
                                    logger.debug(f"清除了子任务 {sub_task_id} 的Dramatiq结果")

                        logger.info(f"完成清除子任务的Dramatiq结果: {task_id}, 清除数量: {cleaned_count}/{len(sub_tasks)}")

                    logger.info(f"任务已成功完成: {task_id}, 总耗时: {total_time:.2f}秒")
                    return {"status": "completed", "message": "任务已成功完成"}

            # 等待一段时间再检查
            await asyncio.sleep(5)

    except Exception as e:
        # 记录错误并更新任务状态
        logger.error(f"监控任务 {task_id} 进度时出错: {str(e)}")

        try:
            db = await get_database()
            from app.crud.task import update_task_status
            from app.models.task import TaskStatus
            await update_task_status(db, task_id, TaskStatus.FAILED.value, str(e))
        except Exception as update_error:
            logger.error(f"更新任务状态时出错: {str(update_error)}")

        raise

async def cleanup_expired_task_data() -> Dict[str, Any]:
    """
    清理过期的任务数据
    只清理make_images队列中的任务

    Returns:
        清理结果
    """
    try:
        # 计算过期时间（30天前）
        from datetime import datetime, timedelta, timezone
        expiration_date = datetime.now(timezone.utc) - timedelta(days=30)

        # 确保我们在当前事件循环中创建所有异步对象
        # 获取数据库连接
        db = await get_database()

        # 查找过期的任务
        from app.crud.task import list_tasks, delete_task
        from app.crud.dramatiq_task import delete_dramatiq_tasks_by_parent_id, get_dramatiq_tasks_by_parent_id

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

        # 只清理Redis中的actor-make-image队列任务
        redis_cache = get_redis_cache()
        # 清除dramatiq:actor-make-image相关的键
        make_images_keys_deleted = await redis_cache.delete_pattern("dramatiq:actor-make-image*")
        logger.info(f"清除了 {make_images_keys_deleted} 个actor-make-image队列相关的Redis键")

        # 注意：不清理actor-tasks队列

        # 标记为已删除
        for task in expired_tasks:
            task_id = task.get("id")
            if task_id:
                # 获取子任务
                sub_tasks = await get_dramatiq_tasks_by_parent_id(db, task_id)

                # 清除子任务的Dramatiq结果（只清除make_images队列中的结果）
                for sub_task in sub_tasks:
                    sub_task_id = sub_task.get("id")
                    if sub_task_id:
                        # 清除结果
                        await redis_cache.clear_dramatiq_results(sub_task_id)

                # 删除任务
                await delete_task(db, task_id)

                # 删除相关的子任务
                await delete_dramatiq_tasks_by_parent_id(db, task_id)

                deleted_count += 1

        return {
            "deleted_count": deleted_count,
            "make_images_keys_deleted": make_images_keys_deleted,
            "expiration_date": expiration_date.isoformat()
        }
    except Exception as e:
        logger.error(f"清理过期任务时出错: {str(e)}")
        raise
