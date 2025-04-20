from typing import Dict, Any, Optional
from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer

from app.core.config import settings
from app.core.security import verify_token
from app.db.mongodb import get_database
from app.models.user import Role
from app.crud import user as user_crud

# OAuth2密码Bearer
oauth2_scheme = OAuth2PasswordBearer(tokenUrl=f"{settings.API_V1_STR}/auth/token")

async def get_current_user(token: str = Depends(oauth2_scheme)) -> Dict[str, Any]:
    """
    获取当前用户

    Args:
        token: JWT令牌

    Returns:
        当前用户

    Raises:
        HTTPException: 认证失败
    """
    # 验证令牌
    payload = verify_token(token)

    # 提取用户信息
    user_id: str = payload.get("sub")
    email: str = payload.get("email")
    if user_id is None or email is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="无效的认证凭据",
            headers={"WWW-Authenticate": "Bearer"},
        )

    # 使用邮箱获取用户，避免ObjectId错误
    db = await get_database()
    user = await user_crud.get_by_email(db, email)

    if user is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="用户不存在",
            headers={"WWW-Authenticate": "Bearer"},
        )

    # 检查用户是否激活
    if not user.get("is_active", False):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="用户已禁用",
            headers={"WWW-Authenticate": "Bearer"},
        )

    return user

async def get_current_active_user(current_user: Dict[str, Any] = Depends(get_current_user)) -> Dict[str, Any]:
    """
    获取当前活跃用户

    Args:
        current_user: 当前用户

    Returns:
        当前活跃用户

    Raises:
        HTTPException: 用户已禁用
    """
    if not current_user.get("is_active", False):
        raise HTTPException(status_code=400, detail="用户已禁用")
    return current_user

async def get_current_admin_user(current_user: Dict[str, Any] = Depends(get_current_active_user)) -> Dict[str, Any]:
    """
    获取当前管理员用户

    Args:
        current_user: 当前活跃用户

    Returns:
        当前管理员用户

    Raises:
        HTTPException: 权限不足
    """
    roles = current_user.get("roles", [])
    if Role.ADMIN.value not in roles:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="权限不足，需要管理员权限",
        )
    return current_user

async def get_current_admin_or_manager_user(current_user: Dict[str, Any] = Depends(get_current_active_user)) -> Dict[str, Any]:
    """
    获取当前管理员或经理用户

    Args:
        current_user: 当前活跃用户

    Returns:
        当前管理员或经理用户

    Raises:
        HTTPException: 权限不足
    """
    roles = current_user.get("roles", [])
    if Role.ADMIN.value not in roles and Role.MANAGER.value not in roles:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="权限不足，需要管理员或经理权限",
        )
    return current_user

async def get_optional_current_user(token: Optional[str] = Depends(oauth2_scheme)) -> Optional[Dict[str, Any]]:
    """
    获取可选的当前用户

    Args:
        token: JWT令牌

    Returns:
        当前用户，如果未认证则返回None
    """
    if not token:
        return None

    try:
        return await get_current_user(token)
    except HTTPException:
        return None
