import logging
import sys
import os
from logging.handlers import RotatingFileHandler

def configure_logging(log_level: str = "INFO"):
    """配置日志系统

    Args:
        log_level: 日志级别，默认为INFO
    """
    # 获取日志级别
    numeric_level = getattr(logging, log_level.upper(), logging.INFO)

    # 基本配置
    logging.basicConfig(
        level=numeric_level,
        format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
        datefmt="%Y-%m-%d %H:%M:%S",
        handlers=[
            logging.StreamHandler(sys.stdout)
        ]
    )

    # 设置第三方库的日志级别
    logging.getLogger("uvicorn").setLevel(logging.WARNING)
    logging.getLogger("uvicorn.access").setLevel(logging.WARNING)
    logging.getLogger("dramatiq").setLevel(logging.INFO)
    logging.getLogger("httpx").setLevel(logging.WARNING)  # 将 httpx 的日志级别设置为 WARNING

    # 创建文件处理器
    try:
        # 确保logs目录存在
        logs_dir = os.path.join(os.getcwd(), "logs")
        if not os.path.exists(logs_dir):
            os.makedirs(logs_dir)

        file_handler = RotatingFileHandler(
            os.path.join(logs_dir, "app.log"),
            maxBytes=10*1024*1024,  # 10MB
            backupCount=5
        )
        file_handler.setLevel(numeric_level)
        file_handler.setFormatter(logging.Formatter(
            "%(asctime)s - %(name)s - %(levelname)s - %(message)s"
        ))

        # 添加处理器到根日志记录器
        logging.getLogger().addHandler(file_handler)
    except Exception as e:
        logging.warning(f"无法创建日志文件: {str(e)}")

    # 返回根日志记录器
    return logging.getLogger()
