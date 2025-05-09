from datetime import datetime, timezone
from enum import Enum
from typing import Dict, Any, Optional, List
from pydantic import BaseModel, Field

from app.utils.timezone import get_beijing_now

class SubTaskStatus(str, Enum):
    """子任务状态枚举"""
    PENDING = "pending"       # 等待中
    PROCESSING = "processing" # 处理中
    COMPLETED = "completed"   # 已完成
    FAILED = "failed"         # 失败
    CANCELLED = "cancelled"   # 已取消

class SubTask(BaseModel):
    """子任务模型"""
    id: str                                                                # 使用UUID作为主键
    parent_task_id: str                                                     # 关联原始任务ID
    # 使用变量索引数组作为唯一标识
    variable_indices: List[Optional[int]] = []                              # 变量索引数组，最多六个元素，对应v0-v5
    # 变量类型映射，使变量类型不再与位置绑定
    variable_types_map: Dict[str, str] = {}                                # 变量类型映射，例如{"v0": "polish", "v1": "ratio"}
    # 按类型访问变量的映射
    type_to_variable: Dict[str, str] = {}                                  # 类型到变量的映射，例如{"polish": "v0", "ratio": "v1"}
    status: SubTaskStatus = SubTaskStatus.PENDING                           # 任务状态
    result: Optional[Dict[str, Any]] = None                                 # 任务结果
    error: Optional[str] = None                                             # 错误信息
    retry_count: int = 0                                                    # 重试次数
    prompts: List[Dict[str, Any]] = []                                      # 提示词列表，包含所有提示词、角色和元素
    ratio: str = "1:1"                                                      # 比例
    seed: Optional[int] = None                                              # 种子
    use_polish: bool = False                                                # 是否使用润色
    created_at: datetime = Field(default_factory=get_beijing_now)  # 创建时间
    updated_at: datetime = Field(default_factory=get_beijing_now)  # 更新时间

    def mark_as_processing(self):
        """将任务标记为处理中"""
        self.status = SubTaskStatus.PROCESSING
        self.updated_at = get_beijing_now()

    def mark_as_completed(self, result: Dict[str, Any]):
        """将任务标记为已完成

        Args:
            result: 任务结果
        """
        self.status = SubTaskStatus.COMPLETED
        self.result = result
        self.updated_at = get_beijing_now()

    def mark_as_failed(self, error: str):
        """将任务标记为失败

        Args:
            error: 错误信息
        """
        self.status = SubTaskStatus.FAILED
        self.error = error
        self.retry_count += 1
        self.updated_at = get_beijing_now()

    def mark_as_cancelled(self):
        """将任务标记为已取消"""
        self.status = SubTaskStatus.CANCELLED
        self.updated_at = get_beijing_now()

    def is_cancelled(self) -> bool:
        """检查任务是否已取消

        Returns:
            是否已取消
        """
        return self.status == SubTaskStatus.CANCELLED
