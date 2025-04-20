from datetime import datetime
from enum import Enum
from typing import Dict, Any, List, Optional
from pydantic import BaseModel, Field

class TaskStatus(str, Enum):
    """任务状态枚举"""
    PENDING = "pending"       # 等待中
    PROCESSING = "processing" # 处理中
    COMPLETED = "completed"   # 已完成
    FAILED = "failed"         # 失败
    CANCELLED = "cancelled"   # 已取消

class Task(BaseModel):
    """任务模型"""
    task_uuid: str
    task_name: str
    username: str
    tags: List[Dict[str, Any]] = []
    variables: Dict[str, Any] = {}
    settings: Dict[str, Any] = {}
    status: TaskStatus = TaskStatus.PENDING
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)
    total_images: int = 0
    processed_images: int = 0
    progress: int = 0
    is_deleted: bool = False
    priority: int = 1

    def mark_as_processing(self):
        """将任务标记为处理中"""
        self.status = TaskStatus.PROCESSING
        self.updated_at = datetime.utcnow()

    def mark_as_completed(self):
        """将任务标记为已完成"""
        self.status = TaskStatus.COMPLETED
        self.updated_at = datetime.utcnow()
        self.progress = 100
        self.processed_images = self.total_images

    def mark_as_failed(self, error: str = None):
        """将任务标记为失败
        
        Args:
            error: 错误信息
        """
        self.status = TaskStatus.FAILED
        self.updated_at = datetime.utcnow()

    def mark_as_cancelled(self):
        """将任务标记为已取消"""
        self.status = TaskStatus.CANCELLED
        self.updated_at = datetime.utcnow()

    def update_progress(self, processed_images: int, progress: int):
        """更新任务进度
        
        Args:
            processed_images: 已处理图片数
            progress: 进度百分比
        """
        self.processed_images = processed_images
        self.progress = progress
        self.updated_at = datetime.utcnow()

    def is_cancelled(self) -> bool:
        """检查任务是否已取消
        
        Returns:
            是否已取消
        """
        return self.status == TaskStatus.CANCELLED
