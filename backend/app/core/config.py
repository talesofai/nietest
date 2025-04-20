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

    # 缓存配置
    CACHE_ENABLED: bool = os.getenv("CACHE_ENABLED", "True").lower() == "true"
    CACHE_TASK_TTL: int = int(os.getenv("CACHE_TASK_TTL", "300"))  # 5分钟

    # 日志配置
    LOG_LEVEL: str = os.getenv("LOG_LEVEL", "INFO")

# 创建设置实例
settings = Settings()
