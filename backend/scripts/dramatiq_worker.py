#!/usr/bin/env python
"""
Dramatiq Worker 启动脚本

该脚本用于启动Dramatiq Worker和调度器，支持以下功能：
1. 启动Dramatiq Worker处理任务
2. 启动调度器定时执行任务
"""

import argparse
import logging
import os
import sys
import time
from datetime import datetime

import dramatiq
from apscheduler.schedulers.background import BackgroundScheduler

sys.path.insert(0, os.path.abspath(os.path.dirname(os.path.dirname(__file__))))
from app.core.config import settings

# 配置日志
os.makedirs(os.path.join(os.path.dirname(os.path.dirname(__file__)), "logs"), exist_ok=True)
log_file = os.path.join(os.path.dirname(os.path.dirname(__file__)), "logs", f"dramatiq_worker_{datetime.now().strftime('%Y%m%d')}.log")

# 配置日志处理器
file_handler = logging.FileHandler(log_file, encoding='utf-8')
# 设置文件处理器为无缓冲模式
file_handler.setLevel(logging.DEBUG)  # 确保所有日志都被记录

stream_handler = logging.StreamHandler(sys.stdout)  # 明确指定输出到stdout

# 设置格式化器
formatter = logging.Formatter('%(asctime)s - %(name)s - %(levelname)s - %(message)s')
file_handler.setFormatter(formatter)
stream_handler.setFormatter(formatter)

# 配置根日志器
logging.basicConfig(
    level=getattr(logging, settings.LOG_LEVEL),
    handlers=[stream_handler, file_handler]
)

# 设置特定模块的日志级别
logging.getLogger('dramatiq').setLevel(logging.INFO)
logging.getLogger('app').setLevel(logging.DEBUG)  # 设置app根日志器为DEBUG
logging.getLogger('app.dramatiq').setLevel(logging.DEBUG)
logging.getLogger('app.services').setLevel(logging.DEBUG)
logging.getLogger('app.services.image').setLevel(logging.DEBUG)
logging.getLogger('app.services.dramatiq_task').setLevel(logging.DEBUG)

# 确保日志立即刷新
for handler in logging.getLogger().handlers:
    handler.flush()
# 禁用不必要的日志输出
logging.getLogger('apscheduler').setLevel(logging.WARNING)
logging.getLogger('pymongo').setLevel(logging.WARNING)
logging.getLogger('asyncio').setLevel(logging.WARNING)
logging.getLogger('dramatiq.broker').setLevel(logging.WARNING)

logger = logging.getLogger("dramatiq_worker")

def start_scheduler() -> BackgroundScheduler:
    """
    启动定时任务调度器

    Returns:
        调度器实例
    """
    # 创建调度器，禁用作业执行日志
    scheduler = BackgroundScheduler(job_defaults={'coalesce': True, 'misfire_grace_time': 15})

    # 启动调度器
    scheduler.start()
    logger.info("定时任务调度器已启动")
    return scheduler

def main() -> None:
    """主函数"""
    # 解析命令行参数
    parser = argparse.ArgumentParser(description="Dramatiq Worker启动脚本")
    parser.add_argument("--processes", type=int, default=1, help="Worker进程数")
    parser.add_argument("--threads", type=int, default=8, help="每个Worker的线程数")
    parser.add_argument("--scheduler", action="store_true", help="是否启动调度器")
    parser.add_argument("--log-level", type=str, default="INFO", choices=["DEBUG", "INFO", "WARNING", "ERROR", "CRITICAL"], help="日志级别")
    parser.add_argument("--queues", type=str, default="actor-make-image", help="要处理的队列，用逗号分隔")
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

    # 设置日志级别
    if args.log_level:
        logging.getLogger().setLevel(getattr(logging, args.log_level))

    logger.info(f"启动Dramatiq Worker: {args.processes}个进程, 每个进程{args.threads}个线程")

    # 直接使用Dramatiq的Worker类
    from dramatiq.worker import Worker
    import signal

    # 导入broker
    try:
        from app.dramatiq.broker import redis_broker
    except ImportError:
        logger.error("无法导入 app.dramatiq.broker.redis_broker，请确保该模块存在")
        sys.exit(1)

    # 创建Worker实例列表
    workers = []
    for _ in range(args.processes):
        worker = Worker(
            broker=redis_broker,
            queues=[queue.strip() for queue in args.queues.split(",")],
            worker_threads=args.threads
        )
        workers.append(worker)

    # 处理信号
    def handle_sigterm(*_):
        logger.info("收到SIGTERM信号，正在停止Worker...")
        for w in workers:
            w.stop()

    signal.signal(signal.SIGTERM, handle_sigterm)
    signal.signal(signal.SIGINT, handle_sigterm)

    # 启动所有Worker
    logger.info(f"启动{len(workers)}个Worker，处理队列: {args.queues}")
    for w in workers:
        w.start()

    # 保持运行
    try:
        # Dramatiq Worker没有is_alive方法，我们使用无限循环并依赖信号处理
        while True:
            time.sleep(1)
    except KeyboardInterrupt:
        logger.info("收到KeyboardInterrupt，正在停止Worker...")
        for w in workers:
            w.stop()
        logger.info("Worker已停止")

if __name__ == "__main__":
    main()
