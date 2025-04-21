import dramatiq
import logging
from typing import Dict, Any
import asyncio

from app.dramatiq.broker import redis_broker

# 配置日志
logger = logging.getLogger(__name__)

# 注意：我们不再使用主任务actor，因为我们直接在API端点异步执行主任务分发逻辑

@dramatiq.actor(broker=redis_broker, queue_name="actor-make-image", max_retries=3, time_limit=600000, store_results=True)  # 10分钟超时
def generate_single_image(_: str = "") -> Dict[str, Any]:
    """
    生成单张图片的子任务
    该任务在 'actor-make-image' 队列中执行

    Args:
        _: 占位参数，不使用

    Returns:
        执行结果
    """
    # 使用当前消息ID作为任务ID
    from dramatiq.middleware import CurrentMessage
    message = CurrentMessage.get_current_message()
    dramatiq_task_id = message.message_id

    # 调用服务层函数处理图像生成逻辑
    import asyncio
    from app.services.dramatiq_task import process_image_task
    return asyncio.run(process_image_task(dramatiq_task_id))

# 注意：我们不再使用清理任务actor，因为我们不需要定时清除过期任务
