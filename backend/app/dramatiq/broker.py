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

# 自定义中间件，用于记录任务执行时间和详细信息
class DetailedTaskMiddleware(Middleware):
    """记录任务执行的详细信息的中间件"""

    # 使用类变量存储任务开始时间
    _task_start_times = {}

    def before_process_message(self, broker, message):
        # 使用message_id作为键存储开始时间
        self._task_start_times[message.message_id] = time.time()

        # 记录任务开始执行的详细信息
        actor_name = message.actor_name
        args = message.args
        kwargs = message.kwargs

        # 打印详细的任务信息
        logger.info(f"===== 开始执行任务 =====")
        logger.info(f"任务ID: {message.message_id}")
        logger.info(f"任务名称: {actor_name}")
        logger.info(f"任务参数: args={args}, kwargs={kwargs}")

        # 忽略未使用的broker参数
        _ = broker

    def after_process_message(self, broker, message, *, result=None, exception=None):
        # 从存储中获取开始时间
        start_time = self._task_start_times.pop(message.message_id, None)

        # 记录任务完成的详细信息
        logger.info(f"===== 任务执行完成 =====")
        logger.info(f"任务ID: {message.message_id}")

        # 忽略未使用的broker参数
        _ = broker

        if start_time:
            duration = time.time() - start_time
            logger.info(f"执行时间: {duration:.2f}秒")

        if exception:
            logger.error(f"任务失败: {str(exception)}")
            # 打印异常详情
            import traceback
            logger.error(f"异常详情:\n{traceback.format_exc()}")
        else:
            logger.info(f"任务成功完成")

            # 打印结果摘要（如果结果过大，只打印部分）
            if result:
                result_str = str(result)
                if len(result_str) > 1000:
                    result_str = result_str[:1000] + "... (结果过长已截断)"
                logger.info(f"任务结果: {result_str}")

        # 任务完成后记录状态
        if not exception:
            # 记录任务完成状态
            set_task_status(message.message_id, {
                "status": "completed",
                "completed_at": time.time()
            })
            logger.debug(f"任务 {message.message_id} 已完成")

# 创建Redis结果后端
result_backend = RedisBackend(url=settings.REDIS_URL)

# 创建Redis消息代理
# 使用默认中间件，但排除Prometheus中间件
from dramatiq.middleware import AgeLimit, TimeLimit, Callbacks, Pipelines, Retries

# 创建默认中间件列表，但排除Prometheus中间件
from dramatiq.middleware import CurrentMessage
default_middleware = [
    AgeLimit(),
    TimeLimit(),
    Callbacks(),
    Pipelines(),
    Retries(min_backoff=1000, max_backoff=900000, max_retries=10),
    CurrentMessage(),  # 添加CurrentMessage中间件
]

# 创建Redis消息代理
redis_broker = RedisBroker(url=settings.REDIS_URL, middleware=default_middleware)

# 添加结果后端和自定义中间件
redis_broker.add_middleware(Results(backend=result_backend))
redis_broker.add_middleware(DetailedTaskMiddleware())

# 注册队列
# 我们只需要actor-make-image队列，因为我们不再使用actor-tasks队列
redis_broker.declare_queue("actor-make-image")

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
