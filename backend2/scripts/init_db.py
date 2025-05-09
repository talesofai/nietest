"""
数据库初始化脚本

用于初始化数据库表结构
"""
import logging
import sys
from backend2.core import initialize_app, shutdown_app
from backend2.models.db import User, Task, Subtask

# 配置日志
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

def create_tables():
    """
    创建数据库表
    """
    logger.info("正在创建数据库表...")
    
    # 创建表
    tables = [User, Task, Subtask]
    for table in tables:
        logger.info(f"正在创建表: {table._meta.table_name}")
        table.create_table(safe=True)
    
    logger.info("数据库表创建完成")

def main():
    """
    主函数
    """
    try:
        # 初始化应用
        db = initialize_app()
        
        # 创建表
        create_tables()
        
        # 关闭应用
        shutdown_app()
        
        logger.info("数据库初始化成功")
        return 0
    except Exception as e:
        logger.error(f"数据库初始化失败: {str(e)}")
        return 1

if __name__ == "__main__":
    sys.exit(main())
