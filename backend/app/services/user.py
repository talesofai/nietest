from typing import Dict, Any, List, Optional
from datetime import datetime

from app.db.mongodb import get_database
from app.crud import user as user_crud
from app.core.security import verify_password, get_password_hash
from app.schemas.user import UserCreate, UserUpdate

async def authenticate_user(email: str, password: str) -> Optional[Dict[str, Any]]:
    """
    验证用户
    
    Args:
        email: 用户邮箱
        password: 用户密码
        
    Returns:
        用户信息，如果验证失败则返回None
    """
    db = await get_database()
    user = await user_crud.get_by_email(db, email)
    
    if not user:
        return None
    
    if not verify_password(password, user["hashed_password"]):
        return None
    
    return user

async def get_user(user_id: str) -> Optional[Dict[str, Any]]:
    """
    获取用户
    
    Args:
        user_id: 用户ID
        
    Returns:
        用户信息，如果不存在则返回None
    """
    db = await get_database()
    return await user_crud.get(db, user_id)

async def get_user_by_email(email: str) -> Optional[Dict[str, Any]]:
    """
    通过邮箱获取用户
    
    Args:
        email: 用户邮箱
        
    Returns:
        用户信息，如果不存在则返回None
    """
    db = await get_database()
    return await user_crud.get_by_email(db, email)

async def create_user(user_data: UserCreate) -> Dict[str, Any]:
    """
    创建用户
    
    Args:
        user_data: 用户创建数据
        
    Returns:
        创建的用户
    """
    db = await get_database()
    return await user_crud.create(db, obj_in=user_data)

async def update_user(user_id: str, user_data: UserUpdate) -> Optional[Dict[str, Any]]:
    """
    更新用户
    
    Args:
        user_id: 用户ID
        user_data: 用户更新数据
        
    Returns:
        更新后的用户，如果不存在则返回None
    """
    db = await get_database()
    return await user_crud.update(db, id=user_id, obj_in=user_data)

async def delete_user(user_id: str) -> bool:
    """
    删除用户
    
    Args:
        user_id: 用户ID
        
    Returns:
        是否删除成功
    """
    db = await get_database()
    return await user_crud.delete(db, id=user_id)

async def list_users(skip: int = 0, limit: int = 100) -> List[Dict[str, Any]]:
    """
    获取用户列表
    
    Args:
        skip: 跳过的记录数
        limit: 返回的记录数
        
    Returns:
        用户列表
    """
    db = await get_database()
    return await user_crud.get_multi(db, skip=skip, limit=limit)

async def change_password(user_id: str, current_password: str, new_password: str) -> bool:
    """
    修改密码
    
    Args:
        user_id: 用户ID
        current_password: 当前密码
        new_password: 新密码
        
    Returns:
        是否修改成功
    """
    db = await get_database()
    user = await user_crud.get(db, user_id)
    
    if not user:
        return False
    
    if not verify_password(current_password, user["hashed_password"]):
        return False
    
    # 更新密码
    hashed_password = get_password_hash(new_password)
    update_data = {
        "hashed_password": hashed_password,
        "updated_at": datetime.utcnow()
    }
    
    result = await user_crud.update(db, id=user_id, obj_in=update_data)
    return result is not None
