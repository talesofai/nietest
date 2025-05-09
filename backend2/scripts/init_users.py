"""
用户初始化脚本

用于创建初始用户
"""
import logging
import sys
from backend2.core import initialize_app, shutdown_app
from backend2.models.db.user import User, Role
from backend2.services.user_service import create_user
from backend2.core.security import get_password_hash

# 配置日志
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

def create_initial_users():
    """
    创建初始用户
    """
    logger.info("正在创建初始用户...")
    
    # 检查是否已存在管理员用户
    if User.select().where(User.username == "admin").exists():
        logger.info("管理员用户已存在，跳过创建")
    else:
        # 创建管理员用户
        admin = create_user(
            username="admin",
            password="admin123",
            roles=[Role.ADMIN.value]
        )
        logger.info(f"创建管理员用户成功: {admin.username}")
    
    # 创建其他角色的用户
    roles = [
        (Role.GUEST.value, "guest", "guest123"),
        (Role.USER.value, "user", "user123"),
        (Role.PRO_USER.value, "pro_user", "pro123"),
        (Role.MANAGER.value, "manager", "manager123")
    ]
    
    for role, username, password in roles:
        if User.select().where(User.username == username).exists():
            logger.info(f"用户 {username} 已存在，跳过创建")
        else:
            user = create_user(
                username=username,
                password=password,
                roles=[role]
            )
            logger.info(f"创建用户成功: {user.username}, 角色: {role}")
    
    logger.info("初始用户创建完成")

def main():
    """
    主函数
    """
    try:
        # 初始化应用
        db = initialize_app()
        
        # 创建初始用户
        create_initial_users()
        
        # 关闭应用
        shutdown_app()
        
        logger.info("用户初始化成功")
        return 0
    except Exception as e:
        logger.error(f"用户初始化失败: {str(e)}")
        return 1

if __name__ == "__main__":
    sys.exit(main())
