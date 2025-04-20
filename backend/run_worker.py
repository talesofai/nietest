import os
import sys
import logging
import dramatiq

# 配置日志
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
    handlers=[
        logging.StreamHandler(sys.stdout)
    ]
)

logger = logging.getLogger("worker")

# 导入Dramatiq任务
from app.dramatiq.tasks import generate_images, generate_single_image, cleanup_expired_tasks

if __name__ == "__main__":
    logger.info("启动Dramatiq worker...")
    
    # 导入broker
    from app.dramatiq.broker import redis_broker
    
    # 启动worker
    from dramatiq.cli import main
    sys.argv = ["dramatiq", "app.dramatiq.tasks"]
    
    try:
        logger.info("Worker已启动，按Ctrl+C停止")
        main()
    except KeyboardInterrupt:
        logger.info("Worker已停止")
