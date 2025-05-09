"""
Dramatiq broker 配置模块

配置 Dramatiq 的消息代理，用于任务队列管理
"""
import dramatiq
from dramatiq.brokers.redis import RedisBroker
from dramatiq.middleware import CurrentTime, Pipelines, Prometheus, Retries
from dramatiq.rate_limits.backends import RedisBackend
from dramatiq.rate_limits import ConcurrentRateLimiter
import os
import logging

# 配置日志
logger = logging.getLogger(__name__)

# 从环境变量获取 Redis 连接信息
REDIS_HOST = os.environ.get("REDIS_HOST", "localhost")
REDIS_PORT = int(os.environ.get("REDIS_PORT", 6379))
REDIS_DB = int(os.environ.get("REDIS_DB", 0))
REDIS_PASSWORD = os.environ.get("REDIS_PASSWORD", None)

# 创建 Redis broker
redis_broker = RedisBroker(
    host=REDIS_HOST,
    port=REDIS_PORT,
    db=REDIS_DB,
    password=REDIS_PASSWORD,
    ssl=False,
    middleware=[
        CurrentTime(),
        Pipelines(),
        Prometheus(),
        Retries(max_retries=10, min_backoff=0, max_backoff=0),  # 最大重试10次，无等待时间
    ]
)

# 设置为默认 broker
dramatiq.set_broker(redis_broker)

# 创建速率限制后端
rate_limiter_backend = RedisBackend(
    client=redis_broker.client,
)

# 创建并发限制器
image_concurrency_limiter = ConcurrentRateLimiter(
    rate_limiter_backend,
    "image-generation-limiter",
    limit=5  # 最多同时运行 5 个图像生成任务
)

logger.info(f"初始化 Dramatiq broker，连接到 Redis: {REDIS_HOST}:{REDIS_PORT}")