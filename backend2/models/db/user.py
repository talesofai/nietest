import uuid
from datetime import datetime
from enum import Enum
from typing import List, Dict, Set

from peewee import CharField, BooleanField, DateTimeField
from playhouse.postgres_ext import UUIDField, ArrayField

from backend2.models.db.base import BaseModel


class Role(str, Enum):
    """角色枚举"""
    GUEST = "guest"         # 访客
    USER = "user"           # 普通用户
    PRO_USER = "pro_user"   # 高级用户
    MANAGER = "manager"     # 管理员
    ADMIN = "admin"         # 超级管理员


class PermissionCategory(str, Enum):
    """权限类别枚举"""
    TEST = "test"           # 测试相关权限
    DATA = "data"           # 数据管理相关权限
    TRAIN = "train"         # 训练相关权限
    GLOBAL = "global"       # 全局权限


class Permission(str, Enum):
    """权限枚举"""
    # 测试相关权限
    TEST_VIEW_RESULTS = "test:view_results"                # 查看所有结果
    TEST_CREATE_LOW_PRIORITY = "test:create_low_priority"  # 创建低权限任务
    TEST_DELETE_OWN = "test:delete_own"                    # 删除自己的任务
    TEST_CREATE_HIGH_PRIORITY = "test:create_high_priority"# 创建高权限任务
    TEST_DELETE_ANY = "test:delete_any"                    # 删除任何任务

    # 数据管理相关权限
    DATA_VIEW_COLLECTION = "data:view_collection"          # 查看指定集合的图片
    DATA_CHANGE_TAGS_VIEWABLE = "data:change_tags_viewable"# 更改可查看图片的标签
    DATA_VIEW_ALL = "data:view_all"                        # 查看所有图片
    DATA_UPLOAD = "data:upload"                            # 上传数据
    DATA_CHANGE_TAGS_ANY = "data:change_tags_any"          # 更改任何图片的标签
    DATA_AUTO_ANNOTATE = "data:auto_annotate"              # 执行自动标注任务
    DATA_DELETE = "data:delete"                            # 删除数据

    # 训练相关权限
    TRAIN_START = "train:start"                            # 启动训练任务
    TRAIN_STOP = "train:stop"                              # 停止训练任务
    TRAIN_BATCH_START = "train:batch_start"                # 批量启动训练任务

    # 全局权限
    GLOBAL_CREATE_USER = "global:create_user"              # 创建用户
    GLOBAL_ASSIGN_PERMISSIONS = "global:assign_permissions"# 分配权限


# 角色权限映射
ROLE_PERMISSIONS: Dict[str, List[Permission]] = {
    # 访客权限
    Role.GUEST.value: [
        Permission.TEST_VIEW_RESULTS,
        Permission.DATA_VIEW_COLLECTION,
        Permission.DATA_CHANGE_TAGS_VIEWABLE,
    ],

    # 普通用户权限 (包含访客所有权限)
    Role.USER.value: [
        Permission.TEST_VIEW_RESULTS,
        Permission.DATA_VIEW_COLLECTION,
        Permission.DATA_CHANGE_TAGS_VIEWABLE,
        # 普通用户额外权限
        Permission.TEST_CREATE_LOW_PRIORITY,
        Permission.TEST_DELETE_OWN,
        Permission.DATA_VIEW_ALL,
        Permission.DATA_UPLOAD,
        Permission.DATA_CHANGE_TAGS_ANY,
        Permission.TRAIN_START,
        Permission.TRAIN_STOP,
    ],

    # 高级用户权限 (包含普通用户所有权限)
    Role.PRO_USER.value: [
        Permission.TEST_VIEW_RESULTS,
        Permission.DATA_VIEW_COLLECTION,
        Permission.DATA_CHANGE_TAGS_VIEWABLE,
        Permission.TEST_CREATE_LOW_PRIORITY,
        Permission.TEST_DELETE_OWN,
        Permission.DATA_VIEW_ALL,
        Permission.DATA_UPLOAD,
        Permission.DATA_CHANGE_TAGS_ANY,
        Permission.TRAIN_START,
        Permission.TRAIN_STOP,
        # 高级用户额外权限
        Permission.TEST_CREATE_HIGH_PRIORITY,
        Permission.TEST_DELETE_ANY,
        Permission.DATA_AUTO_ANNOTATE,
        Permission.TRAIN_BATCH_START,
    ],

    # 管理员权限 (包含高级用户所有权限)
    Role.MANAGER.value: [
        Permission.TEST_VIEW_RESULTS,
        Permission.DATA_VIEW_COLLECTION,
        Permission.DATA_CHANGE_TAGS_VIEWABLE,
        Permission.TEST_CREATE_LOW_PRIORITY,
        Permission.TEST_DELETE_OWN,
        Permission.DATA_VIEW_ALL,
        Permission.DATA_UPLOAD,
        Permission.DATA_CHANGE_TAGS_ANY,
        Permission.TRAIN_START,
        Permission.TRAIN_STOP,
        Permission.TEST_CREATE_HIGH_PRIORITY,
        Permission.TEST_DELETE_ANY,
        Permission.DATA_AUTO_ANNOTATE,
        Permission.TRAIN_BATCH_START,
        # 管理员额外权限
        Permission.DATA_DELETE,
    ],

    # 超级管理员权限 (包含所有权限)
    Role.ADMIN.value: [
        Permission.TEST_VIEW_RESULTS,
        Permission.DATA_VIEW_COLLECTION,
        Permission.DATA_CHANGE_TAGS_VIEWABLE,
        Permission.TEST_CREATE_LOW_PRIORITY,
        Permission.TEST_DELETE_OWN,
        Permission.DATA_VIEW_ALL,
        Permission.DATA_UPLOAD,
        Permission.DATA_CHANGE_TAGS_ANY,
        Permission.TRAIN_START,
        Permission.TRAIN_STOP,
        Permission.TEST_CREATE_HIGH_PRIORITY,
        Permission.TEST_DELETE_ANY,
        Permission.DATA_AUTO_ANNOTATE,
        Permission.TRAIN_BATCH_START,
        Permission.DATA_DELETE,
        # 超级管理员额外权限
        Permission.GLOBAL_CREATE_USER,
        Permission.GLOBAL_ASSIGN_PERMISSIONS,
    ],
}

# 角色继承关系
ROLE_HIERARCHY = {
    Role.GUEST.value: [],
    Role.USER.value: [Role.GUEST.value],
    Role.PRO_USER.value: [Role.USER.value],
    Role.MANAGER.value: [Role.PRO_USER.value],
    Role.ADMIN.value: [Role.MANAGER.value],
}


class User(BaseModel):
    """用户模型"""
    id = UUIDField(primary_key=True, default=uuid.uuid4)
    username = CharField(max_length=50, unique=True, index=True)
    hashed_password = CharField(max_length=255)
    roles = ArrayField(CharField, default=[Role.USER.value])  # 用户角色列表
    is_active = BooleanField(default=True)
    created_at = DateTimeField(default=datetime.now)
    updated_at = DateTimeField(default=datetime.now)

    def get_permissions(self) -> Set[Permission]:
        """获取用户所有权限"""
        permissions = set()
        for role in self.roles:
            # 直接添加角色对应的权限
            if role in ROLE_PERMISSIONS:
                permissions.update(ROLE_PERMISSIONS[role])
        return permissions

    def has_permission(self, permission: Permission) -> bool:
        """检查用户是否具有指定权限"""
        return permission in self.get_permissions()

    class Meta:
        table_name = 'users'
        indexes = (
            (('username',), True),  # 用户名唯一索引
        )