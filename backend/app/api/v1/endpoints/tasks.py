from typing import Optional
import logging
from fastapi import APIRouter, Depends, HTTPException, Query, Path, BackgroundTasks

from app.api.deps import get_current_user, get_optional_current_user
from app.schemas.task import TaskCreate, TaskResponse, TaskListResponse, TaskDetail
from app.schemas.common import APIResponse
from app.services.task import create_task, get_task, list_tasks, cancel_task, delete_task
from app.dramatiq.tasks import generate_images
from app.core.config import settings

# 配置日志
logger = logging.getLogger(__name__)

router = APIRouter()

@router.post("/", response_model=APIResponse[TaskResponse])
@router.post("", response_model=APIResponse[TaskResponse])
async def create_new_task(
    task_data: TaskCreate,
    background_tasks: BackgroundTasks,
    current_user = Depends(get_current_user)
):
    """
    创建新任务

    Args:
        task_data: 任务创建数据
        background_tasks: 后台任务
        current_user: 当前用户

    Returns:
        创建的任务
    """
    # 确保用户名正确
    task_data.username = current_user["email"]

    # 检查并发数设置
    task_settings = task_data.settings or {}
    concurrency = task_settings.get("concurrency", settings.TASKS_DEFAULT_CONCURRENCY)  # 默认并发数为3

    # 验证并发数
    if concurrency < 1 or concurrency > 50:
        task_settings["concurrency"] = min(max(concurrency, 1), 50)  # 限制在1-50之间

    # 将修改后的设置保存回 task_data
    task_data.settings = task_settings

    # 预先计算变量组合数
    total_images = 1
    variables = task_data.variables
    for var_key, var_data in variables.items():
        if var_key.startswith('v') and var_data.get('values') and len(var_data.get('values')) > 0:
            total_images *= len(var_data.get('values'))

    # 记录预计算的图片数量
    logger.info(f"预计算的图片数量: {total_images}")

    # 创建任务
    task = await create_task(task_data.model_dump())

    if not task:
        raise HTTPException(status_code=500, detail="创建任务失败")

    # 立即准备Dramatiq子任务
    from app.services.task import prepare_dramatiq_tasks
    preparation_result = await prepare_dramatiq_tasks(task["id"])

    if preparation_result.get("status") == "failed":
        logger.error(f"准备子任务失败: {preparation_result.get('error')}")
    else:
        logger.info(f"子任务准备成功: {preparation_result.get('message')}")

    # 在后台启动任务监控
    background_tasks.add_task(generate_images.send, task["id"])

    # 动态计算processed_images和progress字段
    # 初始创建时这些值都是0
    task_response = TaskResponse(
        **task,
        processed_images=0,
        progress=0
    )

    return APIResponse[TaskResponse](
        code=200,
        message="任务创建成功",
        data=task_response
    )

@router.get("/", response_model=APIResponse[TaskListResponse])
@router.get("", response_model=APIResponse[TaskListResponse])
async def read_tasks(
    status: Optional[str] = Query(None, description="任务状态过滤"),
    page: int = Query(1, ge=1, description="页码"),
    page_size: int = Query(10, ge=1, le=100, description="每页大小"),
    username: Optional[str] = Query(None, description="用户名过滤"),
    current_user = Depends(get_optional_current_user)
):
    """
    获取任务列表

    Args:
        status: 任务状态过滤
        page: 页码
        page_size: 每页大小
        username: 用户名过滤
        current_user: 当前用户（可选）

    Returns:
        任务列表和分页信息
    """
    # 如果用户已登录且未指定用户名过滤，则使用当前用户的用户名
    if current_user and not username:
        username = current_user["email"]

    # 获取任务列表
    result = await list_tasks(
        username=username,
        status=status,
        page=page,
        page_size=page_size
    )

    # 将结果转换为符合TaskListResponse模型的格式
    # 在services/task.py中已经计算了processed_images和progress字段
    response_data = {
        "tasks": [TaskResponse(**task) for task in result.get("items", [])],
        "total": result.get("total", 0),
        "page": result.get("page", page),
        "page_size": result.get("page_size", page_size)
    }

    return APIResponse[TaskListResponse](
        code=200,
        message="success",
        data=response_data
    )

@router.get("/{task_id}", response_model=APIResponse[TaskDetail])
async def read_task(
    task_id: str = Path(..., description="任务ID")
):
    """
    获取任务详情

    Args:
        task_id: 任务ID

    Returns:
        任务详情

    Raises:
        HTTPException: 任务不存在
    """
    task = await get_task(task_id)

    if not task:
        raise HTTPException(
            status_code=404,
            detail="任务不存在"
        )

    return APIResponse[TaskDetail](
        code=200,
        message="success",
        data=TaskDetail(**task)
    )

@router.post("/{task_id}/cancel", response_model=APIResponse)
async def cancel_task_endpoint(
    task_id: str = Path(..., description="任务ID"),
    current_user = Depends(get_current_user)
):
    """
    取消任务

    Args:
        task_id: 任务ID
        current_user: 当前用户

    Returns:
        取消结果

    Raises:
        HTTPException: 任务不存在或无权限
    """
    # 获取任务
    task = await get_task(task_id)

    if not task:
        raise HTTPException(
            status_code=404,
            detail="任务不存在"
        )

    # 检查权限
    if task["username"] != current_user["email"]:
        raise HTTPException(
            status_code=403,
            detail="无权限取消此任务"
        )

    # 取消任务
    result = await cancel_task(task_id)

    if not result:
        raise HTTPException(
            status_code=500,
            detail="取消任务失败"
        )

    return APIResponse(
        code=200,
        message="任务已取消"
    )

@router.delete("/{task_id}", response_model=APIResponse)
async def delete_task_endpoint(
    task_id: str = Path(..., description="任务ID"),
    current_user = Depends(get_current_user)
):
    """
    删除任务

    Args:
        task_id: 任务ID
        current_user: 当前用户

    Returns:
        删除结果

    Raises:
        HTTPException: 任务不存在或无权限
    """
    # 获取任务
    task = await get_task(task_id)

    if not task:
        raise HTTPException(
            status_code=404,
            detail="任务不存在"
        )

    # 检查权限
    if task["username"] != current_user["email"]:
        raise HTTPException(
            status_code=403,
            detail="无权限删除此任务"
        )

    # 删除任务
    result = await delete_task(task_id)

    if not result:
        raise HTTPException(
            status_code=500,
            detail="删除任务失败"
        )

    return APIResponse(
        code=200,
        message="任务已删除"
    )
