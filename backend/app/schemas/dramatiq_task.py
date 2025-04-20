from datetime import datetime
from typing import Dict, Any, Optional
from pydantic import BaseModel

from app.models.dramatiq_task import DramatiqTaskStatus

class DramatiqTaskBase(BaseModel):
    """Dramatiq任务基础模式"""
    parent_task_id: str
    combination_key: str
    prompt: str = ""
    ratio: str = "1:1"
    seed: Optional[int] = None
    use_polish: bool = False
    variables: Dict[str, str] = {}
    combination: Dict[str, Dict[str, str]] = {}

class DramatiqTaskCreate(DramatiqTaskBase):
    """Dramatiq任务创建模式"""
    pass

class DramatiqTaskUpdate(BaseModel):
    """Dramatiq任务更新模式"""
    dramatiq_message_id: Optional[str] = None
    status: Optional[DramatiqTaskStatus] = None
    result: Optional[Dict[str, Any]] = None
    error: Optional[str] = None
    retry_count: Optional[int] = None

class DramatiqTaskInDB(DramatiqTaskBase):
    """数据库中的Dramatiq任务模式"""
    id: str
    dramatiq_message_id: Optional[str] = None
    status: DramatiqTaskStatus
    result: Optional[Dict[str, Any]] = None
    error: Optional[str] = None
    retry_count: int
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True

class DramatiqTaskResponse(BaseModel):
    """Dramatiq任务响应模式"""
    id: str
    parent_task_id: str
    dramatiq_message_id: Optional[str] = None
    combination_key: str
    status: DramatiqTaskStatus
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