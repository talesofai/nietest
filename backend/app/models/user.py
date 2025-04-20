from datetime import datetime
from enum import Enum
from typing import List, Optional
from pydantic import BaseModel, EmailStr, Field

class Role(str, Enum):
    """用户角色枚举"""
    ADMIN = "admin"      # 管理员
    MANAGER = "manager"  # 经理
    USER = "user"        # 普通用户
    GUEST = "guest"      # 访客

class Permission(str, Enum):
    """权限枚举"""
    READ = "read"        # 读取权限
    WRITE = "write"      # 写入权限
    DELETE = "delete"    # 删除权限
    ADMIN = "admin"      # 管理权限

# 角色权限映射
ROLE_PERMISSIONS = {
    Role.ADMIN: [Permission.READ, Permission.WRITE, Permission.DELETE, Permission.ADMIN],
    Role.MANAGER: [Permission.READ, Permission.WRITE, Permission.DELETE],
    Role.USER: [Permission.READ, Permission.WRITE],
    Role.GUEST: [Permission.READ],
}

class User(BaseModel):
    """用户模型"""
    email: EmailStr
    hashed_password: str
    fullname: Optional[str] = None
    roles: List[Role] = [Role.USER]
    is_active: bool = True
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)

    def has_permission(self, permission: Permission) -> bool:
        """检查用户是否具有指定权限
        
        Args:
            permission: 权限
            
        Returns:
            是否具有权限
        """
        for role in self.roles:
            if permission in ROLE_PERMISSIONS.get(role, []):
                return True
        return False

    def has_role(self, role: Role) -> bool:
        """检查用户是否具有指定角色
        
        Args:
            role: 角色
            
        Returns:
            是否具有角色
        """
        return role in self.roles
