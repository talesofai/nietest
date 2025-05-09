"""
子任务 CRUD 操作模块
"""
import logging
from typing import List, Dict, Any, Union, Optional
from uuid import UUID
from datetime import datetime

from backend2.crud.base import CRUDBase
from backend2.models.db.subtasks import Subtask, SubtaskStatus

# 配置日志
logger = logging.getLogger(__name__)


class SubtaskCRUD(CRUDBase[Subtask]):
    """
    子任务 CRUD 操作类

    提供对子任务表的特定操作
    """

    def __init__(self):
        """初始化子任务 CRUD 操作类"""
        super().__init__(Subtask)

    def get_by_task(self, task_id: Union[str, UUID], limit: int = 100, offset: int = 0) -> List[Subtask]:
        """
        获取任务的所有子任务

        Args:
            task_id: 任务 ID
            limit: 最大记录数
            offset: 起始位置

        Returns:
            子任务列表
        """
        try:
            # 确保 ID 是字符串类型
            task_id_str = str(task_id)

            query = Subtask.select().where(Subtask.task == task_id_str).limit(limit).offset(offset)

            return list(query)
        except Exception as e:
            logger.error(f"获取任务的子任务时出错: 任务 ID: {task_id}, 错误: {str(e)}")
            return []

    def get_pending_subtasks(self, limit: int = 100) -> List[Subtask]:
        """
        获取等待中的子任务

        Args:
            limit: 最大记录数

        Returns:
            等待中的子任务列表
        """
        return list(Subtask.select().where(Subtask.status == SubtaskStatus.PENDING.value).limit(limit))

    def update_status(self, id: Union[str, UUID], status: str, error: Optional[str] = None, increment_retry: bool = False) -> Optional[Subtask]:
        """
        更新子任务状态

        Args:
            id: 子任务 ID
            status: 新状态
            error: 错误信息（如果有）
            increment_retry: 是否增加重试计数

        Returns:
            更新后的子任务，如果更新失败则返回 None
        """
        try:
            # 确保 ID 是字符串类型
            id_str = str(id)

            # 获取子任务
            subtask = Subtask.get(Subtask.id == id_str)

            # 更新状态和错误信息
            subtask.status = status
            if error:
                subtask.error = error

            # 如果需要增加重试计数
            if increment_retry or status == SubtaskStatus.FAILED.value:
                subtask.retry_count += 1
                logger.info(f"子任务 {id_str} 重试计数增加到 {subtask.retry_count}")

            # 更新时间戳
            if status == SubtaskStatus.PROCESSING.value and not subtask.started_at:
                subtask.started_at = datetime.now()
            elif status in [SubtaskStatus.COMPLETED.value, SubtaskStatus.FAILED.value, SubtaskStatus.CANCELLED.value]:
                subtask.completed_at = datetime.now()

            # 保存更新并更新时间戳
            self.save_with_updated_time(subtask)

            return subtask
        except Exception as e:
            logger.error(f"更新子任务状态时出错: 子任务 ID: {id}, 错误: {str(e)}")
            return None

    def set_result(self, id: Union[str, UUID], result: Dict[str, Any]) -> Optional[Subtask]:
        """
        设置子任务结果

        Args:
            id: 子任务 ID
            result: 结果数据

        Returns:
            更新后的子任务，如果更新失败则返回 None
        """
        try:
            # 确保 ID 是字符串类型
            id_str = str(id)

            # 获取子任务
            subtask = Subtask.get(Subtask.id == id_str)

            # 更新结果
            subtask.result = result
            subtask.status = SubtaskStatus.COMPLETED.value
            subtask.completed_at = datetime.now()

            # 保存更新并更新时间戳
            self.save_with_updated_time(subtask)

            return subtask
        except Exception as e:
            logger.error(f"设置子任务结果时出错: 子任务 ID: {id}, 错误: {str(e)}")
            return None

    def set_rating(self, id: Union[str, UUID], rating: Optional[int], evaluation: Optional[str] = None) -> Optional[Subtask]:
        """
        设置子任务评分和评价

        Args:
            id: 子任务 ID
            rating: 评分（1-5）
            evaluation: 评价内容

        Returns:
            更新后的子任务，如果更新失败则返回 None
        """
        try:
            # 确保 ID 是字符串类型
            id_str = str(id)

            # 获取子任务
            subtask = Subtask.get(Subtask.id == id_str)

            # 更新评分和评价
            subtask.rating = rating
            if evaluation is not None:
                subtask.evaluation = evaluation

            # 保存更新并更新时间戳
            self.save_with_updated_time(subtask)

            return subtask
        except Exception as e:
            logger.error(f"设置子任务评分时出错: 子任务 ID: {id}, 错误: {str(e)}")
            return None


# 创建全局实例
subtask_crud = SubtaskCRUD()