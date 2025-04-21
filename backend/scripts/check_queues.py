"""
检查Dramatiq队列状态
"""

import asyncio
import logging
import sys
import os

# 设置Python路径
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

# 配置日志
logging.basicConfig(
    level=logging.DEBUG,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
)
logger = logging.getLogger(__name__)

async def main():
    """主函数"""
    try:
        # 导入必要的模块
        from redis import Redis
        from app.core.config import settings
        
        # 连接Redis
        redis_client = Redis.from_url(settings.REDIS_URL)
        
        # 检查队列
        queues = [
            "dramatiq:actor-tasks",
            "dramatiq:actor-make-image",
            "dramatiq:default",
            "dramatiq:tasks",
            "dramatiq:make_images"
        ]
        
        for queue in queues:
            queue_length = redis_client.llen(queue)
            logger.info(f"队列 {queue} 中有 {queue_length} 个任务")
            
            # 如果队列中有任务，查看任务详情
            if queue_length > 0:
                # 获取队列中的所有任务（不移除）
                tasks = redis_client.lrange(queue, 0, -1)
                logger.info(f"队列 {queue} 中的任务:")
                for i, task in enumerate(tasks):
                    logger.info(f"  任务 {i+1}: {task[:100]}...")
        
        # 检查结果存储
        result_keys = redis_client.keys("dramatiq:results:*")
        logger.info(f"找到 {len(result_keys)} 个结果键")
        for key in result_keys:
            result = redis_client.get(key)
            logger.info(f"  结果键 {key}: {result[:100] if result else None}...")
            
    except Exception as e:
        logger.error(f"检查失败: {str(e)}")
        raise

if __name__ == "__main__":
    asyncio.run(main())
