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
# 我们不再使用cleanup_expired_tasks函数

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

    # 我们不再使用清理过期任务的定时任务

    # 添加任务状态日志的定时任务，每5秒执行一次
    scheduler.add_job(
        log_task_status,
        trigger=IntervalTrigger(seconds=5),
        id="task_status_log",
        name="任务状态日志",
        replace_existing=True
    )



    # 添加Worker扩缩容的定时任务，每60秒执行一次
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

def get_redis_client():
    """
    获取Redis客户端

    Returns:
        Redis客户端实例
    """
    try:
        from redis import Redis
        from app.core.config import settings

        # 直接使用配置中的Redis URL
        redis_url = settings.REDIS_URL

        # 连接Redis
        return Redis.from_url(redis_url)
    except Exception as e:
        logger.error(f"连接Redis失败: {str(e)}")
        return None

def get_pending_tasks_count() -> int:
    """
    获取待处理任务数量
    只从 Redis 中获取 actor-make-image 队列的任务数量

    Returns:
        待处理任务数量
    """
    try:
        redis_client = get_redis_client()
        if not redis_client:
            return 0

        # 只检查actor-make-image队列
        queue_name = "dramatiq:actor-make-image"  # 子任务队列

        try:
            queue_length = redis_client.llen(queue_name)
            logger.debug(f"队列 {queue_name} 中有 {queue_length} 个待处理任务")
            return queue_length
        except Exception as e:
            logger.debug(f"检查队列 {queue_name} 失败: {str(e)}")
            return 0

    except Exception as e:
        logger.error(f"获取待处理任务数量失败: {str(e)}")
        return 0

def get_processing_tasks_count() -> int:
    """
    获取处理中的任务数量
    从 Redis 中获取 dramatiq:default.active_messages 集合的大小
    并从 MongoDB 中获取状态为 PROCESSING 的任务数量

    Returns:
        处理中的任务数量
    """
    try:
        # 从 Redis 中获取活动消息数量
        redis_client = get_redis_client()
        redis_active_count = 0
        if redis_client:
            # 检查活动消息集合
            active_messages_key = "dramatiq:default.active_messages"
            try:
                # 使用SCARD命令获取集合大小
                redis_active_count = redis_client.scard(active_messages_key)
                logger.debug(f"Redis中有 {redis_active_count} 个活动任务")
            except Exception as e:
                logger.debug(f"检查Redis活动任务失败: {str(e)}")

        # 从 MongoDB 中获取处理中的任务数量
        mongo_active_count = 0
        try:
            # 引入必要的模块
            import pymongo
            from app.core.config import settings
            from app.models.subtask import SubTaskStatus

            # 连接MongoDB
            mongo_client = pymongo.MongoClient(settings.MONGODB_URL, serverSelectionTimeoutMS=5000)
            db = mongo_client[settings.MONGODB_DB]

            # 查询处理中的任务数量
            mongo_active_count = db.dramatiq_tasks.count_documents({"status": SubTaskStatus.PROCESSING.value})
            logger.debug(f"MongoDB中有 {mongo_active_count} 个处理中任务")

            # 关闭MongoDB连接
            mongo_client.close()
        except Exception as e:
            logger.debug(f"检查MongoDB处理中任务失败: {str(e)}")

        # 取两者的最大值作为处理中的任务数量
        active_count = max(redis_active_count, mongo_active_count)
        logger.debug(f"总共有 {active_count} 个处理中任务 (Redis: {redis_active_count}, MongoDB: {mongo_active_count})")
        return active_count

    except Exception as e:
        logger.error(f"获取处理中任务数量失败: {str(e)}")
        return 0

def start_worker_process() -> None:
    """
    启动一个Worker进程
    普通worker只处理make_images队列
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
            "--queues", "actor-make-image",  # 普通worker只处理actor-make-image队列
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

def log_task_status() -> None:
    """记录任务状态日志"""
    try:
        # 获取当前待处理任务数量
        pending_tasks = get_pending_tasks_count()

        # 获取当前处理中的任务数量
        processing_tasks = get_processing_tasks_count()

        # 获取当前运行的Worker进程数量
        current_processes = len(worker_processes)

        # 当前总并发处理能力
        current_capacity = current_processes * WORKER_THREADS

        # 直接打印状态信息，不包含日志前缀
        import sys
        status_msg = f"当前状态: 待处理任务={pending_tasks}, 处理中任务={processing_tasks}, 运行中进程={current_processes}, 并发处理能力={current_capacity}\n"
        sys.stdout.write(status_msg)
        sys.stdout.flush()  # 确保立即输出
    except Exception as e:
        logger.error(f"记录任务状态日志失败: {str(e)}")

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
    parser.add_argument("--queues", type=str, default="actor-make-image", help="要处理的队列，用逗号分隔，普通worker只处理actor-make-image")
    parser.add_argument("module", nargs="?", default="app.dramatiq.tasks", help="要加载的模块")

    args = parser.parse_args()

    # 如果只启动调度器
    if args.scheduler:
        logger.info("启动调度器模式")
        scheduler = start_scheduler()

        try:
            # 保持主线程运行
            import time  # 确保在这个作用域中可以访问到time模块
            while True:
                time.sleep(1)
        except KeyboardInterrupt:
            logger.info("收到中断信号，正在关闭调度器...")
            scheduler.shutdown()
            # 清理所有Worker进程
            cleanup_worker_processes()
            logger.info("调度器已关闭")
        return

    # 我们只需要处理actor-make-image队列
    logger.info("启动Worker（处理actor-make-image队列）")

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
    from app.dramatiq.broker import redis_broker

    # 导入模块
    __import__(args.module)

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
        import time  # 确保在这个作用域中可以访问到time模块
        while True:
            time.sleep(1)
    except KeyboardInterrupt:
        logger.info("收到KeyboardInterrupt，正在停止Worker...")
        for w in workers:
            w.stop()
        logger.info("Worker已停止")

if __name__ == "__main__":
    main()
