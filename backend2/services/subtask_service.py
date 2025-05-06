"""
子任务服务模块

提供子任务的处理、提交和管理功能
"""
import logging
import uuid
from datetime import datetime
from typing import List, Dict, Any, Optional, Union

from backend2.models.db.subtasks import Subtask, SubtaskStatus
from backend2.models.db.tasks import Task, MakeApiQueue
from backend2.models.db.crud import subtask_crud, task_crud
from backend2.workers.image_actor import enqueue_image_generation

# 配置日志
logger = logging.getLogger(__name__)


class SubtaskService:
    """子任务服务类"""

    @staticmethod
    def create_subtask(
        task: Task,
        prompts: List[Dict[str, Any]],
        ratio: str = "1:1",
        seed: Optional[int] = None,
        batch_size: int = 1,
        use_polish: bool = False,
        variable_indices: str = "",
        queue_type: str = ""
    ) -> Optional[Subtask]:
        """
        创建子任务

        Args:
            task: 主任务对象
            prompts: 提示词列表
            ratio: 图像比例
            seed: 随机种子
            batch_size: 批量大小
            use_polish: 是否使用优化
            variable_indices: 变量索引
            queue_type: API队列类型

        Returns:
            创建的子任务对象，如果创建失败则返回 None
        """
        # 验证队列类型
        if queue_type not in [q.value for q in MakeApiQueue]:
            queue_type = MakeApiQueue.PROD.value

        # 创建子任务
        subtask = subtask_crud.create(
            task=task,
            status=SubtaskStatus.PENDING.value,
            make_api_queue=queue_type,
            variable_indices=variable_indices,
            prompts=prompts,
            ratio=ratio,
            seed=seed,
            batch_size=batch_size,
            use_polish=use_polish
        )

        if subtask:
            logger.info(f"创建子任务成功: {subtask.id}, 主任务: {task.id}")
        else:
            logger.error(f"创建子任务失败, 主任务: {task.id}")

        return subtask

    @staticmethod
    def submit_subtask(subtask: Union[Subtask, str]) -> bool:
        """
        提交子任务到队列

        Args:
            subtask: 子任务对象或子任务ID

        Returns:
            是否成功提交
        """
        # 如果传入的是子任务ID，先获取子任务对象
        if isinstance(subtask, str) or isinstance(subtask, uuid.UUID):
            subtask_id = str(subtask)
            subtask = subtask_crud.get(subtask_id)
            if not subtask:
                logger.error(f"子任务不存在: {subtask_id}")
                return False

        # 检查子任务状态
        if subtask.status != SubtaskStatus.PENDING.value:
            logger.warning(f"子任务状态不是等待中，不能提交: {subtask.id}, 当前状态: {subtask.status}")
            return False

        # 提交到队列
        enqueue_image_generation(subtask)
        logger.info(f"子任务已提交到队列: {subtask.id}")
        return True

    @staticmethod
    def batch_create_and_submit(
        task: Task,
        prompts_list: List[List[Dict[str, Any]]],
        ratio: str = "1:1",
        seeds: Optional[List[int]] = None,
        batch_size: int = 1,
        use_polish: bool = False,
        variable_indices_list: Optional[List[str]] = None,
        queue_type: str = ""
    ) -> List[Subtask]:
        """
        批量创建并提交子任务

        Args:
            task: 主任务对象
            prompts_list: 提示词列表的列表，每个元素对应一个子任务
            ratio: 图像比例
            seeds: 随机种子列表，与prompts_list长度对应
            batch_size: 批量大小
            use_polish: 是否使用优化
            variable_indices_list: 变量索引列表，与prompts_list长度对应
            queue_type: API队列类型

        Returns:
            创建的子任务对象列表
        """
        # 初始化参数
        if seeds is None:
            seeds = [None] * len(prompts_list)
        elif len(seeds) < len(prompts_list):
            seeds.extend([None] * (len(prompts_list) - len(seeds)))

        if variable_indices_list is None:
            variable_indices_list = [""] * len(prompts_list)
        elif len(variable_indices_list) < len(prompts_list):
            variable_indices_list.extend([""] * (len(prompts_list) - len(variable_indices_list)))

        # 创建子任务列表
        subtasks = []
        for i, prompts in enumerate(prompts_list):
            seed = seeds[i]
            variable_indices = variable_indices_list[i]

            # 创建子任务
            subtask = SubtaskService.create_subtask(
                task=task,
                prompts=prompts,
                ratio=ratio,
                seed=seed,
                batch_size=batch_size,
                use_polish=use_polish,
                variable_indices=variable_indices,
                queue_type=queue_type
            )

            if subtask:
                # 添加到结果列表
                subtasks.append(subtask)

                # 立即提交到队列
                SubtaskService.submit_subtask(subtask)

        # 更新主任务进度
        task_crud.update_progress(task.id)

        logger.info(f"批量创建并提交了 {len(subtasks)} 个子任务, 主任务: {task.id}")
        return subtasks

    @staticmethod
    def get_subtask(subtask_id: Union[str, uuid.UUID]) -> Optional[Subtask]:
        """
        获取子任务

        Args:
            subtask_id: 子任务ID

        Returns:
            子任务对象，如果不存在则返回 None
        """
        return subtask_crud.get(subtask_id)

    @staticmethod
    def get_subtasks_by_task(task_id: Union[str, uuid.UUID], limit: int = 100, offset: int = 0) -> List[Subtask]:
        """
        获取任务的所有子任务

        Args:
            task_id: 任务ID
            limit: 最大记录数
            offset: 起始位置

        Returns:
            子任务列表
        """
        return subtask_crud.get_by_task(task_id, limit, offset)

    @staticmethod
    def set_rating(subtask_id: Union[str, uuid.UUID], rating: Optional[int], evaluation: Optional[str] = None) -> Optional[Subtask]:
        """
        设置子任务评分

        Args:
            subtask_id: 子任务ID
            rating: 评分（1-5），如果为 None 则表示未评分
            evaluation: 评价内容

        Returns:
            更新后的子任务，如果更新失败则返回 None
        """
        return subtask_crud.set_rating(subtask_id, rating, evaluation)

    @staticmethod
    def get_pending_subtasks(limit: int = 100) -> List[Subtask]:
        """
        获取等待中的子任务

        Args:
            limit: 最大记录数

        Returns:
            等待中的子任务列表
        """
        return subtask_crud.get_pending_subtasks(limit)

    @staticmethod
    def cancel_subtask(subtask_id: Union[str, uuid.UUID]) -> Optional[Subtask]:
        """
        取消子任务

        Args:
            subtask_id: 子任务ID

        Returns:
            更新后的子任务，如果更新失败则返回 None
        """
        return subtask_crud.update_status(subtask_id, SubtaskStatus.CANCELLED.value)


# 创建服务实例
subtask_service = SubtaskService()