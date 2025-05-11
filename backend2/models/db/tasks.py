"""
任务模型模块

定义与任务相关的数据库模型
"""
import uuid
from datetime import datetime
from enum import Enum
from typing import List, Dict, Any, Optional

from peewee import CharField, IntegerField, BooleanField, DateTimeField, ForeignKeyField, SmallIntegerField
from playhouse.postgres_ext import UUIDField, JSONField

from backend2.models.db.base import BaseModel
from backend2.models.db.user import User
from backend2.models.prompt import Prompt
from backend2.models.task_parameter import TaskParameter
from backend2.models.variable import Variable
from backend2.models.db.extra_field import PydanticListField, PydanticModelField


class TaskStatus(str, Enum):
    """任务状态枚举"""
    PENDING = "pending"       # 等待中
    PROCESSING = "processing" # 处理中
    COMPLETED = "completed"   # 已完成
    FAILED = "failed"         # 失败
    CANCELLED = "cancelled"   # 已取消


class SettingField(str, Enum):
    """设置字段枚举"""
    RATIO = "ratio"
    SEED = "seed"
    BATCH_SIZE = "batch_size"
    USER_POLISH = "user_polish"
    IS_LUMINA = "is_lumina"
    LUMINA_MODEL_NAME = "lumina_model_name"
    LUMINA_CFG = "lumina_cfg"
    LUMINA_STEP = "lumina_step"


class Task(BaseModel):
    """任务模型"""
    id = UUIDField(primary_key=True, default=uuid.uuid4)
    name = CharField(max_length=255)
    user = ForeignKeyField(User, backref='tasks')
    status = CharField(max_length=20, default=TaskStatus.PENDING.value)
    priority = SmallIntegerField(default=1)
    total_images = IntegerField(default=0)

    processed_images = IntegerField(default=0)
    progress = SmallIntegerField(default=0)

    is_deleted = BooleanField(default=False)
    created_at = DateTimeField(default=datetime.now)
    updated_at = DateTimeField(default=datetime.now)
    completed_at = DateTimeField(null=True)

    # 存储任务配置和变量信息
    prompts = PydanticListField(Prompt, default=[])

    # 使用PydanticModelField存储任务参数
    ratio = PydanticModelField(TaskParameter, default=TaskParameter(type='ratio', value='1:1', is_variable=False, format='string'))
    seed = PydanticModelField(TaskParameter, default=TaskParameter(type='seed', value=None, is_variable=False, format='int'))
    batch_size = PydanticModelField(TaskParameter, default=TaskParameter(type='batch_size', value=1, is_variable=False, format='int'))
    user_polish = PydanticModelField(TaskParameter, default=TaskParameter(type='user_polish', value=False, is_variable=False, format='bool'))
    is_lumina = PydanticModelField(TaskParameter, default=TaskParameter(type='is_lumina', value=False, is_variable=False, format='bool'))
    lumina_model_name = PydanticModelField(TaskParameter, default=TaskParameter(type='lumina_model_name', value=None, is_variable=False, format='string'))
    lumina_cfg = PydanticModelField(TaskParameter, default=TaskParameter(type='lumina_cfg', value=None, is_variable=False, format='float'))
    lumina_step = PydanticModelField(TaskParameter, default=TaskParameter(type='lumina_step', value=None, is_variable=False, format='int'))

    # 变量列表，存储任务的所有变量
    variables = PydanticListField(Variable, default=[])

    class Meta:
        table_name = 'tasks'
        indexes = (
            (('user',), False),  # 用户索引
            (('status',), False),  # 状态索引
            (('created_at',), False),  # 创建时间索引
            (('is_deleted',), False),  # 是否删除索引
        )
