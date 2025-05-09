"""
任务服务模块

处理任务相关的业务逻辑
"""
from typing import Dict, Any, List, Optional
from datetime import datetime
import logging

from backend2.models.db.tasks import Task, TaskStatus, MakeApiQueue
from backend2.models.prompt import Prompt
from backend2.crud.task import task_crud

# 配置日志
logger = logging.getLogger(__name__)


class SettingField:
    """通用设置字段模型"""
    def __init__(self, value: Any = None, is_variable: bool = False, variable_id: Optional[str] = None):
        """
        初始化设置字段

        Args:
            value: 字段值
            is_variable: 是否为变量
            variable_id: 变量ID
        """
        self.value = value
        self.is_variable = is_variable
        self.variable_id = variable_id

    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> 'SettingField':
        """
        从字典创建设置字段

        Args:
            data: 字典数据

        Returns:
            设置字段对象
        """
        return cls(
            value=data.get('value'),
            is_variable=data.get('is_variable', False),
            variable_id=data.get('variable_id')
        )

    def to_dict(self) -> Dict[str, Any]:
        """
        转换为字典

        Returns:
            字典表示
        """
        return {
            'value': self.value,
            'is_variable': self.is_variable,
            'variable_id': self.variable_id
        }


def validate_setting(setting: Dict[str, Any]) -> Dict[str, Any]:
    """
    验证设置字段格式，确保所需键存在

    Args:
        setting: 设置字段字典

    Returns:
        处理后的设置字段字典

    Raises:
        ValueError: 当设置无效时抛出
    """
    # 确保必需的键存在
    if not isinstance(setting, dict):
        setting = {}

    result = {
        'value': setting.get('value'),
        'is_variable': setting.get('is_variable', False),
        'variable_id': setting.get('variable_id')
    }

    # 当设置为变量时，确保variable_id不为空
    if result['is_variable'] and not result['variable_id']:
        raise ValueError("当设置为变量时，variable_id不能为空")

    # 当设置为非变量时，确保value不为空
    if not result['is_variable'] and not result['value']:
        raise ValueError("当设置为非变量时，value不能为空")

    return result


def validate_prompts(prompts: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    """
    验证提示词列表，确保格式正确

    Args:
        prompts: 提示词列表

    Returns:
        处理后的提示词列表

    Raises:
        ValueError: 当提示词格式不正确时
    """
    if not isinstance(prompts, list):
        raise ValueError("prompts必须是列表类型")

    if len(prompts) == 0:
        raise ValueError("prompts不能为空")

    validated_prompts = []

    for i, prompt_data in enumerate(prompts):
        try:
            # 使用Prompt类验证每个提示词
            Prompt(prompt_data)  # 只验证，不使用返回值
            validated_prompts.append(prompt_data)
        except ValueError as e:
            raise ValueError(f"第{i+1}个提示词无效: {str(e)}")

    return validated_prompts


def create_task(user_id: str, name: str, settings: Dict[str, Any]) -> Optional[Task]:
    """
    创建新任务

    Args:
        user_id: 用户ID
        name: 任务名称
        settings: 任务设置

    Returns:
        创建的任务，如果创建失败则返回None
    """
    try:
        # 验证必要的设置
        prompts = validate_prompts(settings.get('prompts', []))
        ratio = validate_setting(settings.get('ratio', {}))
        seed = validate_setting(settings.get('seed', {}))
        batch_size = validate_setting(settings.get('batch_size', {}))
        polish = validate_setting(settings.get('polish', {}))

        # 准备变量数据
        variables = settings.get('variables', {})

        # 创建任务
        task_data = {
            'name': name,
            'user': user_id,
            'status': TaskStatus.PENDING.value,
            'make_api_queue': settings.get('make_api_queue', MakeApiQueue.PROD.value),
            'priority': settings.get('priority', 1),
            'prompts': prompts,
            'ratio': ratio,
            'seed': seed,
            'batch_size': batch_size,
            'polish': polish,
            'variables': variables
        }

        task = task_crud.create(obj_in=task_data)
        return task
    except Exception as e:
        logger.error(f"创建任务失败: {str(e)}")
        return None


def update_task_status(task_id: str, status: str) -> Optional[Task]:
    """
    更新任务状态

    Args:
        task_id: 任务ID
        status: 新状态

    Returns:
        更新后的任务，如果更新失败则返回None
    """
    try:
        task = task_crud.get(id=task_id)
        if not task:
            logger.warning(f"任务不存在: {task_id}")
            return None

        # 如果设置为已完成状态，更新完成时间
        if status == TaskStatus.COMPLETED.value:
            update_data = {
                'status': status,
                'completed_at': datetime.now()
            }
        else:
            update_data = {'status': status}

        updated_task = task_crud.update(db_obj=task, obj_in=update_data)
        return updated_task
    except Exception as e:
        logger.error(f"更新任务状态失败: {str(e)}")
        return None


# 更多任务相关的业务逻辑函数可在此添加

def check_and_update_task_completion(task_id: str) -> bool:
    """
    检查任务的所有子任务是否已完成或失败，并更新任务状态

    Args:
        task_id: 任务ID

    Returns:
        是否更新了任务状态
    """
    try:
        from backend2.models.db.subtasks import Subtask, SubtaskStatus

        # 获取任务
        task = task_crud.get(id=task_id)
        if not task:
            logger.warning(f"任务不存在: {task_id}")
            return False

        # 获取任务的所有子任务
        subtasks = list(Subtask.select().where(Subtask.task == task_id))

        if not subtasks:
            logger.warning(f"任务 {task_id} 没有子任务")
            return False

        # 计算子任务状态
        total_subtasks = len(subtasks)
        completed_subtasks = sum(1 for s in subtasks if s.status == SubtaskStatus.COMPLETED.value)
        failed_subtasks = sum(1 for s in subtasks if s.status == SubtaskStatus.FAILED.value)
        cancelled_subtasks = sum(1 for s in subtasks if s.status == SubtaskStatus.CANCELLED.value)

        # 计算已处理的子任务数量
        processed_subtasks = completed_subtasks + failed_subtasks + cancelled_subtasks

        logger.info(f"任务 {task_id} 子任务状态: 总数={total_subtasks}, 已完成={completed_subtasks}, "
                   f"失败={failed_subtasks}, 已取消={cancelled_subtasks}")

        # 如果所有子任务都已处理完成
        if processed_subtasks == total_subtasks:
            # 如果所有子任务都失败，则任务失败
            if failed_subtasks == total_subtasks:
                logger.warning(f"任务 {task_id} 的所有子任务都失败，将任务标记为失败")
                update_task_status(task_id, TaskStatus.FAILED.value)
                return True
            # 如果所有子任务都被取消，则任务取消
            elif cancelled_subtasks == total_subtasks:
                logger.warning(f"任务 {task_id} 的所有子任务都被取消，将任务标记为取消")
                update_task_status(task_id, TaskStatus.CANCELLED.value)
                return True
            # 如果有一些子任务成功，则任务完成
            elif completed_subtasks > 0:
                logger.info(f"任务 {task_id} 的子任务已全部处理完成，将任务标记为完成")
                update_task_status(task_id, TaskStatus.COMPLETED.value)
                return True
            # 其他情况（所有子任务都是失败或取消的组合）
            else:
                logger.warning(f"任务 {task_id} 的子任务都是失败或取消状态，将任务标记为失败")
                update_task_status(task_id, TaskStatus.FAILED.value)
                return True

        # 更新任务进度
        task_crud.update_progress(task_id)
        return False
    except Exception as e:
        logger.error(f"检查任务完成状态时出错: {task_id}, 错误: {str(e)}")
        return False