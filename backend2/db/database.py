"""
数据库连接模块

使用 Peewee 的 DatabaseProxy 对象管理数据库连接
"""
from peewee import DatabaseProxy
from playhouse.pool import PooledPostgresqlDatabase
from backend2.core.config import settings

# 创建数据库代理对象
test_db_proxy = DatabaseProxy()

def initialize_test_db():
    """
    初始化测试数据库连接

    使用配置中的测试数据库设置初始化数据库代理对象
    """
    test_db = PooledPostgresqlDatabase(
        settings.TEST_DB_NAME,
        user=settings.TEST_DB_USER,
        password=settings.TEST_DB_PASSWORD,
        host=settings.TEST_DB_HOST,
        port=settings.TEST_DB_PORT,
        max_connections=settings.TEST_DB_MAX_CONNECTIONS,
        stale_timeout=settings.TEST_DB_STALE_TIMEOUT,
        autorollback=True,
        autoconnect=True,
    )
    test_db_proxy.initialize(test_db)
    return test_db

def close_test_db():
    """
    关闭测试数据库连接
    """
    if not test_db_proxy.is_closed():
        test_db_proxy.close()
