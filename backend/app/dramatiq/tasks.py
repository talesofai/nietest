import dramatiq
import logging
from datetime import datetime, timedelta, timezone
from typing import Dict, Any, Optional, List
import time
import asyncio
from bson import ObjectId

from app.db.mongodb import get_database
from app.models.task import TaskStatus
from app.models.dramatiq_task import DramatiqTaskStatus
from app.utils.make_image import create_image_generator
from app.dramatiq.broker import redis_broker

# 配置日志
logger = logging.getLogger(__name__)

@dramatiq.actor(broker=redis_broker, max_retries=3, time_limit=3600000)  # 1小时超时
def generate_images(task_id: str) -> Dict[str, Any]:
    """
    生成图片的主任务，监控和管理子任务的执行

    Args:
        task_id: 任务ID

    Returns:
        执行结果
    """
    try:
        # 获取数据库连接
        db = asyncio.run(get_database())

        # 获取任务信息
        from app.crud.task import get_task
        task_data = asyncio.run(get_task(db, task_id))

        if not task_data:
            raise ValueError(f"找不到任务 {task_id}")

        # 检查任务状态
        from app.crud.dramatiq_task import get_dramatiq_tasks_by_parent_id

        # 获取子任务
        sub_tasks = asyncio.run(get_dramatiq_tasks_by_parent_id(db, task_id))

        # 如果子任务未创建，创建子任务
        if not sub_tasks:
            # 创建子任务
            from app.services.task import prepare_dramatiq_tasks
            preparation_result = asyncio.run(prepare_dramatiq_tasks(task_id))

            if preparation_result.get("status") == "failed":
                raise Exception(f"创建子任务失败: {preparation_result.get('error')}")

            # 重新获取子任务
            sub_tasks = asyncio.run(get_dramatiq_tasks_by_parent_id(db, task_id))

            if not sub_tasks:
                raise Exception(f"无法创建任务 {task_id} 的子任务")

        # 监控子任务执行
        while True:
            # 获取最新的任务状态
            from app.crud.task import get_task
            task_data = asyncio.run(get_task(db, task_id))

            # 如果任务已取消，停止执行
            if task_data.get("status") == TaskStatus.CANCELLED.value:
                return {"status": "cancelled", "message": "任务已取消"}

            # 获取子任务状态
            from app.crud.dramatiq_task import get_dramatiq_tasks_by_parent_id
            sub_tasks = asyncio.run(get_dramatiq_tasks_by_parent_id(db, task_id))
            total_tasks = len(sub_tasks)
            completed_tasks = sum(1 for task in sub_tasks if task.get("status") == DramatiqTaskStatus.COMPLETED.value)
            failed_tasks = sum(1 for task in sub_tasks if task.get("status") == DramatiqTaskStatus.FAILED.value)

            # 计算进度
            progress = int((completed_tasks + failed_tasks) / total_tasks * 100) if total_tasks > 0 else 0

            # 更新任务进度
            from app.crud.task import update_task_progress
            asyncio.run(update_task_progress(db, task_id, completed_tasks + failed_tasks, progress))

            # 检查是否所有子任务已完成
            if completed_tasks + failed_tasks >= total_tasks:
                # 更新任务状态为已完成
                from app.crud.task import update_task_status
                if failed_tasks == total_tasks:
                    asyncio.run(update_task_status(db, task_id, TaskStatus.FAILED.value))
                    return {"status": "failed", "message": "所有子任务均失败"}
                else:
                    asyncio.run(update_task_status(db, task_id, TaskStatus.COMPLETED.value))
                    return {"status": "completed", "message": "任务已完成"}

            # 等待一段时间再检查
            time.sleep(5)

    except Exception as e:
        # 记录错误并更新任务状态
        logger.error(f"执行任务 {task_id} 时出错: {str(e)}")

        try:
            db = asyncio.run(get_database())
            from app.crud.task import update_task_status
            asyncio.run(update_task_status(db, task_id, TaskStatus.FAILED.value, str(e)))
        except Exception as update_error:
            logger.error(f"更新任务状态时出错: {str(update_error)}")

        raise

@dramatiq.actor(broker=redis_broker, max_retries=3, time_limit=600000)  # 10分钟超时
def generate_single_image(
    parent_task_id: str,
    prompt: Dict[str, Any],
    characters: List[Dict[str, Any]],
    elements: List[Dict[str, Any]],
    ratio: str,
    seed: Optional[int],
    use_polish: bool,
    x_token: str,
    variable_indices: Dict[str, int] = {},
    combination: Dict[str, Dict[str, str]] = {}
) -> Dict[str, Any]:
    """
    生成单张图片的子任务

    Args:
        parent_task_id: 父任务ID
        combination_key: 变量组合键
        prompts: 提示词列表
        ratio: 图片比例
        seed: 随机种子
        use_polish: 是否使用润色
        x_token: API认证的token
        variable_indices: 变量索引信息
        combination: 变量组合

    Returns:
        执行结果
    """
    try:
        # 获取数据库连接
        db = asyncio.run(get_database())

        # 获取仓库
        from app.crud.dramatiq_task import get_dramatiq_task_by_variables, update_dramatiq_task_status, update_dramatiq_task_result, update_dramatiq_task_error

        # 获取当前Dramatiq任务
        dramatiq_task_data = asyncio.run(get_dramatiq_task_by_variables(
            db, parent_task_id,
            v0=variable_indices.get("v0"),
            v1=variable_indices.get("v1"),
            v2=variable_indices.get("v2"),
            v3=variable_indices.get("v3"),
            v4=variable_indices.get("v4"),
            v5=variable_indices.get("v5")
        ))

        if not dramatiq_task_data:
            raise ValueError(f"找不到匹配的Dramatiq任务")

        # 更新子任务状态为处理中
        asyncio.run(update_dramatiq_task_status(
            db, dramatiq_task_data["id"], DramatiqTaskStatus.PROCESSING.value
        ))

        # 创建图片生成器
        image_generator = create_image_generator(x_token)

        # 计算宽高
        width, height = asyncio.run(image_generator.calculate_dimensions(ratio))

        # 处理提示词
        prompt_value = ""
        if isinstance(prompt, dict) and "value" in prompt:
            prompt_value = prompt["value"]

        # 处理角色
        character_values = []
        for char in characters:
            if isinstance(char, dict) and "name" in char:
                character_values.append(char["name"])

        # 处理元素
        element_values = []
        for elem in elements:
            if isinstance(elem, dict) and "name" in elem:
                element_values.append(elem["name"])

        # 组合提示词、角色和元素
        all_prompts = []

        # 添加提示词（如果有）
        if prompt_value:
            all_prompts.append(prompt_value)

        # 添加角色和元素
        all_prompts.extend(character_values)
        all_prompts.extend(element_values)

        # 如果没有任何提示词，添加一个空占位符
        if not all_prompts:
            all_prompts = ["placeholder"]

        # 生成图片
        image_result = asyncio.run(image_generator.generate_image(
            prompts=all_prompts,
            width=width,
            height=height,
            seed=seed,
            advanced_translator=use_polish
        ))

        # 提取图片URL
        image_url = asyncio.run(image_generator.extract_image_url(image_result))

        # 创建结果项
        result_item = {
            "url": image_url,
            "width": width,
            "height": height,
            "seed": seed,
            "created_at": datetime.now(timezone.utc).isoformat()
        }

        # 更新子任务状态为已完成
        asyncio.run(update_dramatiq_task_result(
            db, dramatiq_task_data["id"], DramatiqTaskStatus.COMPLETED.value, result_item
        ))

        return {
            "status": "completed",
            "result": result_item
        }

    except Exception as e:
        # 记录错误并更新子任务状态
        logger.error(f"生成图片时出错: {str(e)}")

        try:
            db = asyncio.run(get_database())
            from app.crud.dramatiq_task import get_dramatiq_task_by_variables, update_dramatiq_task_error

            dramatiq_task_data = asyncio.run(get_dramatiq_task_by_variables(
                db, parent_task_id,
                v0=variable_indices.get("v0"),
                v1=variable_indices.get("v1"),
                v2=variable_indices.get("v2"),
                v3=variable_indices.get("v3"),
                v4=variable_indices.get("v4"),
                v5=variable_indices.get("v5")
            ))

            if dramatiq_task_data:
                asyncio.run(update_dramatiq_task_error(
                    db, dramatiq_task_data["id"], DramatiqTaskStatus.FAILED.value, str(e)
                ))
        except Exception as update_error:
            logger.error(f"更新子任务状态时出错: {str(update_error)}")

        raise

@dramatiq.actor(broker=redis_broker)
def cleanup_expired_tasks() -> Dict[str, Any]:
    """
    清理过期的任务

    Returns:
        清理结果
    """
    try:
        # 计算过期时间（30天前）
        expiration_date = datetime.now(timezone.utc) - timedelta(days=30)

        # 获取数据库连接
        db = asyncio.run(get_database())

        # 查找过期的任务
        from app.crud.task import list_tasks, delete_task
        from app.crud.dramatiq_task import delete_dramatiq_tasks_by_parent_id

        # 获取30天前的任务
        result = asyncio.run(list_tasks(
            db,
            status=None,
            page=1,
            page_size=1000,
            created_before=expiration_date
        ))

        expired_tasks = result.get("items", [])
        deleted_count = 0

        # 标记为已删除
        for task in expired_tasks:
            task_id = task.get("id")
            if task_id:
                # 删除任务
                asyncio.run(delete_task(db, task_id))

                # 删除相关的子任务
                asyncio.run(delete_dramatiq_tasks_by_parent_id(db, task_id))

                deleted_count += 1

        return {
            "deleted_count": deleted_count,
            "expiration_date": expiration_date.isoformat()
        }

    except Exception as e:
        logger.error(f"清理过期任务时出错: {str(e)}")
        raise
