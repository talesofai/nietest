# 从新位置导入所有模型
from backend2.models.db import (
    BaseModel,
    User, Permission, ROLE_ADDITIONAL_PERMISSIONS, ROLE_HIERARCHY,
    Task, TaskStatus, MakeApiQueue, SettingField,
    Subtask, SubtaskStatus, QualityRating
)
from backend2.models.prompt import Prompt, PromptType, ConstantPrompt
from backend2.models.task_parameter import TaskParameter
from backend2.models.variable import Variable

__all__ = [
    'BaseModel',
    'User', 'Permission', 'ROLE_ADDITIONAL_PERMISSIONS', 'ROLE_HIERARCHY',
    'Task', 'TaskStatus', 'MakeApiQueue', 'SettingField',
    'Subtask', 'SubtaskStatus', 'QualityRating',
    'Prompt', 'PromptType', 'ConstantPrompt',
    'TaskParameter', 'Variable'
]
