from datetime import datetime
from enum import Enum
from typing import Dict, Any, List, Optional
from pydantic import BaseModel, Field

from app.utils.timezone import get_beijing_now

class TaskStatus(str, Enum):
    """任务状态枚举"""
    PENDING = "pending"       # 等待中
    PROCESSING = "processing" # 处理中
    COMPLETED = "completed"   # 已完成
    FAILED = "failed"         # 失败
    CANCELLED = "cancelled"   # 已取消

class Task(BaseModel):
    """任务模型"""
    id: str  # 使用UUID作为主键
    task_name: str
    username: str
    tags: List[Dict[str, Any]] = []
    variables: Dict[str, Any] = {}
    settings: Dict[str, Any] = {}
    status: TaskStatus = TaskStatus.PENDING
    created_at: datetime = Field(default_factory=get_beijing_now)
    updated_at: datetime = Field(default_factory=get_beijing_now)
    total_images: int = 0
    all_subtasks_completed: bool = False
    is_deleted: bool = False
    priority: int = 1

    def mark_as_processing(self):
        """将任务标记为处理中"""
        self.status = TaskStatus.PROCESSING
        self.updated_at = get_beijing_now()

    def mark_as_completed(self):
        """将任务标记为已完成"""
        self.status = TaskStatus.COMPLETED
        self.updated_at = get_beijing_now()
        self.all_subtasks_completed = True

    def mark_as_failed(self, error: str = None):
        """将任务标记为失败

        Args:
            error: 错误信息
        """
        self.status = TaskStatus.FAILED
        self.updated_at = get_beijing_now()

    def mark_as_cancelled(self):
        """将任务标记为已取消"""
        self.status = TaskStatus.CANCELLED
        self.updated_at = get_beijing_now()

    def update_subtasks_completion(self, all_completed: bool):
        """更新子任务完成状态

        Args:
            all_completed: 所有子任务是否已完成
        """
        self.all_subtasks_completed = all_completed
        self.updated_at = get_beijing_now()

    def is_cancelled(self) -> bool:
        """检查任务是否已取消

        Returns:
            是否已取消
        """
        return self.status == TaskStatus.CANCELLED
