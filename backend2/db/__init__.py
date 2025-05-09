"""
数据库模块

提供数据库连接和管理功能
"""
from backend2.db.database import test_db_proxy, initialize_test_db, close_test_db

# 为了向后兼容，保留原来的函数名
from backend2.db.db_manager import get_db, close_db, get_test_db

__all__ = ['test_db_proxy', 'initialize_test_db', 'close_test_db',
           'get_db', 'close_db', 'get_test_db']
