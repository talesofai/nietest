import json
import logging
from typing import Any, Optional
import redis.asyncio as redis

from app.core.config import settings

# 配置日志
logger = logging.getLogger(__name__)

# Redis缓存类
class RedisCache:
    def __init__(self, redis_url: str):
        """初始化Redis缓存
        
        Args:
            redis_url: Redis连接URL
        """
        self.redis_url = redis_url
        self.redis_client = None
    
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
            value = await self.redis_client.get(key)
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
            await self.redis_client.set(
                key,
                json.dumps(value),
                ex=expire if expire > 0 else None
            )
        except Exception as e:
            logger.error(f"Failed to set cache value for key {key}: {str(e)}")
    
    async def delete(self, key: str):
        """删除缓存值
        
        Args:
            key: 缓存键
        """
        if not self.redis_client:
            await self.connect()
        
        try:
            await self.redis_client.delete(key)
        except Exception as e:
            logger.error(f"Failed to delete cache value for key {key}: {str(e)}")
    
    async def ping(self):
        """测试Redis连接"""
        if not self.redis_client:
            await self.connect()
        
        try:
            return await self.redis_client.ping()
        except Exception as e:
            logger.error(f"Failed to ping Redis: {str(e)}")
            return False

# 创建Redis缓存实例
_redis_cache = None

def get_redis_cache() -> RedisCache:
    """获取Redis缓存实例
    
    Returns:
        Redis缓存实例
    """
    global _redis_cache
    if _redis_cache is None:
        _redis_cache = RedisCache(settings.REDIS_URL)
    return _redis_cache
