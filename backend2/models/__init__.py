# 从新位置导入所有模型
from backend2.models.db import (
    BaseModel,
    User, Permission, ROLE_PERMISSIONS,
    Task, TaskStatus, MakeApiQueue, SettingField,
    Subtask, SubtaskStatus, QualityRating
)

__all__ = [
    'BaseModel',
    'User', 'Permission', 'ROLE_PERMISSIONS',
    'Task', 'TaskStatus', 'MakeApiQueue', 'SettingField',
    'Subtask', 'SubtaskStatus', 'QualityRating'
]
