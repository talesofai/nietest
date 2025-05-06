from typing import Optional, Dict, Any, List
import logging
from fastapi import APIRouter, Depends, HTTPException, Query, Path

from app.api.deps import get_current_user, get_optional_current_user
from app.schemas.task import TaskCreate, TaskResponse, TaskListResponse, TaskDetail, TaskMatrixResponse
from app.schemas.common import APIResponse
from app.services.task import create_task, get_task, list_tasks, cancel_task, delete_task
from app.db.mongodb import get_database
from app.core.config import settings

# 处理MongoDB ObjectId序列化
from bson import ObjectId

def convert_objectid(obj):
    """递归转换字典或列表中的ObjectId为字符串"""
    if isinstance(obj, dict):
        return {k: convert_objectid(v) for k, v in obj.items()}
    elif isinstance(obj, list):
        return [convert_objectid(item) for item in obj]
    elif isinstance(obj, ObjectId):
        return str(obj)
    else:
        return obj

# 配置日志
logger = logging.getLogger(__name__)

router = APIRouter()

@router.post("/", response_model=APIResponse[TaskResponse])
@router.post("", response_model=APIResponse[TaskResponse])
async def create_new_task(
    task_data: TaskCreate,
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

    # 立即准备子任务
    from app.services.task import prepare_dramatiq_tasks
    preparation_result = await prepare_dramatiq_tasks(task["id"])

    if preparation_result.get("status") == "failed":
        logger.error(f"准备子任务失败: {preparation_result.get('error')}")
    else:
        logger.info(f"子任务准备成功: {preparation_result.get('message')}")

    # 启动任务监控
    from app.services.task_processor import monitor_task_progress
    import asyncio
    # 异步启动任务监控，不等待结果
    asyncio.create_task(monitor_task_progress(task["id"]))

    # 动态计算processed_images和progress字段
    # 初始创建时这些值都是0
    task_response = None
    if "processed_images" in task and "progress" in task:
        # 如果task中已包含所需字段，直接使用
        task_response = TaskResponse(**task)
    else:
        # 如果task中没有这些字段，额外添加它们
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
    task_name: Optional[str] = Query(None, description="任务名称搜索"),
    current_user = Depends(get_optional_current_user)
):
    """
    获取任务列表

    Args:
        status: 任务状态过滤
        page: 页码
        page_size: 每页大小
        username: 用户名过滤
        task_name: 任务名称搜索
        current_user: 当前用户（可选）

    Returns:
        任务列表和分页信息
    """
    # 如果用户已登录且未指定用户名过滤，则使用当前用户的用户名
    # 注意：如果需要查看所有用户的任务，请将下面的代码取消注释
    # if current_user and not username:
    #     username = current_user["email"]

    # 记录查询参数
    logger.debug(f"获取任务列表: username={username}, status={status}, task_name={task_name}, page={page}, page_size={page_size}")

    # 获取任务列表
    result = await list_tasks(
        username=username,
        status=status,
        task_name=task_name,
        page=page,
        page_size=page_size
    )

    # 记录查询结果
    logger.debug(f"任务列表原始数据: {result}")

    # 检查第一个任务的数据结构
    if result.get("items") and len(result.get("items")) > 0:
        first_task = result.get("items")[0]
        logger.debug(f"第一个任务的字段: {list(first_task.keys())}")
        logger.debug(f"第一个任务的状态: {first_task.get('status')}")

        # 尝试创建TaskResponse对象
        try:
            task_response = TaskResponse(**first_task)
            logger.debug(f"成功创建TaskResponse对象: {task_response}")
        except Exception as e:
            logger.error(f"创建TaskResponse对象失败: {str(e)}")
            # 记录缺失的字段
            required_fields = ["id", "task_name", "username", "status", "created_at", "updated_at", "total_images", "priority"]
            for field in required_fields:
                if field not in first_task:
                    logger.error(f"缺失必要字段: {field}")
                    # 添加默认值
                    if field == "priority":
                        first_task[field] = 1

    # 将结果转换为符合TaskListResponse模型的格式
    # 在services/task.py中已经计算了processed_images和progress字段
    tasks = []
    for task in result.get("items", []):
        try:
            # 确保所有必要字段都存在
            if "priority" not in task:
                task["priority"] = 1
            tasks.append(TaskResponse(**task))
        except Exception as e:
            logger.error(f"创建TaskResponse失败: {str(e)}, 任务数据: {task}")

    response_data = {
        "tasks": tasks,
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
    db = await get_database()
    task = await get_task(db, task_id)

    if not task:
        raise HTTPException(
            status_code=404,
            detail="任务不存在"
        )

    # 获取子任务数据
    from app.crud.dramatiq_task import get_dramatiq_tasks_by_parent_id
    dramatiq_tasks = await get_dramatiq_tasks_by_parent_id(db, task_id)

    # 转换ObjectId为字符串
    dramatiq_tasks = convert_objectid(dramatiq_tasks)
    task = convert_objectid(task)

    # 将子任务数据添加到任务详情中
    task["dramatiq_tasks"] = dramatiq_tasks

    # 记录子任务数量
    logger.info(f"任务 {task_id} 的子任务数量: {len(dramatiq_tasks)}")

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
    db = await get_database()
    task = await get_task(db, task_id)

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
    db = await get_database()
    task = await get_task(db, task_id)

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

@router.get("/{task_id}/matrix", response_model=APIResponse[TaskMatrixResponse])
async def get_task_matrix(
    task_id: str = Path(..., description="任务ID")
):
    """
    获取任务矩阵数据（基于索引的六维空间坐标系统）

    Args:
        task_id: 任务ID

    Returns:
        任务矩阵数据

    Raises:
        HTTPException: 任务不存在
    """
    db = await get_database()
    task_doc = await get_task(db, task_id)

    if not task_doc:
        raise HTTPException(
            status_code=404,
            detail="任务不存在"
        )

    # 获取子任务数据
    from app.crud.dramatiq_task import get_dramatiq_tasks_by_parent_id
    dramatiq_tasks = await get_dramatiq_tasks_by_parent_id(db, task_id)

    # 转换ObjectId为字符串
    dramatiq_tasks = convert_objectid(dramatiq_tasks)
    task_doc_converted = convert_objectid(task_doc)

    # 新的坐标映射：键是基于索引的字符串，例如 "0,1,,,,"
    # 值是图片 URL
    coordinates_by_indices = {}

    # 获取变量定义
    task_variables = task_doc_converted.get("variables", {})

    # 处理所有完成的子任务
    for subtask in dramatiq_tasks:
        if subtask.get("status") == "completed" and subtask.get("result") and subtask["result"].get("url"):
            # subtask_variable_indices 是一个列表，包含了该子任务所使用的
            # 每个变量 (v0, v1, ...) 在其 respective `values` 数组中的索引
            subtask_variable_indices = subtask.get("variable_indices", [])

            # 构建索引键 (确保总是6个部分，用空字符串代表None或未使用)
            current_indices_key_parts = [""] * 6  # 初始化为6个空字符串，对应 v0 到 v5

            for i, val_idx in enumerate(subtask_variable_indices):
                if i < 6: # 确保只处理 v0 到 v5
                    if val_idx is not None: # 仅当索引存在时才转换为字符串
                        current_indices_key_parts[i] = str(val_idx)

            indexed_key = ",".join(current_indices_key_parts)
            coordinates_by_indices[indexed_key] = subtask["result"]["url"]
            logger.debug(f"Task {task_id} matrix: generated key '{indexed_key}' for url '{subtask['result']['url']}'")

    logger.info(f"Task {task_id} matrix data successfully prepared with {len(coordinates_by_indices)} coordinates.")
    if not coordinates_by_indices and dramatiq_tasks:
         logger.warning(f"Task {task_id} has {len(dramatiq_tasks)} subtasks but generated 0 coordinates for matrix. Check subtask structure and variable_indices.")

    # 返回矩阵数据
    response_data = {
        "task_id": task_id,
        "task_name": task_doc_converted.get("task_name", ""),
        "created_at": task_doc_converted.get("created_at"),
        "variables": task_variables,
        "coordinates_by_indices": coordinates_by_indices
    }

    return APIResponse[TaskMatrixResponse](
        code=200,
        message="success",
        data=response_data
    )
