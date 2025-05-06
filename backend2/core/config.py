"""
配置模块

存储应用的全局配置
"""
from pydantic import BaseSettings, Field
from typing import Optional, Dict, Any, List


class Settings(BaseSettings):
    """应用配置类"""
    # API版本
    API_VERSION: str = "1.0.0"

    # 图像生成服务配置
    IMAGE_MAX_POLLING_ATTEMPTS: int = Field(default=30, description="图像生成任务轮询最大次数")
    IMAGE_POLLING_INTERVAL: float = Field(default=2.0, description="图像生成任务轮询间隔（秒）")

    # 环境变量配置
    MAKE_API_TOKEN: Optional[str] = Field(default=None, description="Make API的认证Token")

    class Config:
        env_file = ".env"
        case_sensitive = True


# 创建全局设置实例
settings = Settings()