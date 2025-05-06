import uuid
from datetime import datetime
from enum import Enum
from peewee import CharField, IntegerField, BooleanField, DateTimeField, ForeignKeyField, TextField, SmallIntegerField
from playhouse.postgres_ext import UUIDField, JSONField

from backend2.models.db.base import BaseModel
from backend2.models.db.tasks import Task, MakeApiQueue


class SubtaskStatus(str, Enum):
    """子任务状态枚举"""
    PENDING = "pending"       # 等待中
    PROCESSING = "processing" # 处理中
    COMPLETED = "completed"   # 已完成
    FAILED = "failed"         # 失败
    CANCELLED = "cancelled"   # 已取消


class Subtask(BaseModel):
    """子任务模型"""
    id = UUIDField(primary_key=True, default=uuid.uuid4)
    task = ForeignKeyField(Task, backref='subtasks')
    status = CharField(max_length=20, default=SubtaskStatus.PENDING.value)  # 使用SubtaskStatus枚举
    make_api_queue = CharField(max_length=10, default=MakeApiQueue.PROD.value)  # 使用MakeApiQueue枚举，默认为PROD（空字符串）
    variable_indices = CharField(max_length=100)  # 存储子任务在父任务变量空间中的位置, 使用1,2,3,4形式的字符串
    prompts = JSONField()
    ratio = CharField(max_length=10, default='1:1')
    seed = IntegerField(null=True)
    use_polish = BooleanField(default=False)
    batch_size = IntegerField(default=1)
    retry_count = SmallIntegerField(default=0)
    error = TextField(null=True)
    created_at = DateTimeField(default=datetime.now)
    updated_at = DateTimeField(default=datetime.now)
    started_at = DateTimeField(null=True)
    completed_at = DateTimeField(null=True)
    result = JSONField(null=True)  # 存储生成结果（图片URL、宽度、高度等）
    rating = SmallIntegerField(null=True)  # 1-5评分，null表示未评分
    evaluation = TextField(null=True)

    class Meta:
        table_name = 'subtasks'
        indexes = (
            (('task',), False),  # 任务索引
            (('status',), False),  # 状态索引
            (('created_at',), False),  # 创建时间索引
            (('rating',), False),  # 评价索引
        )

    def save(self, *args, **kwargs):
        """重写保存方法，自动更新updated_at字段"""
        self.updated_at = datetime.now()
        return super(Subtask, self).save(*args, **kwargs)

    @classmethod
    def create_tables(cls, safe=True):
        """创建子任务表"""
        from peewee import PostgresqlDatabase
        db = cls._meta.database
        if isinstance(db, PostgresqlDatabase):
            db.execute_sql("CREATE EXTENSION IF NOT EXISTS \"uuid-ossp\";")
        db.create_tables([cls], safe=safe)
