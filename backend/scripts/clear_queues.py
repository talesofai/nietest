"""
清空Dramatiq队列
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
        
        # 要清空的队列
        queues = [
            "dramatiq:actor-tasks",
            "dramatiq:actor-make-image",
            "dramatiq:default",
            "dramatiq:tasks",
            "dramatiq:make_images"
        ]
        
        # 清空队列
        for queue in queues:
            queue_length = redis_client.llen(queue)
            logger.info(f"队列 {queue} 中有 {queue_length} 个任务")
            
            if queue_length > 0:
                # 清空队列
                redis_client.delete(queue)
                logger.info(f"已清空队列 {queue}")
        
        # 清空结果存储
        result_keys = redis_client.keys("dramatiq:results:*")
        logger.info(f"找到 {len(result_keys)} 个结果键")
        
        if result_keys:
            # 清空结果
            redis_client.delete(*result_keys)
            logger.info(f"已清空 {len(result_keys)} 个结果键")
            
    except Exception as e:
        logger.error(f"清空失败: {str(e)}")
        raise

if __name__ == "__main__":
    asyncio.run(main())
