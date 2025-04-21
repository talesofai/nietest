#!/usr/bin/env python
"""
Dramatiq Worker 启动脚本

该脚本用于启动Dramatiq Worker和调度器，支持以下功能：
1. 启动Dramatiq Worker处理任务
2. 启动调度器定时执行任务
3. 启动Worker管理器动态调整Worker数量
"""

import argparse
import logging
import os
import sys
import time
import subprocess
from datetime import datetime

import dramatiq
from apscheduler.schedulers.background import BackgroundScheduler
from apscheduler.triggers.interval import IntervalTrigger

sys.path.insert(0, os.path.abspath(os.path.dirname(os.path.dirname(__file__))))
from app.core.config import settings
from app.dramatiq.tasks import cleanup_expired_tasks

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

# 设置特定模块的日志级别
logging.getLogger('dramatiq').setLevel(logging.INFO)
logging.getLogger('app.dramatiq').setLevel(logging.DEBUG)
logging.getLogger('app.services').setLevel(logging.DEBUG)

logger = logging.getLogger("dramatiq_worker")

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

# 全局变量跟踪当前运行的Worker进程
worker_processes = {}

def get_pending_tasks_count() -> int:
    """
    获取待处理任务数量

    Returns:
        待处理任务数量
    """
    try:
        # 使用Redis获取队列长度
        from redis import Redis
        from app.core.config import settings
        import pymongo

        # 直接使用配置中的Redis URL
        redis_url = settings.REDIS_URL

        # 连接Redis
        redis_client = Redis.from_url(redis_url)

        # 尝试不同的队列名称
        queue_names = [
            "dramatiq:default",
            "dramatiq:dramatiq:default",
            "dramatiq:app.dramatiq.tasks:default"
        ]

        total_tasks = 0
        for queue_name in queue_names:
            try:
                queue_length = redis_client.llen(queue_name)
                logger.debug(f"队列 {queue_name} 中有 {queue_length} 个任务")
                total_tasks += queue_length
            except Exception as e:
                logger.debug(f"检查队列 {queue_name} 失败: {str(e)}")

        # 如果Redis中没有任务，尝试从 MongoDB 中获取待处理的任务数量
        if total_tasks == 0:
            try:
                # 连接MongoDB
                mongo_client = pymongo.MongoClient(settings.MONGODB_URL)
                db = mongo_client[settings.MONGODB_DB]

                # 查询待处理的任务
                pending_tasks = db.dramatiq_tasks.count_documents({"status": "pending"})
                logger.debug(f"MongoDB 中有 {pending_tasks} 个待处理任务")

                # 如果有待处理的任务，将其添加到Redis队列中
                if pending_tasks > 0:
                    logger.info(f"发现MongoDB中有 {pending_tasks} 个待处理任务，将尝试启动Worker处理")
                    total_tasks = pending_tasks
            except Exception as e:
                logger.error(f"从 MongoDB 获取待处理任务数量失败: {str(e)}")

        return total_tasks
    except Exception as e:
        logger.error(f"获取待处理任务数量失败: {str(e)}")
        return 0

def start_worker_process() -> None:
    """
    启动一个Worker进程
    """
    global worker_processes

    try:
        # 构建启动命令
        cmd = [
            sys.executable,
            "-m",
            "scripts.dramatiq_worker",
            "--processes", "1",
            "--threads", str(WORKER_THREADS),
            "--log-level", "DEBUG",  # 使用详细的日志级别
            "app.dramatiq.tasks"
        ]

        # 启动进程
        process = subprocess.Popen(
            cmd,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            cwd=os.path.dirname(os.path.dirname(os.path.abspath(__file__))),
            env=os.environ.copy()
        )

        # 记录进程
        worker_id = str(process.pid)
        worker_processes[worker_id] = process

        logger.info(f"启动Worker进程: PID={worker_id}")

    except Exception as e:
        logger.error(f"启动Worker进程失败: {str(e)}")

def stop_worker_processes(count: int) -> int:
    """
    停止指定数量的Worker进程

    Args:
        count: 要停止的进程数量

    Returns:
        实际停止的进程数量
    """
    global worker_processes

    if count <= 0 or not worker_processes:
        return 0

    # 获取要停止的进程列表
    processes_to_stop = list(worker_processes.items())[:count]
    stopped_count = 0

    for worker_id, process in processes_to_stop:
        try:
            # 尝试优雅地终止进程
            if process.poll() is None:  # 如果进程还在运行
                # 先发送SIGTERM信号
                process.terminate()

                # 等待进程结束，最多等待5秒
                try:
                    process.wait(timeout=5)
                except subprocess.TimeoutExpired:
                    # 如果超时，强制终止
                    process.kill()

            # 从跟踪列表中移除
            del worker_processes[worker_id]
            stopped_count += 1

            logger.info(f"停止Worker进程: PID={worker_id}")

        except Exception as e:
            logger.error(f"停止Worker进程 {worker_id} 失败: {str(e)}")

    return stopped_count

def cleanup_worker_processes() -> None:
    """
    清理所有Worker进程
    """
    global worker_processes

    if not worker_processes:
        return

    logger.info(f"清理 {len(worker_processes)} 个Worker进程")

    # 停止所有进程
    stop_worker_processes(len(worker_processes))

# 记录上次扩容时间
last_scale_up_time = None

# 每个Worker的并发处理能力
WORKER_THREADS = 8

# 最大Worker数量
MAX_WORKERS = 10

# Worker扩容间隔（秒）
SCALE_UP_INTERVAL = 120  # 2分钟

def worker_scaling_job() -> None:
    """Worker扩缩容任务"""
    global worker_processes, last_scale_up_time

    try:
        # 获取当前待处理任务数量
        pending_tasks = get_pending_tasks_count()

        # 获取当前运行的Worker进程数量
        current_processes = len(worker_processes)

        # 当前总并发处理能力
        current_capacity = current_processes * WORKER_THREADS

        logger.info(f"当前状态: 待处理任务={pending_tasks}, 运行中进程={current_processes}, 并发处理能力={current_capacity}")

        # 判断是否需要扩容
        if pending_tasks > current_capacity and current_processes < MAX_WORKERS:
            # 检查是否可以扩容
            can_scale_up = True

            # 如果有上次扩容时间，检查是否超过了指定间隔
            if last_scale_up_time:
                time_since_last_scale = time.time() - last_scale_up_time
                can_scale_up = time_since_last_scale >= SCALE_UP_INTERVAL

            if can_scale_up:
                # 每次只增加1个Worker
                workers_to_add = 1

                # 确保不超过最大Worker数量
                if current_processes + workers_to_add <= MAX_WORKERS:
                    # 启动新Worker
                    start_worker_process()

                    # 更新上次扩容时间
                    last_scale_up_time = time.time()

                    logger.info(f"Worker扩容: 启动 1 个新Worker进程, 增加 {WORKER_THREADS} 个并发处理能力")

        # 判断是否需要缩容
        elif pending_tasks == 0 and current_processes > 0:
            # 如果没有待处理任务，保留一个Worker，其余的停止
            workers_to_stop = current_processes - 1

            if workers_to_stop > 0:
                stopped_count = stop_worker_processes(workers_to_stop)
                logger.info(f"Worker缩容: 停止 {stopped_count} 个Worker进程")

    except Exception as e:
        logger.error(f"Worker扩缩容失败: {str(e)}")

def main() -> None:
    """主函数"""
    # 解析命令行参数
    parser = argparse.ArgumentParser(description="Dramatiq Worker启动脚本")
    parser.add_argument("--processes", type=int, default=1, help="Worker进程数")
    parser.add_argument("--threads", type=int, default=8, help="每个Worker的线程数")
    parser.add_argument("--scheduler", action="store_true", help="是否启动调度器")
    parser.add_argument("--log-level", type=str, default="INFO", choices=["DEBUG", "INFO", "WARNING", "ERROR", "CRITICAL"], help="日志级别")
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
            # 清理所有Worker进程
            cleanup_worker_processes()
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
        "--log-level", args.log_level,
        args.module
    ]

    logger.info(f"启动Dramatiq Worker: {args.processes}个进程, 每个进程{args.threads}个线程")
    dramatiq_main()

if __name__ == "__main__":
    main()
