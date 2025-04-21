from datetime import datetime
from typing import Dict, Any, Optional
from pydantic import BaseModel

from app.models.subtask import SubTaskStatus

class SubTaskBase(BaseModel):
    """Dramatiq任务基础模式"""
    parent_task_id: str
    combination_key: str
    prompt: str = ""
    ratio: str = "1:1"
    seed: Optional[int] = None
    use_polish: bool = False
    variables: Dict[str, str] = {}
    combination: Dict[str, Dict[str, str]] = {}

class SubTaskCreate(SubTaskBase):
    """Dramatiq任务创建模式"""
    pass

class SubTaskUpdate(BaseModel):
    """Dramatiq任务更新模式"""
    status: Optional[SubTaskStatus] = None
    result: Optional[Dict[str, Any]] = None
    error: Optional[str] = None
    retry_count: Optional[int] = None

class SubTaskInDB(SubTaskBase):
    """数据库中的Dramatiq任务模式"""
    id: str  # UUID作为主键
    status: SubTaskStatus
    result: Optional[Dict[str, Any]] = None
    error: Optional[str] = None
    retry_count: int
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True

class SubTaskResponse(BaseModel):
    """Dramatiq任务响应模式"""
    id: str  # UUID作为主键
    parent_task_id: str
    combination_key: str
    status: SubTaskStatus
    result: Optional[Dict[str, Any]] = None
    error: Optional[str] = None
    retry_count: int
    prompt: str
    ratio: str
    seed: Optional[int] = None
    use_polish: bool
    variables: Dict[str, str] = {}
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True