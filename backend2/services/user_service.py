"""
用户服务模块

提供用户相关的业务逻辑
"""
import logging
from typing import List, Optional, Dict, Any, Set
from datetime import datetime

from backend2.models.db.user import User, Role, Permission
from backend2.core.security import get_password_hash
from backend2.core.auth import require_permission

# 配置日志
logger = logging.getLogger(__name__)


def create_user(username: str, password: str, roles: List[str] = None) -> User:
    """
    创建用户
    
    Args:
        username: 用户名
        password: 密码
        roles: 角色列表，默认为普通用户
        
    Returns:
        创建的用户对象
    """
    # 检查用户名是否已存在
    if User.select().where(User.username == username).exists():
        raise ValueError(f"用户名 {username} 已存在")
    
    # 设置默认角色
    if not roles:
        roles = [Role.USER.value]
    
    # 创建用户
    user = User.create(
        username=username,
        hashed_password=get_password_hash(password),
        roles=roles,
        is_active=True,
        created_at=datetime.now(),
        updated_at=datetime.now(),
    )
    
    logger.info(f"创建用户成功: {username}, 角色: {roles}")
    return user


@require_permission(Permission.GLOBAL_ASSIGN_PERMISSIONS)
def assign_roles(user: User, target_username: str, roles: List[str]) -> User:
    """
    分配角色
    
    Args:
        user: 当前用户（需要有分配权限的权限）
        target_username: 目标用户名
        roles: 角色列表
        
    Returns:
        更新后的用户对象
    """
    # 获取目标用户
    try:
        target_user = User.get(User.username == target_username)
    except User.DoesNotExist:
        raise ValueError(f"用户 {target_username} 不存在")
    
    # 更新角色
    target_user.roles = roles
    target_user.updated_at = datetime.now()
    target_user.save()
    
    logger.info(f"用户 {user.username} 为用户 {target_username} 分配角色: {roles}")
    return target_user


def get_all_users(skip: int = 0, limit: int = 100) -> List[User]:
    """
    获取所有用户
    
    Args:
        skip: 跳过的记录数
        limit: 返回的最大记录数
        
    Returns:
        用户列表
    """
    return list(User.select().offset(skip).limit(limit))


def get_user_by_id(user_id: str) -> Optional[User]:
    """
    通过ID获取用户
    
    Args:
        user_id: 用户ID
        
    Returns:
        用户对象，如果不存在则返回 None
    """
    try:
        return User.get_by_id(user_id)
    except User.DoesNotExist:
        return None


def get_user_permissions(username: str) -> Set[Permission]:
    """
    获取用户权限
    
    Args:
        username: 用户名
        
    Returns:
        权限集合
    """
    try:
        user = User.get(User.username == username)
        return user.get_permissions()
    except User.DoesNotExist:
        return set()


@require_permission(Permission.GLOBAL_CREATE_USER)
def create_admin_user(user: User, username: str, password: str) -> User:
    """
    创建管理员用户
    
    Args:
        user: 当前用户（需要有创建用户的权限）
        username: 用户名
        password: 密码
        
    Returns:
        创建的用户对象
    """
    return create_user(username, password, roles=[Role.ADMIN.value])
