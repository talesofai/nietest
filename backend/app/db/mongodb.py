from motor.motor_asyncio import AsyncIOMotorClient
from typing import Dict, Any
import logging
import threading

from app.core.config import settings

# 配置日志
logger = logging.getLogger(__name__)

# 使用线程本地存储，确保每个线程有自己的连接
_thread_local = threading.local()

async def connect_to_mongo():
    """连接到MongoDB数据库"""
    # 检查线程本地存储中是否已有连接
    if hasattr(_thread_local, 'client') and _thread_local.client is not None:
        return

    try:
        # 创建客户端连接
        _thread_local.client = AsyncIOMotorClient(settings.MONGODB_URL)
        _thread_local.db = _thread_local.client[settings.DB_NAME]

        # 测试连接
        await _thread_local.db.command('ping')

        logger.info(f"Connected to MongoDB at {settings.MONGODB_URL}")
    except Exception as e:
        # 关闭客户端连接（如果已创建）
        if hasattr(_thread_local, 'client') and _thread_local.client is not None:
            _thread_local.client.close()
            _thread_local.client = None
            _thread_local.db = None

        logger.error(f"Failed to connect to MongoDB: {str(e)}")
        raise

async def close_mongo_connection():
    """关闭MongoDB连接"""
    if hasattr(_thread_local, 'client') and _thread_local.client is not None:
        _thread_local.client.close()
        _thread_local.client = None
        _thread_local.db = None
        logger.info("Closed MongoDB connection")

async def get_database():
    """获取数据库实例"""
    if not hasattr(_thread_local, 'db') or _thread_local.db is None:
        await connect_to_mongo()

    return _thread_local.db

def get_database_sync() -> Dict[str, Any]:
    """同步获取数据库实例（仅在已连接时使用）"""
    if not hasattr(_thread_local, 'db') or _thread_local.db is None:
        raise RuntimeError("数据库未连接，请先调用connect_to_mongo()")

    return _thread_local.db

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

        logger.info("Database indexes created successfully")
    except Exception as e:
        logger.error(f"Failed to create indexes: {str(e)}")
        raise
