import os
import sys
import argparse
import logging

# 添加项目根目录到Python路径
sys.path.insert(0, os.path.abspath(os.path.dirname(__file__)))

# 导入任务模块
from app.dramatiq.broker import redis_broker
from app.dramatiq.tasks import generate_images, generate_single_image, cleanup_expired_tasks

# 配置日志
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S",
)

logger = logging.getLogger("dramatiq.worker")

# 创建定时任务调度器
from apscheduler.schedulers.background import BackgroundScheduler
from apscheduler.triggers.interval import IntervalTrigger

def start_scheduler():
    """启动定时任务调度器"""
    scheduler = BackgroundScheduler()
    
    # 添加清理过期任务的定时任务，每小时执行一次
    scheduler.add_job(
        lambda: cleanup_expired_tasks.send(),
        trigger=IntervalTrigger(hours=1),
        id="cleanup_expired_tasks",
        name="清理过期任务",
        replace_existing=True
    )
    
    # 启动调度器
    scheduler.start()
    logger.info("定时任务调度器已启动")
    return scheduler

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Dramatiq Worker")
    parser.add_argument("--processes", type=int, default=2, help="Worker进程数")
    parser.add_argument("--threads", type=int, default=8, help="每个进程的线程数")
    parser.add_argument("--scheduler", action="store_true", help="启动定时任务调度器")
    parser.add_argument("module", nargs="?", default="app.dramatiq.tasks", help="任务模块")
    
    args = parser.parse_args()
    
    if args.scheduler:
        # 启动定时任务调度器
        scheduler = start_scheduler()
        
        try:
            # 保持主线程运行
            import time
            while True:
                time.sleep(1)
        except KeyboardInterrupt:
            logger.info("定时任务调度器已停止")
            scheduler.shutdown()
    else:
        # 启动Dramatiq Worker
        import dramatiq.cli
        
        sys.argv = [
            "dramatiq",
            "--processes", str(args.processes),
            "--threads", str(args.threads),
            args.module
        ]
        
        dramatiq.cli.main()
