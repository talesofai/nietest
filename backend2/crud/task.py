"""
任务 CRUD 操作模块
"""
import logging
from typing import List, Union, Optional
from uuid import UUID
from datetime import datetime

from backend2.crud.base import CRUDBase
from backend2.models.db.tasks import Task, TaskStatus

# 配置日志
logger = logging.getLogger(__name__)


class TaskCRUD(CRUDBase[Task]):
    """
    任务 CRUD 操作类

    提供对任务表的特定操作
    """

    def __init__(self):
        """初始化任务 CRUD 操作类"""
        super().__init__(Task)

    def get_by_user(self, user_id: Union[str, UUID], limit: int = 100, offset: int = 0, is_deleted: bool = False) -> List[Task]:
        """
        获取用户的所有任务

        Args:
            user_id: 用户 ID
            limit: 最大记录数
            offset: 起始位置
            is_deleted: 是否已删除的任务

        Returns:
            任务列表
        """
        try:
            # 确保 ID 是字符串类型
            user_id_str = str(user_id)

            query = Task.select().where(
                (Task.user == user_id_str) &
                (Task.is_deleted == is_deleted)
            ).order_by(Task.created_at.desc()).limit(limit).offset(offset)

            return list(query)
        except Exception as e:
            logger.error(f"获取用户的任务时出错: 用户 ID: {user_id}, 错误: {str(e)}")
            return []

    def update_progress(self, id: Union[str, UUID]) -> Optional[Task]:
        """
        更新任务进度

        Args:
            id: 任务 ID

        Returns:
            更新后的任务，如果更新失败则返回 None
        """
        try:
            # 确保 ID 是字符串类型
            id_str = str(id)

            # 获取任务
            task = Task.get(Task.id == id_str)

            # 更新任务进度
            if task.total_images > 0:
                task.progress = int((task.processed_images / task.total_images) * 100)
            else:
                task.progress = 0

            # 如果处理完所有图片，更新状态为已完成
            if task.processed_images >= task.total_images and task.total_images > 0:
                task.status = TaskStatus.COMPLETED.value
                task.completed_at = datetime.now()

            # 保存更新并更新时间戳
            self.save_with_updated_time(task)

            return task
        except Exception as e:
            logger.error(f"更新任务进度时出错: 任务 ID: {id}, 错误: {str(e)}")
            return None


# 创建全局实例
task_crud = TaskCRUD()