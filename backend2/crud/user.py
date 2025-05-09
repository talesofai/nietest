from typing import Optional, List, Dict, Any
from uuid import UUID

from backend2.crud.base import CRUDBase
from backend2.models.db import User


class CRUDUser(CRUDBase[User]):
    """用户CRUD操作类"""

    def get_by_username(self, *, username: str) -> Optional[User]:
        """
        通过用户名获取用户

        Args:
            username: 用户名

        Returns:
            找到的用户，如果不存在则返回None
        """
        return User.get_or_none(User.username == username)

    def get_active_users(self, *, skip: int = 0, limit: int = 100) -> List[User]:
        """
        获取活跃用户

        Args:
            skip: 跳过的记录数
            limit: 返回的最大记录数

        Returns:
            活跃用户列表
        """
        return list(User.select().where(User.is_active == True).offset(skip).limit(limit))

    def create_with_roles(self, *, obj_in: Dict[str, Any], roles: List[str]) -> User:
        """
        创建用户并设置角色

        Args:
            obj_in: 要创建的用户数据
            roles: 角色列表

        Returns:
            创建的用户
        """
        obj_in["roles"] = roles
        return self.create(obj_in=obj_in)

    def update_roles(self, *, user_id: UUID, roles: List[str]) -> Optional[User]:
        """
        更新用户角色

        Args:
            user_id: 用户ID
            roles: 新的角色列表

        Returns:
            更新后的用户，如果用户不存在则返回None
        """
        user = self.get(id=user_id)
        if not user:
            return None
        user.roles = roles
        self.save_with_updated_time(user)
        return user


user = CRUDUser(User)
