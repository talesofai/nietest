"""
图像生成 Actor 模块

处理图像生成任务的后台 worker，使用 dramatiq 实现
"""
import dramatiq
import logging
import uuid
import json
import asyncio
import traceback
from datetime import datetime
from typing import Optional, Dict, Any, List, Union

from dramatiq.rate_limits import ConcurrentRateLimiter

from backend2.workers.broker import image_concurrency_limiter
from backend2.services.make_image import create_make_image_service
from backend2.models.db.subtasks import Subtask, SubtaskStatus
from backend2.models.db.crud import subtask_crud, task_crud

# 配置日志
logger = logging.getLogger(__name__)

# 创建图像生成服务实例
make_image_service = create_make_image_service()


@dramatiq.actor(
    queue_name="image_generation",
    max_retries=3,
    time_limit=600000,  # 10分钟超时
    rate_limiter=image_concurrency_limiter
)
def generate_image_for_subtask(subtask_id: str) -> None:
    """
    处理子任务的图像生成

    Args:
        subtask_id: 子任务ID
    """
    logger.info(f"开始处理子任务图像生成: {subtask_id}")

    try:
        # 查询子任务
        subtask = subtask_crud.get(subtask_id)
        if not subtask:
            logger.error(f"子任务不存在: {subtask_id}")
            return

        # 检查子任务状态
        if subtask.status != SubtaskStatus.PENDING.value:
            logger.warning(f"子任务状态不是等待中，跳过处理: {subtask_id}, 当前状态: {subtask.status}")
            return

        # 更新子任务状态为处理中
        subtask_crud.update_status(subtask_id, SubtaskStatus.PROCESSING.value)

        # 获取子任务参数
        prompts = subtask.prompts
        ratio = subtask.ratio
        seed = subtask.seed
        queue_type = subtask.make_api_queue

        logger.info(f"子任务 {subtask_id} 参数: ratio={ratio}, seed={seed}, queue={queue_type}")

        # 调用异步图像生成函数
        result = asyncio.run(_generate_image_async(
            prompts=prompts,
            ratio=ratio,
            seed=seed,
            queue_type=queue_type
        ))

        # 处理成功，更新子任务信息
        subtask_crud.set_result(subtask_id, result)

        # 更新主任务进度
        task_crud.update_progress(subtask.task_id)

        logger.info(f"子任务图像生成成功: {subtask_id}, 图像URL: {result.get('image_url', '')[:50]}...")

    except Exception as e:
        # 获取详细的异常信息
        error_details = traceback.format_exc()
        logger.error(f"子任务图像生成出错: {subtask_id}, 错误: {str(e)}")
        logger.error(f"异常详情: {error_details}")

        try:
            # 更新子任务状态为失败
            subtask_crud.update_status(subtask_id, SubtaskStatus.FAILED.value, f"{str(e)}\n\n{error_details}")
        except Exception as update_error:
            logger.error(f"更新失败子任务状态时出错: {subtask_id}, 错误: {str(update_error)}")

        # 重新抛出异常，让 dramatiq 处理重试逻辑
        raise


async def _generate_image_async(
    prompts: List[Dict[str, Any]],
    ratio: str = "1:1",
    seed: Optional[int] = None,
    queue_type: str = ""
) -> Dict[str, Any]:
    """
    异步调用图像生成服务

    Args:
        prompts: 提示词列表
        ratio: 图像比例
        seed: 随机种子
        queue_type: API队列类型

    Returns:
        图像生成结果
    """
    return await make_image_service.generate_image(
        prompts=prompts,
        ratio=ratio,
        seed=seed,
        queue_type=queue_type
    )


def enqueue_image_generation(subtask: Union[Subtask, str]) -> None:
    """
    将子任务加入图像生成队列

    Args:
        subtask: 子任务对象或子任务ID
    """
    # 如果传入的是子任务对象，获取其ID
    subtask_id = subtask.id if isinstance(subtask, Subtask) else subtask

    # 确保ID是字符串类型
    subtask_id_str = str(subtask_id)

    logger.info(f"将子任务加入图像生成队列: {subtask_id_str}")

    # 发送到 dramatiq 队列
    generate_image_for_subtask.send(subtask_id_str)