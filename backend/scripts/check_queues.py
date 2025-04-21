"""
检查Dramatiq队列状态

此脚本用于检查Redis中Dramatiq队列的状态，包括队列长度和任务详情。
主要用于调试和监控目的。
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

        # 检查队列 - 只保留当前使用的队列
        queues = [
            "dramatiq:actor-make-image",  # 图像生成队列
            "dramatiq:default"            # 默认队列
        ]

        # 打印队列状态
        print("\n===== Dramatiq队列状态 =====\n")

        for queue in queues:
            queue_length = redis_client.llen(queue)
            print(f"队列 {queue}: {queue_length} 个任务")

            # 如果队列中有任务，查看任务详情
            if queue_length > 0:
                # 获取队列中的所有任务（不移除）
                tasks = redis_client.lrange(queue, 0, -1)
                print(f"\n队列 {queue} 中的任务详情:")
                for i, task in enumerate(tasks):
                    print(f"  任务 {i+1}: {task[:100].decode('utf-8', errors='ignore')}...")
                print()

        # 检查活动消息集合
        active_messages_key = "dramatiq:default.active_messages"
        active_count = redis_client.scard(active_messages_key)
        print(f"\n活动消息数量: {active_count}\n")

        if active_count > 0:
            active_messages = redis_client.smembers(active_messages_key)
            print("活动消息详情:")
            for i, msg_id in enumerate(active_messages):
                print(f"  消息 {i+1}: {msg_id.decode('utf-8', errors='ignore')}")
            print()

        # 检查结果存储
        result_keys = redis_client.keys("dramatiq:results:*")
        print(f"\n结果键数量: {len(result_keys)}\n")

        if result_keys:
            print("结果键详情:")
            for i, key in enumerate(result_keys):
                result = redis_client.get(key)
                key_str = key.decode('utf-8', errors='ignore')
                result_str = result[:100].decode('utf-8', errors='ignore') if result else "None"
                print(f"  结果 {i+1}: {key_str} = {result_str}...")
            print()

    except Exception as e:
        logger.error(f"检查失败: {str(e)}")
        raise

if __name__ == "__main__":
    asyncio.run(main())
