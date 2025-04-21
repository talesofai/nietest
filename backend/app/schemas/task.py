from datetime import datetime
from typing import Dict, Any, List, Optional
from pydantic import BaseModel, Field, field_validator

from app.models.task import TaskStatus

class TaskBase(BaseModel):
    """任务基础模式"""
    task_name: str
    username: str
    tags: List[Dict[str, Any]] = []
    variables: Dict[str, Any] = {}
    settings: Dict[str, Any] = {}

class TaskCreate(TaskBase):
    """任务创建模式"""
    @field_validator('tags')
    def validate_tags(cls, v):
        """验证标签"""
        if not v:
            raise ValueError('标签不能为空')
        return v

    @field_validator('variables')
    def validate_variables(cls, v):
        """验证变量"""
        # 检查变量数量
        variable_count = sum(1 for var_name, var_data in v.items()
                            if var_name.startswith('v') and var_data.get('values'))
        if variable_count > 6:
            raise ValueError('变量数量不能超过6个')
        return v

class TaskUpdate(BaseModel):
    """任务更新模式"""
    task_name: Optional[str] = None
    tags: Optional[List[Dict[str, Any]]] = None
    variables: Optional[Dict[str, Any]] = None
    settings: Optional[Dict[str, Any]] = None
    status: Optional[TaskStatus] = None
    is_deleted: Optional[bool] = None
    priority: Optional[int] = None

class TaskInDB(TaskBase):
    """数据库中的任务模式"""
    id: str
    task_uuid: str
    status: TaskStatus
    created_at: datetime
    updated_at: datetime
    total_images: int
    processed_images: int
    progress: int
    is_deleted: bool
    priority: int

    class Config:
        from_attributes = True

class TaskResponse(BaseModel):
    """任务响应模式"""
    id: str
    task_uuid: str
    task_name: str
    username: str
    status: TaskStatus
    created_at: datetime
    updated_at: datetime
    total_images: int
    processed_images: int = 0  # 默认值，在API响应中动态计算
    progress: int = 0  # 默认值，在API响应中动态计算
    priority: int

    class Config:
        from_attributes = True

class TaskDetail(TaskResponse):
    """任务详情模式"""
    tags: List[Dict[str, Any]] = []
    variables: Dict[str, Any] = {}
    settings: Dict[str, Any] = {}
    results: Optional[Dict[str, Dict[str, Any]]] = None
    error: Optional[str] = None

    class Config:
        from_attributes = True

class TaskListResponse(BaseModel):
    """任务列表响应模式"""
    tasks: List[TaskResponse]
    total: int
    page: int
    page_size: int
