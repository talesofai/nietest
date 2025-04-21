import dramatiq
from dramatiq.brokers.redis import RedisBroker
from dramatiq.middleware import Middleware
from dramatiq.results import Results
from dramatiq.results.backends import RedisBackend
import logging
from typing import Dict, Any, Optional
import time

from app.core.config import settings

# 配置日志
logger = logging.getLogger(__name__)

# 自定义中间件，用于记录任务执行时间
class TaskTimeMiddleware(Middleware):
    """记录任务执行时间的中间件"""

    # 使用类变量存储任务开始时间
    _task_start_times = {}

    def before_process_message(self, broker, message):
        # 使用message_id作为键存储开始时间
        self._task_start_times[message.message_id] = time.time()

    def after_process_message(self, broker, message, *, result=None, exception=None):
        # 从存储中获取开始时间
        start_time = self._task_start_times.pop(message.message_id, None)
        if start_time:
            duration = time.time() - start_time
            logger.info(f"任务 {message.message_id} 执行时间: {duration:.2f}秒")

# 创建Redis结果后端
result_backend = RedisBackend(url=settings.REDIS_URL)

# 创建Redis消息代理
redis_broker = RedisBroker(url=settings.REDIS_URL)

# 添加结果后端和自定义中间件
redis_broker.add_middleware(Results(backend=result_backend))
redis_broker.add_middleware(TaskTimeMiddleware())

# 设置Dramatiq使用Redis消息代理
dramatiq.set_broker(redis_broker)

# 任务状态缓存
task_status_cache: Dict[str, Dict[str, Any]] = {}

def get_task_status(task_id: str) -> Optional[Dict[str, Any]]:
    """
    获取任务状态

    Args:
        task_id: 任务ID

    Returns:
        任务状态信息，如果不存在则返回None
    """
    return task_status_cache.get(task_id)

def set_task_status(task_id: str, status: Dict[str, Any]) -> None:
    """
    设置任务状态

    Args:
        task_id: 任务ID
        status: 任务状态信息
    """
    task_status_cache[task_id] = status
