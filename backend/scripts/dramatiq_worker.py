#!/usr/bin/env python
"""
Dramatiq Worker 启动脚本

该脚本用于启动Dramatiq Worker和调度器，支持以下功能：
1. 启动Dramatiq Worker处理任务
2. 启动调度器定时执行任务
3. 启动Worker管理器动态调整Worker数量
"""

import argparse
import asyncio
import logging
import os
import sys
import time
import functools
from datetime import datetime
from typing import Dict, Any, Callable

import dramatiq
from apscheduler.schedulers.background import BackgroundScheduler
from apscheduler.triggers.interval import IntervalTrigger

# 确保可以导入app模块
sys.path.insert(0, os.path.abspath(os.path.dirname(os.path.dirname(__file__))))

from app.core.config import settings
from app.dramatiq.tasks import cleanup_expired_tasks
from app.services.worker import scale_workers

# 配置日志
os.makedirs(os.path.join(os.path.dirname(os.path.dirname(__file__)), "logs"), exist_ok=True)
log_file = os.path.join(os.path.dirname(os.path.dirname(__file__)), "logs", f"dramatiq_worker_{datetime.now().strftime('%Y%m%d')}.log")

logging.basicConfig(
    level=getattr(logging, settings.LOG_LEVEL),
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[
        logging.StreamHandler(),
        logging.FileHandler(log_file)
    ]
)

logger = logging.getLogger("dramatiq_worker")

# 安全地运行异步函数
def safe_async_run(coro_func: Callable) -> Callable:
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

def start_scheduler() -> BackgroundScheduler:
    """
    启动定时任务调度器

    Returns:
        调度器实例
    """
    scheduler = BackgroundScheduler()

    # 添加清理过期任务的定时任务，每小时执行一次
    scheduler.add_job(
        lambda: cleanup_expired_tasks.send(),
        trigger=IntervalTrigger(hours=1),
        id="cleanup_expired_tasks",
        name="清理过期任务",
        replace_existing=True
    )

    # 添加Worker扩缩容的定时任务，每分钟执行一次
    scheduler.add_job(
        worker_scaling_job,
        trigger=IntervalTrigger(seconds=60),
        id="worker_scaling",
        name="Worker扩缩容",
        replace_existing=True
    )

    # 启动调度器
    scheduler.start()
    logger.info("定时任务调度器已启动")
    return scheduler

@safe_async_run
async def _worker_scaling_job_async() -> tuple:
    """异步Worker扩缩容任务"""
    return await scale_workers()

def worker_scaling_job() -> None:
    """Worker扩缩容任务"""
    try:
        # 使用安全的异步运行方式
        result = _worker_scaling_job_async()

        created_count, terminated_count = result
        if created_count > 0 or terminated_count > 0:
            logger.info(f"Worker扩缩容: 创建 {created_count} 个, 终止 {terminated_count} 个")
    except Exception as e:
        logger.error(f"Worker扩缩容失败: {str(e)}")

def main() -> None:
    """主函数"""
    # 解析命令行参数
    parser = argparse.ArgumentParser(description="Dramatiq Worker启动脚本")
    parser.add_argument("--processes", type=int, default=1, help="Worker进程数")
    parser.add_argument("--threads", type=int, default=8, help="每个Worker的线程数")
    parser.add_argument("--scheduler", action="store_true", help="是否启动调度器")
    parser.add_argument("module", nargs="?", default="app.dramatiq.tasks", help="要加载的模块")

    args = parser.parse_args()

    # 如果只启动调度器
    if args.scheduler:
        logger.info("启动调度器模式")
        scheduler = start_scheduler()

        try:
            # 保持主线程运行
            while True:
                time.sleep(1)
        except KeyboardInterrupt:
            logger.info("收到中断信号，正在关闭调度器...")
            scheduler.shutdown()
            logger.info("调度器已关闭")
        return

    # 导入指定模块
    __import__(args.module)

    # 启动Dramatiq Worker
    from dramatiq.cli import main as dramatiq_main

    sys.argv = [
        "dramatiq",
        "--processes", str(args.processes),
        "--threads", str(args.threads),
        args.module
    ]

    logger.info(f"启动Dramatiq Worker: {args.processes}个进程, 每个进程{args.threads}个线程")
    dramatiq_main()

if __name__ == "__main__":
    main()
