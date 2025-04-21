from datetime import datetime
from enum import Enum
from typing import Dict, Any, Optional, List
from pydantic import BaseModel, Field

class DramatiqTaskStatus(str, Enum):
    """Dramatiq任务状态枚举"""
    PENDING = "pending"       # 等待中
    PROCESSING = "processing" # 处理中
    COMPLETED = "completed"   # 已完成
    FAILED = "failed"         # 失败
    CANCELLED = "cancelled"   # 已取消

class DramatiqTask(BaseModel):
    """Dramatiq任务模型"""
    id: str                                                                # 使用UUID作为主键
    parent_task_id: str                                                     # 关联原始任务ID
    # 使用变量索引作为唯一标识
    v0: Optional[int] = None                                                # 变量v0的索引，None表示不存在，整数表示在变量列表中的位置
    v1: Optional[int] = None                                                # 变量v1的索引
    v2: Optional[int] = None                                                # 变量v2的索引
    v3: Optional[int] = None                                                # 变量v3的索引
    v4: Optional[int] = None                                                # 变量v4的索引
    v5: Optional[int] = None                                                # 变量v5的索引
    status: DramatiqTaskStatus = DramatiqTaskStatus.PENDING                 # 任务状态
    result: Optional[Dict[str, Any]] = None                                 # 任务结果
    error: Optional[str] = None                                             # 错误信息
    retry_count: int = 0                                                    # 重试次数
    prompt: Dict[str, Any] = {"value": "", "weight": 1.0}                  # 提示词，包含value和weight键
    characters: List[Dict[str, Any]] = []                                   # 角色列表，每项是字典，包含value(实际为uuid)、name、weight和header_url键
    elements: List[Dict[str, Any]] = []                                     # 元素列表，每项是字典，包含value(实际为uuid)、name、weight和header_url键
    ratio: str = "1:1"                                                      # 比例
    seed: Optional[int] = None                                              # 种子
    use_polish: bool = False                                                # 是否使用润色
    created_at: datetime = Field(default_factory=datetime.utcnow)           # 创建时间
    updated_at: datetime = Field(default_factory=datetime.utcnow)           # 更新时间

    def mark_as_processing(self):
        """将任务标记为处理中"""
        self.status = DramatiqTaskStatus.PROCESSING
        self.updated_at = datetime.utcnow()

    def mark_as_completed(self, result: Dict[str, Any]):
        """将任务标记为已完成

        Args:
            result: 任务结果
        """
        self.status = DramatiqTaskStatus.COMPLETED
        self.result = result
        self.updated_at = datetime.utcnow()

    def mark_as_failed(self, error: str):
        """将任务标记为失败

        Args:
            error: 错误信息
        """
        self.status = DramatiqTaskStatus.FAILED
        self.error = error
        self.retry_count += 1
        self.updated_at = datetime.utcnow()

    def mark_as_cancelled(self):
        """将任务标记为已取消"""
        self.status = DramatiqTaskStatus.CANCELLED
        self.updated_at = datetime.utcnow()

    def is_cancelled(self) -> bool:
        """检查任务是否已取消

        Returns:
            是否已取消
        """
        return self.status == DramatiqTaskStatus.CANCELLED
