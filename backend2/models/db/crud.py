"""
数据库 CRUD 操作模块

提供对数据库表的创建、读取、更新、删除操作
"""
import logging
import uuid
from typing import Optional, List, Dict, Any, Type, TypeVar, Union, Generic
from datetime import datetime
from peewee import Model, DoesNotExist, IntegrityError, fn

from backend2.models.db.subtasks import Subtask, SubtaskStatus
from backend2.models.db.tasks import Task

# 配置日志
logger = logging.getLogger(__name__)

# 定义类型变量，用于泛型
T = TypeVar('T', bound=Model)


class CRUDBase(Generic[T]):
    """
    基础 CRUD 操作类

    提供对模型的通用 CRUD 操作
    """

    def __init__(self, model: Type[T]):
        """
        初始化 CRUD 操作类

        Args:
            model: 数据库模型类
        """
        self.model = model

    def get(self, id: Union[str, uuid.UUID]) -> Optional[T]:
        """
        根据 ID 获取单个记录

        Args:
            id: 记录 ID

        Returns:
            找到的记录，如果不存在则返回 None
        """
        try:
            # 确保 ID 是字符串类型
            id_str = str(id)
            return self.model.get(self.model.id == id_str)
        except DoesNotExist:
            logger.warning(f"记录不存在: {self.model.__name__}, ID: {id}")
            return None
        except Exception as e:
            logger.error(f"获取记录时出错: {self.model.__name__}, ID: {id}, 错误: {str(e)}")
            return None

    def get_multi(self, limit: int = 100, offset: int = 0, **filters) -> List[T]:
        """
        获取多条记录

        Args:
            limit: 最大记录数
            offset: 起始位置
            **filters: 过滤条件

        Returns:
            记录列表
        """
        try:
            query = self.model.select()

            # 应用过滤条件
            for field, value in filters.items():
                if hasattr(self.model, field):
                    query = query.where(getattr(self.model, field) == value)

            # 应用分页
            query = query.limit(limit).offset(offset)

            return list(query)
        except Exception as e:
            logger.error(f"获取多条记录时出错: {self.model.__name__}, 错误: {str(e)}")
            return []

    def create(self, **data) -> Optional[T]:
        """
        创建记录

        Args:
            **data: 记录数据

        Returns:
            创建的记录，如果创建失败则返回 None
        """
        try:
            return self.model.create(**data)
        except IntegrityError as e:
            logger.error(f"创建记录时完整性错误: {self.model.__name__}, 错误: {str(e)}")
            return None
        except Exception as e:
            logger.error(f"创建记录时出错: {self.model.__name__}, 错误: {str(e)}")
            return None

    def update(self, id: Union[str, uuid.UUID], **data) -> Optional[T]:
        """
        更新记录

        Args:
            id: 记录 ID
            **data: 更新的数据

        Returns:
            更新后的记录，如果更新失败则返回 None
        """
        try:
            # 确保 ID 是字符串类型
            id_str = str(id)

            # 先获取记录
            record = self.model.get(self.model.id == id_str)

            # 更新字段
            for field, value in data.items():
                if hasattr(record, field):
                    setattr(record, field, value)

            # 保存更新
            record.save()

            return record
        except DoesNotExist:
            logger.warning(f"更新记录不存在: {self.model.__name__}, ID: {id}")
            return None
        except Exception as e:
            logger.error(f"更新记录时出错: {self.model.__name__}, ID: {id}, 错误: {str(e)}")
            return None

    def delete(self, id: Union[str, uuid.UUID]) -> bool:
        """
        删除记录

        Args:
            id: 记录 ID

        Returns:
            是否删除成功
        """
        try:
            # 确保 ID 是字符串类型
            id_str = str(id)

            # 先获取记录
            record = self.model.get(self.model.id == id_str)

            # 删除记录
            record.delete_instance()

            return True
        except DoesNotExist:
            logger.warning(f"删除记录不存在: {self.model.__name__}, ID: {id}")
            return False
        except Exception as e:
            logger.error(f"删除记录时出错: {self.model.__name__}, ID: {id}, 错误: {str(e)}")
            return False

    def count(self, **filters) -> int:
        """
        计算记录数量

        Args:
            **filters: 过滤条件

        Returns:
            记录数量
        """
        try:
            query = self.model.select()

            # 应用过滤条件
            for field, value in filters.items():
                if hasattr(self.model, field):
                    query = query.where(getattr(self.model, field) == value)

            return query.count()
        except Exception as e:
            logger.error(f"计算记录数量时出错: {self.model.__name__}, 错误: {str(e)}")
            return 0


class SubtaskCRUD(CRUDBase[Subtask]):
    """
    子任务 CRUD 操作类

    提供对子任务表的特定操作
    """

    def __init__(self):
        """初始化子任务 CRUD 操作类"""
        super().__init__(Subtask)

    def get_by_task(self, task_id: Union[str, uuid.UUID], limit: int = 100, offset: int = 0) -> List[Subtask]:
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
        return self.get_multi(limit=limit, status=SubtaskStatus.PENDING.value)

    def update_status(self, id: Union[str, uuid.UUID], status: str, error: Optional[str] = None) -> Optional[Subtask]:
        """
        更新子任务状态

        Args:
            id: 子任务 ID
            status: 新状态
            error: 错误信息（如果有）

        Returns:
            更新后的子任务，如果更新失败则返回 None
        """
        data = {
            "status": status,
            "updated_at": datetime.now()
        }

        # 根据状态设置相关时间戳
        if status == SubtaskStatus.PROCESSING.value:
            data["started_at"] = datetime.now()
        elif status in [SubtaskStatus.COMPLETED.value, SubtaskStatus.FAILED.value, SubtaskStatus.CANCELLED.value]:
            data["completed_at"] = datetime.now()

        # 如果有错误信息，添加到更新数据
        if error and status == SubtaskStatus.FAILED.value:
            data["error"] = error
            # 增加重试计数
            subtask = self.get(id)
            if subtask:
                data["retry_count"] = subtask.retry_count + 1

        return self.update(id, **data)

    def set_result(self, id: Union[str, uuid.UUID], result: Dict[str, Any]) -> Optional[Subtask]:
        """
        设置子任务结果

        Args:
            id: 子任务 ID
            result: 结果数据

        Returns:
            更新后的子任务，如果更新失败则返回 None
        """
        return self.update(id, result=result, status=SubtaskStatus.COMPLETED.value, completed_at=datetime.now())

    def set_rating(self, id: Union[str, uuid.UUID], rating: Optional[int], evaluation: Optional[str] = None) -> Optional[Subtask]:
        """
        设置子任务评分

        Args:
            id: 子任务 ID
            rating: 评分（1-5），如果为 None 则表示未评分
            evaluation: 评价内容

        Returns:
            更新后的子任务，如果更新失败则返回 None
        """
        data = {"rating": rating, "updated_at": datetime.now()}

        if evaluation is not None:
            data["evaluation"] = evaluation

        return self.update(id, **data)


class TaskCRUD(CRUDBase[Task]):
    """
    任务 CRUD 操作类

    提供对任务表的特定操作
    """

    def __init__(self):
        """初始化任务 CRUD 操作类"""
        super().__init__(Task)

    def get_by_user(self, user_id: Union[str, uuid.UUID], limit: int = 100, offset: int = 0, is_deleted: bool = False) -> List[Task]:
        """
        获取用户的所有任务

        Args:
            user_id: 用户 ID
            limit: 最大记录数
            offset: 起始位置
            is_deleted: 是否已删除

        Returns:
            任务列表
        """
        try:
            # 确保 ID 是字符串类型
            user_id_str = str(user_id)

            query = Task.select().where(
                (Task.user == user_id_str) &
                (Task.is_deleted == is_deleted)
            ).limit(limit).offset(offset)

            return list(query)
        except Exception as e:
            logger.error(f"获取用户的任务时出错: 用户 ID: {user_id}, 错误: {str(e)}")
            return []

    def update_progress(self, id: Union[str, uuid.UUID]) -> Optional[Task]:
        """
        更新任务进度

        基于已处理的子任务数量计算任务进度

        Args:
            id: 任务 ID

        Returns:
            更新后的任务，如果更新失败则返回 None
        """
        try:
            # 确保 ID 是字符串类型
            id_str = str(id)

            # 获取任务
            task = self.get(id_str)
            if not task:
                return None

            # 计算已处理的子任务数
            processed_subtasks = Subtask.select().where(
                (Subtask.task == id_str) &
                (Subtask.status == SubtaskStatus.COMPLETED.value)
            ).count()

            # 获取子任务总数
            total_subtasks = Subtask.select().where(Subtask.task == id_str).count()

            # 计算进度
            progress = 0
            if total_subtasks > 0:
                progress = int((processed_subtasks / total_subtasks) * 100)

            # 更新任务
            return self.update(
                id_str,
                processed_images=processed_subtasks,
                total_images=total_subtasks,
                progress=progress
            )
        except Exception as e:
            logger.error(f"更新任务进度时出错: 任务 ID: {id}, 错误: {str(e)}")
            return None


# 创建 CRUD 实例
subtask_crud = SubtaskCRUD()
task_crud = TaskCRUD()