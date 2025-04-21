import json
import logging
from typing import Any, Optional, List, Dict, Union, Pattern
import redis.asyncio as redis
import re
from bson import ObjectId
from datetime import datetime

from app.core.config import settings

# 配置日志
logger = logging.getLogger(__name__)

# 自定义JSON编码器
class MongoJSONEncoder(json.JSONEncoder):
    """处理MongoDB特殊类型和datetime的JSON编码器"""
    def default(self, obj):
        if isinstance(obj, ObjectId):
            return str(obj)  # 将ObjectId转换为字符串
        elif isinstance(obj, datetime):
            return obj.isoformat()  # 将datetime转换为ISO格式字符串
        return super().default(obj)

# Redis缓存类
class RedisCache:
    def __init__(self, redis_url: str, key_prefix: str = "app:"):
        """初始化Redis缓存

        Args:
            redis_url: Redis连接URL
            key_prefix: 键前缀，用于区分不同应用的缓存
        """
        self.redis_url = redis_url
        self.redis_client = None
        self.key_prefix = key_prefix

    def _get_prefixed_key(self, key: str) -> str:
        """获取带前缀的键名

        Args:
            key: 原始键名

        Returns:
            带前缀的键名
        """
        if key.startswith(self.key_prefix):
            return key
        return f"{self.key_prefix}{key}"

    async def connect(self):
        """连接到Redis"""
        if self.redis_client is None:
            try:
                self.redis_client = redis.from_url(self.redis_url)
                # 测试连接
                await self.redis_client.ping()
                logger.info(f"Connected to Redis at {self.redis_url}")
            except Exception as e:
                logger.error(f"Failed to connect to Redis: {str(e)}")
                raise

    async def disconnect(self):
        """断开Redis连接"""
        if self.redis_client:
            await self.redis_client.close()
            self.redis_client = None
            logger.info("Closed Redis connection")

    async def get(self, key: str) -> Optional[Any]:
        """获取缓存值

        Args:
            key: 缓存键

        Returns:
            缓存值，如果不存在则返回None
        """
        if not self.redis_client:
            await self.connect()

        try:
            prefixed_key = self._get_prefixed_key(key)
            value = await self.redis_client.get(prefixed_key)
            if value:
                return json.loads(value)
            return None
        except Exception as e:
            logger.error(f"Failed to get cache value for key {key}: {str(e)}")
            return None

    async def set(self, key: str, value: Any, expire: int = 0):
        """设置缓存值

        Args:
            key: 缓存键
            value: 缓存值
            expire: 过期时间（秒），0表示不过期
        """
        if not self.redis_client:
            await self.connect()

        try:
            prefixed_key = self._get_prefixed_key(key)
            await self.redis_client.set(
                prefixed_key,
                json.dumps(value, cls=MongoJSONEncoder),  # 使用自定义编码器
                ex=expire if expire > 0 else None
            )
            logger.debug(f"Set cache value for key {prefixed_key}, expire={expire if expire > 0 else 'None'}")
        except Exception as e:
            logger.error(f"Failed to set cache value for key {key}: {str(e)}")

    async def delete(self, key: str) -> bool:
        """删除缓存值

        Args:
            key: 缓存键

        Returns:
            是否成功删除
        """
        if not self.redis_client:
            await self.connect()

        try:
            prefixed_key = self._get_prefixed_key(key)
            result = await self.redis_client.delete(prefixed_key)
            success = result > 0
            if success:
                logger.debug(f"Deleted cache key {prefixed_key}")
            return success
        except Exception as e:
            logger.error(f"Failed to delete cache value for key {key}: {str(e)}")
            return False

    async def delete_pattern(self, pattern: str) -> int:
        """删除匹配模式的所有键

        Args:
            pattern: 键模式，例如 "task:*"

        Returns:
            删除的键数量
        """
        if not self.redis_client:
            await self.connect()

        try:
            prefixed_pattern = self._get_prefixed_key(pattern)
            # 使用scan_iter查找匹配的键
            keys_to_delete = []
            async for key in self.redis_client.scan_iter(match=prefixed_pattern):
                keys_to_delete.append(key)

            # 如果有匹配的键，批量删除
            deleted_count = 0
            if keys_to_delete:
                deleted_count = await self.redis_client.delete(*keys_to_delete)
                logger.debug(f"Deleted {deleted_count} keys matching pattern {prefixed_pattern}")

            return deleted_count
        except Exception as e:
            logger.error(f"Failed to delete keys matching pattern {pattern}: {str(e)}")
            return 0

    async def exists(self, key: str) -> bool:
        """检查键是否存在

        Args:
            key: 缓存键

        Returns:
            键是否存在
        """
        if not self.redis_client:
            await self.connect()

        try:
            prefixed_key = self._get_prefixed_key(key)
            return await self.redis_client.exists(prefixed_key) > 0
        except Exception as e:
            logger.error(f"Failed to check if key {key} exists: {str(e)}")
            return False

    async def get_keys(self, pattern: str = "*") -> List[str]:
        """获取匹配模式的所有键

        Args:
            pattern: 键模式，例如 "task:*"

        Returns:
            匹配的键列表
        """
        if not self.redis_client:
            await self.connect()

        try:
            prefixed_pattern = self._get_prefixed_key(pattern)
            keys = []
            async for key in self.redis_client.scan_iter(match=prefixed_pattern):
                # 移除前缀后返回
                if key.startswith(self.key_prefix.encode()):
                    keys.append(key.decode()[len(self.key_prefix):])
                else:
                    keys.append(key.decode())
            return keys
        except Exception as e:
            logger.error(f"Failed to get keys matching pattern {pattern}: {str(e)}")
            return []

    async def get_ttl(self, key: str) -> int:
        """获取键的剩余生存时间

        Args:
            key: 缓存键

        Returns:
            剩余生存时间（秒），-1表示永不过期，-2表示键不存在
        """
        if not self.redis_client:
            await self.connect()

        try:
            prefixed_key = self._get_prefixed_key(key)
            return await self.redis_client.ttl(prefixed_key)
        except Exception as e:
            logger.error(f"Failed to get TTL for key {key}: {str(e)}")
            return -2

    async def set_ttl(self, key: str, expire: int) -> bool:
        """设置键的过期时间

        Args:
            key: 缓存键
            expire: 过期时间（秒）

        Returns:
            是否成功设置
        """
        if not self.redis_client:
            await self.connect()

        try:
            prefixed_key = self._get_prefixed_key(key)
            return await self.redis_client.expire(prefixed_key, expire)
        except Exception as e:
            logger.error(f"Failed to set TTL for key {key}: {str(e)}")
            return False

    async def ping(self) -> bool:
        """测试Redis连接

        Returns:
            连接是否正常
        """
        if not self.redis_client:
            await self.connect()

        try:
            return await self.redis_client.ping()
        except Exception as e:
            logger.error(f"Failed to ping Redis: {str(e)}")
            return False

    async def clear_dramatiq_results(self, dramatiq_task_id: str) -> bool:
        """清除Dramatiq任务的结果

        Args:
            dramatiq_task_id: Dramatiq任务ID（UUID）

        Returns:
            是否成功清除
        """
        if not self.redis_client:
            await self.connect()

        try:
            # Dramatiq结果键格式: dramatiq:results:{dramatiq_task_id}
            result_key = f"dramatiq:results:{dramatiq_task_id}"
            deleted = await self.redis_client.delete(result_key)
            if deleted > 0:
                logger.debug(f"Cleared Dramatiq result for task {dramatiq_task_id}")
                return True
            return False
        except Exception as e:
            logger.error(f"Failed to clear Dramatiq result for task {dramatiq_task_id}: {str(e)}")
            return False

    async def clear_task_cache(self, task_id: str) -> int:
        """清除任务相关的所有缓存

        Args:
            task_id: 任务ID

        Returns:
            清除的缓存数量
        """
        if not self.redis_client:
            await self.connect()

        try:
            # 清除任务缓存
            task_key_pattern = f"task:{task_id}*"
            deleted_count = await self.delete_pattern(task_key_pattern)
            logger.debug(f"Cleared {deleted_count} cache entries for task {task_id}")
            return deleted_count
        except Exception as e:
            logger.error(f"Failed to clear task cache for task {task_id}: {str(e)}")
            return 0

# 创建Redis缓存实例
_redis_cache = None

def get_redis_cache() -> RedisCache:
    """获取Redis缓存实例

    Returns:
        Redis缓存实例
    """
    global _redis_cache
    if _redis_cache is None:
        _redis_cache = RedisCache(settings.REDIS_URL, settings.REDIS_KEY_PREFIX)
    return _redis_cache
