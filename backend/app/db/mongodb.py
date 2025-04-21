from motor.motor_asyncio import AsyncIOMotorClient
from typing import Dict, Any
import logging

from app.core.config import settings

# 配置日志
logger = logging.getLogger(__name__)

# 全局数据库客户端实例
client = None
db = None

async def connect_to_mongo():
    """连接到MongoDB数据库"""
    global client, db

    # 如果已经连接，直接返回
    if client is not None:
        return

    try:
        # 创建客户端连接
        client = AsyncIOMotorClient(settings.MONGODB_URL)
        db = client[settings.DB_NAME]

        # 测试连接
        await db.command('ping')

        logger.info(f"Connected to MongoDB at {settings.MONGODB_URL}")
    except Exception as e:
        # 关闭客户端连接（如果已创建）
        if client is not None:
            client.close()
            client = None
            db = None

        logger.error(f"Failed to connect to MongoDB: {str(e)}")
        raise

async def close_mongo_connection():
    """关闭MongoDB连接"""
    global client, db

    if client is not None:
        client.close()
        client = None
        db = None
        logger.info("Closed MongoDB connection")

async def get_database():
    """获取数据库实例"""
    global client, db

    if db is None:
        await connect_to_mongo()

    return db

def get_database_sync() -> Dict[str, Any]:
    """同步获取数据库实例（仅在已连接时使用）"""
    if db is None:
        raise RuntimeError("数据库未连接，请先调用connect_to_mongo()")

    return db

async def create_indexes(db_instance):
    """创建数据库索引

    Args:
        db_instance: 数据库实例
    """
    try:
        # 为用户集合创建索引
        await db_instance.users.create_index("email", unique=True)

        # 为任务集合创建索引
        await db_instance.tasks.create_index("task_uuid", unique=True)
        await db_instance.tasks.create_index("username")
        await db_instance.tasks.create_index("created_at")
        await db_instance.tasks.create_index("status")
        await db_instance.tasks.create_index("is_deleted")

        # 为Dramatiq任务集合创建索引
        await db_instance.dramatiq_tasks.create_index("dramatiq_message_id", unique=True)
        await db_instance.dramatiq_tasks.create_index("parent_task_id")
        # 使用变量索引的组合来唯一标识任务
        await db_instance.dramatiq_tasks.create_index([("parent_task_id", 1), ("v0", 1), ("v1", 1), ("v2", 1), ("v3", 1), ("v4", 1), ("v5", 1)])
        await db_instance.dramatiq_tasks.create_index("status")
        await db_instance.dramatiq_tasks.create_index("created_at")

        # 为Worker集合创建索引
        await db_instance.workers.create_index("worker_id", unique=True)
        await db_instance.workers.create_index("status")
        await db_instance.workers.create_index("last_active_at")

        logger.info("Database indexes created successfully")
    except Exception as e:
        logger.error(f"Failed to create indexes: {str(e)}")
        raise
