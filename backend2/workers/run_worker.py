"""
启动 Dramatiq Worker 的脚本

使用方法:
    python -m backend2.workers.run_worker
"""
import os
import sys
import logging
import dramatiq
from dramatiq.cli import main as dramatiq_main
from logging.config import dictConfig

# 导入所有 actor 确保它们被注册
from backend2.workers.broker import redis_broker
from backend2.workers.image_actor import generate_image_for_subtask

# 配置日志
logging_config = {
    'version': 1,
    'disable_existing_loggers': False,
    'formatters': {
        'standard': {
            'format': '%(asctime)s [%(levelname)s] %(name)s: %(message)s'
        },
    },
    'handlers': {
        'default': {
            'level': 'INFO',
            'formatter': 'standard',
            'class': 'logging.StreamHandler',
            'stream': 'ext://sys.stdout',
        },
        'file': {
            'level': 'INFO',
            'formatter': 'standard',
            'class': 'logging.handlers.RotatingFileHandler',
            'filename': 'worker.log',
            'maxBytes': 10485760,  # 10MB
            'backupCount': 5,
        },
    },
    'loggers': {
        '': {
            'handlers': ['default', 'file'],
            'level': 'INFO',
            'propagate': True
        },
        'backend2': {
            'handlers': ['default', 'file'],
            'level': 'INFO',
            'propagate': False
        },
        'dramatiq': {
            'handlers': ['default', 'file'],
            'level': 'INFO',
            'propagate': False
        },
    }
}

dictConfig(logging_config)
logger = logging.getLogger(__name__)


def run_worker():
    """启动 Dramatiq worker"""
    logger.info("启动 Dramatiq worker...")
    sys.argv = [
        "dramatiq",
        "backend2.workers.image_actor",
        "--processes", "4",  # 进程数
        "--threads", "8",    # 每个进程的线程数
        "--watch", "backend2",  # 监视的目录
    ]
    dramatiq_main()


if __name__ == "__main__":
    run_worker()