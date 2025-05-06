import uuid
from datetime import datetime
from enum import Enum
from typing import Set
from peewee import CharField, BooleanField, DateTimeField
from playhouse.postgres_ext import UUIDField, ArrayField

from backend2.models.db.base import BaseModel


class Permission(Enum):
    """权限枚举"""
    ADMIN = "admin"  # 管理权限
    MODIFY = "modify"  # 修改权限
    READ = "read"    # 阅读权限

# 角色权限映射
ROLE_PERMISSIONS = {
    "admin": [Permission.ADMIN, Permission.MODIFY, Permission.READ],
    "user": [Permission.MODIFY, Permission.READ],
    "guest": [Permission.READ]
}

class User(BaseModel):
    """用户模型"""
    id = UUIDField(primary_key=True, default=uuid.uuid4)
    username = CharField(max_length=50, unique=True, index=True)
    hashed_password = CharField(max_length=255)
    roles = ArrayField(CharField, default=['user'])  # 用户角色列表
    is_active = BooleanField(default=True)
    created_at = DateTimeField(default=datetime.now)
    updated_at = DateTimeField(default=datetime.now)

    class Meta:
        table_name = 'users'
        indexes = (
            (('username',), True),  # 用户名唯一索引
        )

    def save(self, *args, **kwargs):
        """重写保存方法，自动更新updated_at字段"""
        self.updated_at = datetime.now()
        return super(User, self).save(*args, **kwargs)

    def get_permissions(self) -> Set[Permission]:
        """获取用户所有权限"""
        permissions = set()
        for role in self.roles:
            if role in ROLE_PERMISSIONS:
                permissions.update(ROLE_PERMISSIONS[role])
        return permissions

    def has_permission(self, permission: Permission) -> bool:
        """检查用户是否具有指定权限"""
        return permission in self.get_permissions()

    def has_role(self, role: str) -> bool:
        """检查用户是否具有指定角色"""
        return role in self.roles

    @classmethod
    def create_tables(cls, safe=True):
        """创建用户表"""
        from peewee import PostgresqlDatabase
        db = cls._meta.database
        if isinstance(db, PostgresqlDatabase):
            db.execute_sql("CREATE EXTENSION IF NOT EXISTS \"uuid-ossp\";")
        db.create_tables([cls], safe=safe)
