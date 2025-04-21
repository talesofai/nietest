import os
from typing import List
from pydantic_settings import BaseSettings
from dotenv import load_dotenv

# 加载.env文件
load_dotenv()

class Settings(BaseSettings):
    """应用配置类"""
    # 项目基本信息
    PROJECT_NAME: str = "Backend API"
    DESCRIPTION: str = "Backend API系统"
    VERSION: str = "0.1.0"

    # API配置
    API_V1_STR: str = "/api/v1"

    # CORS配置
    CORS_ORIGINS: List[str] = [
        "http://localhost:8080",
        "http://127.0.0.1:8080",
        "http://localhost:3000",
        "http://127.0.0.1:3000",
    ]

    # MongoDB配置
    MONGODB_URL: str = os.getenv("MONGODB_URL", "mongodb://localhost:27017")
    DB_NAME: str = os.getenv("DB_NAME", "backend2")

    # JWT配置
    SECRET_KEY: str = os.getenv("SECRET_KEY", "supersecretkey")
    ALGORITHM: str = os.getenv("ALGORITHM", "HS256")
    ACCESS_TOKEN_EXPIRE_MINUTES: int = int(os.getenv("ACCESS_TOKEN_EXPIRE_MINUTES", "10080"))

    # Redis配置
    REDIS_URL: str = os.getenv("REDIS_URL", "redis://localhost:6379/0")
    REDIS_KEY_PREFIX: str = os.getenv("REDIS_KEY_PREFIX", "app:")

    # 缓存配置
    CACHE_ENABLED: bool = os.getenv("CACHE_ENABLED", "False").lower() == "true"  # 默认禁用缓存
    CACHE_TASK_TTL: int = int(os.getenv("CACHE_TASK_TTL", "300"))  # 5分钟
    CACHE_CLEANUP_AFTER_PERSIST: bool = os.getenv("CACHE_CLEANUP_AFTER_PERSIST", "True").lower() == "true"

    # 日志配置
    LOG_LEVEL: str = os.getenv("LOG_LEVEL", "INFO")

    # Nieta API配置
    NIETA_XTOKEN: str = os.getenv("NIETA_XTOKEN", "")

    # Worker配置
    # 最大Worker数量
    WORKER_MAX_COUNT: int = int(os.getenv("WORKER_MAX_COUNT", "200"))
    # Worker空闲超时时间（秒）
    WORKER_IDLE_TIMEOUT: int = int(os.getenv("WORKER_IDLE_TIMEOUT", "60"))
    # Worker扩展间隔（秒）
    WORKER_SCALE_INTERVAL: int = int(os.getenv("WORKER_SCALE_INTERVAL", "15"))
    # 每次最多扩展的Worker数量
    WORKER_MAX_SCALE_PER_INTERVAL: int = int(os.getenv("WORKER_MAX_SCALE_PER_INTERVAL", "1"))
    # 当任务数量是Worker数量的多少倍时扩展Worker
    WORKER_SCALE_THRESHOLD: float = float(os.getenv("WORKER_SCALE_THRESHOLD", "2.0"))

    # tasks默认设置
    TASKS_DEFAULT_CONCURRENCY: int = int(os.getenv("TASKS_DEFAULT_CONCURRENCY", "5"))  # 默认并发数

# 创建设置实例
settings = Settings()
