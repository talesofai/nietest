"""
配置模块

存储应用的全局配置
"""
import os

from dotenv import load_dotenv

load_dotenv()

class Settings:
    """应用配置类"""
    def __init__(self):
        # API版本
        self.API_VERSION = "1.0.0"

        # 数据库配置
        self.TEST_DB_HOST = os.getenv("TEST_DB_HOST", "localhost")
        self.TEST_DB_PORT = int(os.getenv("TEST_DB_PORT", "5432"))
        self.TEST_DB_NAME = os.getenv("TEST_DB_NAME", "database")
        self.TEST_DB_USER = os.getenv("TEST_DB_USER", "postgres")
        self.TEST_DB_PASSWORD = os.getenv("TEST_DB_PASSWORD", "")

        # 数据库连接池配置
        self.TEST_DB_MAX_CONNECTIONS = int(os.getenv("TEST_DB_MAX_CONNECTIONS", "8"))
        self.TEST_DB_STALE_TIMEOUT = int(os.getenv("TEST_DB_STALE_TIMEOUT", "300"))

        # 图像生成服务配置
        self.TEST_IMAGE_MAX_POLLING_ATTEMPTS = int(os.getenv("TEST_IMAGE_MAX_POLLING_ATTEMPTS", "30"))
        self.TEST_IMAGE_POLLING_INTERVAL = float(os.getenv("TEST_IMAGE_POLLING_INTERVAL", "2.0"))

        # 环境变量配置
        self.TEST_MAKE_API_TOKEN = os.getenv("TEST_MAKE_API_TOKEN")


# 创建全局设置实例
settings = Settings()