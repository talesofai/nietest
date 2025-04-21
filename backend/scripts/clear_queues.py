"""
清空Dramatiq队列

此脚本用于清空Redis中Dramatiq的队列和结果存储。
主要用于重置系统状态或解决队列卡住的问题。
谨慎使用，因为这将删除所有正在进行的任务。
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

        # 要清空的队列 - 只保留当前使用的队列
        queues = [
            "dramatiq:actor-make-image",  # 图像生成队列
            "dramatiq:default"            # 默认队列
        ]

        # 询问用户确认
        print("\n警告: 此操作将清空所有Dramatiq队列和结果存储!")
        print("这将删除所有正在进行的任务和存储的结果。\n")

        confirm = input("是否继续? (y/N): ")
        if confirm.lower() != 'y':
            print("操作已取消\n")
            return

        # 清空队列
        print("\n===== 清空队列 =====\n")
        for queue in queues:
            queue_length = redis_client.llen(queue)
            print(f"队列 {queue}: {queue_length} 个任务")

            if queue_length > 0:
                # 清空队列
                redis_client.delete(queue)
                print(f"  已清空队列 {queue}")

        # 清空活动消息集合
        active_messages_key = "dramatiq:default.active_messages"
        active_count = redis_client.scard(active_messages_key)
        print(f"\n活动消息数量: {active_count}")

        if active_count > 0:
            redis_client.delete(active_messages_key)
            print(f"  已清空活动消息集合")

        # 清空结果存储
        result_keys = redis_client.keys("dramatiq:results:*")
        print(f"\n结果键数量: {len(result_keys)}")

        if result_keys:
            # 清空结果
            redis_client.delete(*result_keys)
            print(f"  已清空 {len(result_keys)} 个结果键")

        print("\n所有Dramatiq队列和结果存储已清空\n")

    except Exception as e:
        logger.error(f"清空失败: {str(e)}")
        raise

if __name__ == "__main__":
    asyncio.run(main())
