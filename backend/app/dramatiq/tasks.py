import dramatiq
import logging
from typing import Dict, Any
import asyncio
import functools

from app.dramatiq.broker import redis_broker
from app.services.dramatiq_task import process_image_task, monitor_task_progress, cleanup_expired_task_data

# 配置日志
logger = logging.getLogger(__name__)

# 安全地运行异步函数
def safe_async_run(coro_func):
    """
    安全地运行异步函数的装饰器

    这个装饰器确保每次调用都使用新的事件循环，并正确处理异常
    """
    @functools.wraps(coro_func)
    def wrapper(*args, **kwargs):
        try:
            # 创建新的事件循环
            loop = asyncio.new_event_loop()
            asyncio.set_event_loop(loop)

            try:
                # 在新的事件循环中运行协程函数
                return loop.run_until_complete(coro_func(*args, **kwargs))
            finally:
                # 关闭事件循环
                loop.close()
                asyncio.set_event_loop(None)
        except Exception as e:
            logger.error(f"运行异步函数 {coro_func.__name__} 时出错: {str(e)}")
            raise

    return wrapper

@dramatiq.actor(broker=redis_broker, max_retries=3, time_limit=36000000, store_results=True)  # 10小时超时
@safe_async_run
def generate_images(task_id: str) -> Dict[str, Any]:
    """
    生成图片的主任务，监控和管理子任务的执行

    Args:
        task_id: 任务ID

    Returns:
        执行结果
    """
    # 调用服务层函数处理任务监控逻辑
    return monitor_task_progress(task_id)

@dramatiq.actor(broker=redis_broker, max_retries=3, time_limit=600000, store_results=True)  # 10分钟超时
@safe_async_run
def generate_single_image(task_id: str) -> Dict[str, Any]:
    """
    生成单张图片的子任务

    Args:
        task_id: Dramatiq任务ID

    Returns:
        执行结果
    """
    # 调用服务层函数处理图像生成逻辑
    return process_image_task(task_id)

@dramatiq.actor(broker=redis_broker, store_results=True)
@safe_async_run
def cleanup_expired_tasks() -> Dict[str, Any]:
    """
    清理过期的任务

    Returns:
        清理结果
    """
    # 调用服务层函数处理清理逻辑
    return cleanup_expired_task_data()
