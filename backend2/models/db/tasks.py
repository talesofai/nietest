"""
任务模型模块

定义与任务相关的数据库模型
"""
import uuid
from datetime import datetime
from enum import Enum
from typing import List, Dict, Any

from peewee import CharField, IntegerField, BooleanField, DateTimeField, ForeignKeyField, SmallIntegerField
from playhouse.postgres_ext import UUIDField, JSONField

from backend2.models.db.base import BaseModel
from backend2.models.db.user import User
from backend2.models.prompt import Prompt


class TaskStatus(str, Enum):
    """任务状态枚举"""
    PENDING = "pending"       # 等待中
    PROCESSING = "processing" # 处理中
    COMPLETED = "completed"   # 已完成
    FAILED = "failed"         # 失败
    CANCELLED = "cancelled"   # 已取消


class MakeApiQueue(str, Enum):
    """API队列类型枚举"""
    PROD = ""     # 默认生产环境队列（空字符串）
    OPS = "ops"   # 运维环境队列
    DEV = "dev"   # 开发环境队列


class Task(BaseModel):
    """任务模型"""
    id = UUIDField(primary_key=True, default=uuid.uuid4)
    name = CharField(max_length=255)
    user = ForeignKeyField(User, backref='tasks')
    status = CharField(max_length=20, default=TaskStatus.PENDING.value)  # 使用TaskStatus枚举
    make_api_queue = CharField(max_length=10, default=MakeApiQueue.PROD.value)  # 使用MakeApiQueue枚举，默认为PROD（空字符串）
    priority = SmallIntegerField(default=1)
    total_images = IntegerField(default=0)
    processed_images = IntegerField(default=0)
    progress = SmallIntegerField(default=0)
    is_deleted = BooleanField(default=False)
    created_at = DateTimeField(default=datetime.now)
    updated_at = DateTimeField(default=datetime.now)
    completed_at = DateTimeField(null=True)

    # 存储任务配置和变量信息
    prompts: List[Prompt] = JSONField(default=[])
    ratio: Dict[str, Any] = JSONField(default={'type': 'freetext', 'value': '1:1', 'is_variable': False, 'variable_id': None, 'variable_name': ''})
    seed: Dict[str, Any] = JSONField(default={'type': 'freetext', 'value': None, 'is_variable': False, 'variable_id': None, 'variable_name': ''})
    batch_size: Dict[str, Any] = JSONField(default={'type': 'freetext', 'value': 1, 'is_variable': False, 'variable_id': None, 'variable_name': ''})
    polish: Dict[str, Any] = JSONField(default={'type': 'freetext', 'value': False, 'is_variable': False, 'variable_id': None, 'variable_name': ''})
    variables: Dict[str, Any] = JSONField(default={})

    class Meta:
        table_name = 'tasks'
        indexes = (
            (('user',), False),  # 用户索引
            (('status',), False),  # 状态索引
            (('created_at',), False),  # 创建时间索引
            (('is_deleted',), False),  # 是否删除索引
        )


