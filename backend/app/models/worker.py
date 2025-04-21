from enum import Enum
from datetime import datetime, timezone
from typing import Optional
from pydantic import BaseModel, Field

from app.core.config import settings

class WorkerStatus(str, Enum):
    """Worker状态枚举"""
    IDLE = "idle"           # 空闲
    BUSY = "busy"           # 忙碌
    TERMINATED = "terminated"  # 已终止

class Worker(BaseModel):
    """Worker模型"""
    worker_id: str                                          # Worker ID
    status: WorkerStatus = WorkerStatus.IDLE                # 状态
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))  # 创建时间
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))  # 更新时间
    last_active_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))  # 最后活动时间
    task_count: int = 0                                     # 已处理任务数
    current_task_id: Optional[str] = None                   # 当前任务ID

    def mark_as_busy(self, task_id: str):
        """将Worker标记为忙碌状态"""
        self.status = WorkerStatus.BUSY
        self.last_active_at = datetime.now(timezone.utc)
        self.current_task_id = task_id
        self.updated_at = datetime.now(timezone.utc)

    def mark_as_idle(self):
        """将Worker标记为空闲状态"""
        self.status = WorkerStatus.IDLE
        self.last_active_at = datetime.now(timezone.utc)
        self.current_task_id = None
        self.task_count += 1
        self.updated_at = datetime.now(timezone.utc)

    def mark_as_terminated(self):
        """将Worker标记为已终止状态"""
        self.status = WorkerStatus.TERMINATED
        self.updated_at = datetime.now(timezone.utc)

    def is_idle(self) -> bool:
        """检查Worker是否空闲"""
        return self.status == WorkerStatus.IDLE

    def is_busy(self) -> bool:
        """检查Worker是否忙碌"""
        return self.status == WorkerStatus.BUSY

    def is_terminated(self) -> bool:
        """检查Worker是否已终止"""
        return self.status == WorkerStatus.TERMINATED

    def is_idle_timeout(self, timeout_seconds: int = None) -> bool:
        """检查Worker是否空闲超时"""
        if not self.is_idle():
            return False

        # 使用配置参数或默认值
        timeout = timeout_seconds if timeout_seconds is not None else settings.WORKER_IDLE_TIMEOUT
        idle_time = (datetime.now(timezone.utc) - self.last_active_at).total_seconds()
        return idle_time >= timeout

class WorkerManager(BaseModel):
    """Worker管理器模型"""
    total_workers: int = 0                                  # 总Worker数
    active_workers: int = 0                                 # 活动Worker数
    max_workers: int = settings.WORKER_MAX_COUNT            # 最大Worker数
    last_scale_up_at: Optional[datetime] = None             # 上次增加Worker时间
    pending_tasks: int = 0                                  # 待处理任务数
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))  # 更新时间