from motor.motor_asyncio import AsyncIOMotorClient
from typing import Optional
import logging

from app.core.config import settings

# 配置日志
logger = logging.getLogger(__name__)

# 全局数据库客户端实例
client: Optional[AsyncIOMotorClient] = None
db = None

async def connect_to_mongo():
    """连接到MongoDB数据库"""
    global client, db
    if client is None:
        try:
            client = AsyncIOMotorClient(settings.MONGODB_URL)
            db = client[settings.DB_NAME]

            # 创建必要的索引
            await create_indexes()

            logger.info(f"Connected to MongoDB at {settings.MONGODB_URL}")
        except Exception as e:
            logger.error(f"Failed to connect to MongoDB: {str(e)}")
            raise

async def close_mongo_connection():
    """关闭MongoDB连接"""
    global client
    if client:
        client.close()
        logger.info("Closed MongoDB connection")

async def get_database():
    """获取数据库实例"""
    if db is None:
        await connect_to_mongo()
    return db

async def create_indexes():
    """创建数据库索引"""
    try:
        # 为用户集合创建索引
        await db.users.create_index("email", unique=True)

        # 为任务集合创建索引
        await db.tasks.create_index("task_uuid", unique=True)
        await db.tasks.create_index("username")
        await db.tasks.create_index("created_at")
        await db.tasks.create_index("status")
        await db.tasks.create_index("is_deleted")

        # 为Dramatiq任务集合创建索引
        await db.dramatiq_tasks.create_index("dramatiq_message_id", unique=True)
        await db.dramatiq_tasks.create_index("parent_task_id")
        await db.dramatiq_tasks.create_index([("parent_task_id", 1), ("combination_key", 1)], unique=True)
        await db.dramatiq_tasks.create_index("status")
        await db.dramatiq_tasks.create_index("created_at")

        logger.info("Database indexes created successfully")
    except Exception as e:
        logger.error(f"Failed to create indexes: {str(e)}")
        raise
