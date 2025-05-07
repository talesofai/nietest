import os
from playhouse.pool import PooledPostgresqlDatabase

# 从环境变量获取数据库配置
DB_HOST = os.getenv("DB_HOST", "localhost")
DB_PORT = int(os.getenv("DB_PORT", "5432"))
DB_NAME = os.getenv("DB_NAME", "czy_database")
DB_USER = os.getenv("DB_USER", "nietawrite9")
DB_PASSWORD = os.getenv("DB_PASSWORD", "nieta202139")

# 创建数据库连接池
db = PooledPostgresqlDatabase(
    DB_NAME,
    user=DB_USER,
    password=DB_PASSWORD,
    host=DB_HOST,
    port=DB_PORT,
    max_connections=8,
    stale_timeout=300,
    autorollback=True,
    autoconnect=True,
)
