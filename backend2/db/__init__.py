"""
数据库模块

提供数据库连接和管理功能
"""
from backend2.db.database import test_db_proxy, initialize_test_db, close_test_db


__all__ = ['test_db_proxy', 'initialize_test_db', 'close_test_db']
