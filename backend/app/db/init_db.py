import asyncio
import logging
import sys
import os
import warnings
from datetime import datetime

from app.db.mongodb import connect_to_mongo, get_database
from app.core.security import get_password_hash
from app.models.user import User, Role

# 日志配置
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# 忽略passlib的bcrypt警告
warnings.filterwarnings("ignore", message=".*error reading bcrypt version.*")

async def create_admin_user(email: str, password: str, fullname: str = "管理员"):
    """创建管理员用户"""
    db = await get_database()
    
    # 检查用户是否已存在
    existing_user = await db.users.find_one({"email": email})
    if existing_user:
        logger.info(f"管理员用户 {email} 已存在")
        return
    
    # 创建管理员用户
    try:
        hashed_password = get_password_hash(password)
        user = {
            "email": email,
            "hashed_password": hashed_password,
            "fullname": fullname,
            "roles": [Role.ADMIN.value],
            "is_active": True,
            "created_at": datetime.utcnow(),
            "updated_at": datetime.utcnow()
        }
        
        # 插入到数据库
        result = await db.users.insert_one(user)
        logger.info(f"成功创建管理员用户: {email}")
    except Exception as e:
        logger.error(f"创建管理员用户失败: {str(e)}")
        raise

async def init_db():
    """初始化数据库"""
    logger.info("开始连接数据库...")
    await connect_to_mongo()
    logger.info("数据库连接成功")
    
    # 创建管理员用户 - 默认或自定义
    if "--custom" in sys.argv:
        # 使用自定义管理员信息
        custom_email = os.getenv("ADMIN_EMAIL", "admin@example.com")
        custom_password = os.getenv("ADMIN_PASSWORD", "admin123")
        custom_fullname = os.getenv("ADMIN_FULLNAME", "系统管理员")
        
        logger.info(f"正在创建自定义管理员用户: {custom_email}")
        await create_admin_user(custom_email, custom_password, custom_fullname)
    else:
        # 使用默认管理员信息
        logger.info("正在创建默认管理员用户...")
        await create_admin_user("admin@example.com", "admin123", "系统管理员")
    
    logger.info("数据库初始化完成")

if __name__ == "__main__":
    try:
        logger.info("开始初始化数据库...")
        asyncio.run(init_db())
        logger.info("初始化完成")
    except Exception as e:
        logger.error(f"初始化数据库失败: {str(e)}")
        sys.exit(1)
