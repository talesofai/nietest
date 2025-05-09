from typing import Any, Dict, List, Optional, Union
from datetime import datetime
from bson import ObjectId

from app.models.user import User
from app.schemas.user import UserCreate, UserUpdate
from app.core.security import get_password_hash
from app.utils.timezone import get_beijing_now

async def get(db: Any, id: str) -> Optional[Dict[str, Any]]:
    """
    通过ID获取用户

    Args:
        db: 数据库连接
        id: 用户ID

    Returns:
        用户，如果不存在则返回None
    """
    user = await db.users.find_one({"_id": ObjectId(id)})
    if user:
        user["id"] = str(user.pop("_id"))
    return user

async def get_by_email(db: Any, email: str) -> Optional[Dict[str, Any]]:
    """
    通过邮箱获取用户

    Args:
        db: 数据库连接
        email: 用户邮箱

    Returns:
        用户，如果不存在则返回None
    """
    user = await db.users.find_one({"email": email})
    if user:
        user["id"] = str(user.pop("_id"))
    return user

async def get_multi(
    db: Any, *, skip: int = 0, limit: int = 100
) -> List[Dict[str, Any]]:
    """
    获取多个用户

    Args:
        db: 数据库连接
        skip: 跳过的记录数
        limit: 返回的记录数

    Returns:
        用户列表
    """
    cursor = db.users.find().skip(skip).limit(limit)
    users = await cursor.to_list(length=limit)

    # 转换ID为字符串
    for user in users:
        user["id"] = str(user.pop("_id"))

    return users

async def create(db: Any, *, obj_in: UserCreate) -> Dict[str, Any]:
    """
    创建用户

    Args:
        db: 数据库连接
        obj_in: 用户创建模式

    Returns:
        创建的用户
    """
    # 准备用户数据
    user_data = obj_in.dict(exclude={"password"})
    user_data["hashed_password"] = get_password_hash(obj_in.password)
    user_data["created_at"] = get_beijing_now()
    user_data["updated_at"] = get_beijing_now()

    # 插入用户
    result = await db.users.insert_one(user_data)

    # 获取创建的用户
    created_user = await get(db, str(result.inserted_id))
    return created_user

async def update(
    db: Any, *, id: str, obj_in: Union[UserUpdate, Dict[str, Any]]
) -> Optional[Dict[str, Any]]:
    """
    更新用户

    Args:
        db: 数据库连接
        id: 用户ID
        obj_in: 用户更新模式或字典

    Returns:
        更新后的用户，如果不存在则返回None
    """
    # 获取现有用户
    user = await get(db, id)
    if not user:
        return None

    # 准备更新数据
    if isinstance(obj_in, dict):
        update_data = obj_in
    else:
        update_data = obj_in.dict(exclude_unset=True)

    # 处理密码
    if "password" in update_data:
        update_data["hashed_password"] = get_password_hash(update_data.pop("password"))

    # 更新时间
    update_data["updated_at"] = get_beijing_now()

    # 执行更新
    await db.users.update_one(
        {"_id": ObjectId(id)},
        {"$set": update_data}
    )

    # 获取更新后的用户
    updated_user = await get(db, id)
    return updated_user

async def delete(db: Any, *, id: str) -> bool:
    """
    删除用户

    Args:
        db: 数据库连接
        id: 用户ID

    Returns:
        是否删除成功
    """
    result = await db.users.delete_one({"_id": ObjectId(id)})
    return result.deleted_count > 0
