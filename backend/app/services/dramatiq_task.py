"""
Dramatiq任务处理服务模块

该模块负责处理Dramatiq任务，包括：
1. 处理单个Dramatiq任务的图像生成逻辑
2. 监控任务进度
3. 清理过期任务
"""

from typing import Dict, Any
import logging
import asyncio
from datetime import datetime, timezone

from app.db.mongodb import get_database, get_database_sync
from app.models.dramatiq_task import DramatiqTaskStatus
from app.services.image import create_image_generator, format_prompt_for_api

# 配置日志
logger = logging.getLogger(__name__)

async def process_image_task(task_id: str) -> Dict[str, Any]:
    """
    处理图像生成任务

    Args:
        task_id: Dramatiq任务ID

    Returns:
        处理结果
    """
    # 在当前事件循环中创建所有异步对象
    # 获取数据库连接
    db = await get_database()

    # 获取任务数据
    from app.crud.dramatiq_task import get_dramatiq_task, update_dramatiq_task_status
    task_data = await get_dramatiq_task(db, task_id)

    if not task_data:
        raise ValueError(f"找不到任务 {task_id}")

    # 更新任务状态为处理中
    await update_dramatiq_task_status(db, task_id, DramatiqTaskStatus.PROCESSING.value)



    try:
        # 提取任务参数
        prompt = task_data.get("prompt", {})
        characters = task_data.get("characters", [])
        elements = task_data.get("elements", [])
        ratio = task_data.get("ratio", "1:1")
        seed = task_data.get("seed")
        use_polish = task_data.get("use_polish", False)

        # 创建图像生成服务
        image_generator = create_image_generator()

        # 计算宽高
        width, height = await image_generator.calculate_dimensions(ratio)

        # 格式化提示词
        formatted_prompt = format_prompt_for_api(prompt, "prompt") if prompt else None
        formatted_characters = [format_prompt_for_api(char, "character") for char in characters] if characters else []
        formatted_elements = [format_prompt_for_api(elem, "element") for elem in elements] if elements else []

        # 合并所有提示词
        all_prompts = []

        # 添加主提示词
        if formatted_prompt:
            all_prompts.append(formatted_prompt)

        # 添加角色
        all_prompts.extend(formatted_characters)

        # 添加元素
        all_prompts.extend(formatted_elements)

        # 如果没有任何提示词，添加一个空占位符
        if not all_prompts:
            all_prompts = [{"type": "freetext", "weight": 1, "value": "placeholder"}]

        # 生成图像
        result = await image_generator.generate_image(
            prompts=all_prompts,
            width=width,
            height=height,
            seed=seed,
            advanced_translator=use_polish
        )

        # 提取图像URL
        image_url = await image_generator.extract_image_url(result)

        # 创建结果项
        result_item = {
            "url": image_url,
            "width": width,
            "height": height,
            "seed": seed,
            "created_at": datetime.now(timezone.utc).isoformat()
        }

        # 更新任务状态为已完成
        from app.crud.dramatiq_task import update_dramatiq_task_result
        await update_dramatiq_task_result(db, task_id, DramatiqTaskStatus.COMPLETED.value, result_item)

        return {
            "status": "completed",
            "result": result_item
        }
    except Exception as e:
        # 记录错误并更新任务状态
        logger.error(f"生成图像时出错: {str(e)}")

        try:
            from app.crud.dramatiq_task import update_dramatiq_task_error
            await update_dramatiq_task_error(db, task_id, DramatiqTaskStatus.FAILED.value, str(e))
        except Exception as update_error:
            logger.error(f"更新任务状态时出错: {str(update_error)}")

        raise

async def monitor_task_progress(task_id: str) -> Dict[str, Any]:
    """
    监控任务进度

    Args:
        task_id: 任务ID

    Returns:
        监控结果
    """
    try:
        # 确保我们在当前事件循环中创建所有异步对象
        # 获取数据库连接
        db = await get_database()

        # 获取任务信息
        from app.crud.task import get_task, update_task_status, update_subtasks_completion
        task_data = await get_task(db, task_id)

        if not task_data:
            raise ValueError(f"找不到任务 {task_id}")

        # 检查任务状态
        from app.crud.dramatiq_task import get_dramatiq_tasks_by_parent_id

        # 获取子任务
        sub_tasks = await get_dramatiq_tasks_by_parent_id(db, task_id)

        # 如果子任务未创建，创建子任务
        if not sub_tasks:
            # 创建子任务
            from app.services.task import prepare_dramatiq_tasks
            preparation_result = await prepare_dramatiq_tasks(task_id)

            if preparation_result.get("status") == "failed":
                raise Exception(f"创建子任务失败: {preparation_result.get('error')}")

            # 重新获取子任务
            sub_tasks = await get_dramatiq_tasks_by_parent_id(db, task_id)

            if not sub_tasks:
                raise Exception(f"无法创建任务 {task_id} 的子任务")

        # 监控子任务执行
        while True:
            # 获取最新的任务状态
            task_data = await get_task(db, task_id)

            # 如果任务已取消，停止执行
            from app.models.task import TaskStatus
            if task_data.get("status") == TaskStatus.CANCELLED.value:
                return {"status": "cancelled", "message": "任务已取消"}

            # 获取子任务状态
            sub_tasks = await get_dramatiq_tasks_by_parent_id(db, task_id)
            total_tasks = len(sub_tasks)
            completed_tasks = sum(1 for task in sub_tasks if task.get("status") == DramatiqTaskStatus.COMPLETED.value)
            failed_tasks = sum(1 for task in sub_tasks if task.get("status") == DramatiqTaskStatus.FAILED.value)

            # 检查是否所有子任务已完成或失败
            all_completed = (completed_tasks + failed_tasks) >= total_tasks

            # 如果所有子任务已完成或失败
            if all_completed:
                # 更新子任务完成状态
                await update_subtasks_completion(db, task_id, True)

                # 更新任务状态
                from app.models.task import TaskStatus

                # 如果所有子任务都失败，则任务失败
                if failed_tasks == total_tasks:
                    await update_task_status(db, task_id, TaskStatus.FAILED.value)
                    return {"status": "failed", "message": "所有子任务均失败"}
                # 如果有一些子任务失败，但不是全部，则任务部分完成
                elif failed_tasks > 0:
                    await update_task_status(db, task_id, TaskStatus.COMPLETED.value)
                    return {"status": "completed_with_failures", "message": "任务已完成，但有部分子任务失败"}
                # 如果所有子任务都成功，则任务成功
                else:
                    await update_task_status(db, task_id, TaskStatus.COMPLETED.value)
                    return {"status": "completed", "message": "任务已成功完成"}

            # 等待一段时间再检查
            await asyncio.sleep(5)

    except Exception as e:
        # 记录错误并更新任务状态
        logger.error(f"监控任务 {task_id} 进度时出错: {str(e)}")

        try:
            db = await get_database()
            from app.crud.task import update_task_status
            from app.models.task import TaskStatus
            await update_task_status(db, task_id, TaskStatus.FAILED.value, str(e))
        except Exception as update_error:
            logger.error(f"更新任务状态时出错: {str(update_error)}")

        raise

async def cleanup_expired_task_data() -> Dict[str, Any]:
    """
    清理过期的任务数据

    Returns:
        清理结果
    """
    try:
        # 计算过期时间（30天前）
        from datetime import datetime, timedelta, timezone
        expiration_date = datetime.now(timezone.utc) - timedelta(days=30)

        # 确保我们在当前事件循环中创建所有异步对象
        # 获取数据库连接
        db = await get_database()

        # 查找过期的任务
        from app.crud.task import list_tasks, delete_task
        from app.crud.dramatiq_task import delete_dramatiq_tasks_by_parent_id

        # 获取30天前的任务
        result = await list_tasks(
            db,
            status=None,
            page=1,
            page_size=1000,
            created_before=expiration_date
        )

        expired_tasks = result.get("items", [])
        deleted_count = 0

        # 标记为已删除
        for task in expired_tasks:
            task_id = task.get("id")
            if task_id:
                # 删除任务
                await delete_task(db, task_id)

                # 删除相关的子任务
                await delete_dramatiq_tasks_by_parent_id(db, task_id)

                deleted_count += 1

        return {
            "deleted_count": deleted_count,
            "expiration_date": expiration_date.isoformat()
        }
    except Exception as e:
        logger.error(f"清理过期任务时出错: {str(e)}")
        raise
