import uuid
from datetime import datetime
from enum import Enum
from typing import Optional, Dict, Any, Union, List
from peewee import CharField, IntegerField, BooleanField, DateTimeField, ForeignKeyField, SmallIntegerField
from playhouse.postgres_ext import UUIDField, JSONField

from backend2.models.db.base import BaseModel
from backend2.models.db.user import User
from backend2.models.prompt import Prompt


class SettingField:
    """通用设置字段模型"""
    def __init__(self, value: Any = None, is_variable: bool = False, variable_id: Optional[str] = None):
        """
        初始化设置字段

        Args:
            value: 字段值
            is_variable: 是否为变量
            variable_id: 变量ID
        """
        self.value = value
        self.is_variable = is_variable
        self.variable_id = variable_id

    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> 'SettingField':
        """
        从字典创建设置字段

        Args:
            data: 字典数据

        Returns:
            设置字段对象
        """
        return cls(
            value=data.get('value'),
            is_variable=data.get('is_variable', False),
            variable_id=data.get('variable_id')
        )

    def to_dict(self) -> Dict[str, Any]:
        """
        转换为字典

        Returns:
            字典表示
        """
        return {
            'value': self.value,
            'is_variable': self.is_variable,
            'variable_id': self.variable_id
        }


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


def validate_setting(setting: Dict[str, Any]) -> Dict[str, Any]:
    """
    验证设置字段格式，确保所需键存在

    Args:
        setting: 设置字段字典

    Returns:
        处理后的设置字段字典
    """
    # 确保必需的键存在
    if not isinstance(setting, dict):
        setting = {}

    result = {
        'value': setting.get('value'),
        'is_variable': setting.get('is_variable', False),
        'variable_id': setting.get('variable_id')
    }

    # 当设置为变量时，确保variable_id不为空
    if result['is_variable'] and not result['variable_id']:
        raise ValueError("当设置为变量时，variable_id不能为空")

    # 当设置为非变量时，确保value不为空
    if not result['is_variable'] and not result['value']:
        raise ValueError("当设置为非变量时，value不能为空")

    return result


def validate_prompts(prompts: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    """
    验证提示词列表，确保格式正确

    Args:
        prompts: 提示词列表

    Returns:
        处理后的提示词列表

    Raises:
        ValueError: 当提示词格式不正确时
    """
    if not isinstance(prompts, list):
        raise ValueError("prompts必须是列表类型")

    if len(prompts) == 0:
        raise ValueError("prompts不能为空")

    validated_prompts = []

    for i, prompt_data in enumerate(prompts):
        try:
            # 使用Prompt类验证每个提示词
            prompt = Prompt(prompt_data)
            validated_prompts.append(prompt_data)
        except ValueError as e:
            raise ValueError(f"第{i+1}个提示词无效: {str(e)}")

    return validated_prompts


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
    prompts = JSONField(default=[{'prompt': '1girl', 'is_variable': False, 'variable_id': None}])
    ratio = JSONField(default=SettingField(value='1:1').to_dict())
    seed = JSONField(default=SettingField(value=None).to_dict())
    batch_size = JSONField(default=SettingField(value=1).to_dict())
    polish = JSONField(default=SettingField(value=False).to_dict())
    variables = JSONField(default={})

    class Meta:
        table_name = 'tasks'
        indexes = (
            (('user',), False),  # 用户索引
            (('status',), False),  # 状态索引
            (('created_at',), False),  # 创建时间索引
            (('is_deleted',), False),  # 是否删除索引
        )

    def save(self, *args, **kwargs):
        """重写保存方法，自动更新updated_at字段，并验证prompts"""
        self.updated_at = datetime.now()

        # 验证prompts
        if hasattr(self, 'prompts') and self.prompts:
            self.prompts = validate_prompts(self.prompts)

        return super(Task, self).save(*args, **kwargs)

    @classmethod
    def create_tables(cls, safe=True):
        """创建任务表"""
        from peewee import PostgresqlDatabase
        db = cls._meta.database
        if isinstance(db, PostgresqlDatabase):
            db.execute_sql("CREATE EXTENSION IF NOT EXISTS \"uuid-ossp\";")
        db.create_tables([cls], safe=safe)
