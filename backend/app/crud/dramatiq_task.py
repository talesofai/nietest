from datetime import datetime
from typing import Dict, Any, List, Optional
from bson import ObjectId

from app.models.dramatiq_task import DramatiqTaskStatus

async def create_dramatiq_task(db: Any, task_data: Dict[str, Any]) -> Dict[str, Any]:
    """
    创建新的Dramatiq任务

    Args:
        db: 数据库连接
        task_data: 任务数据

    Returns:
        创建的Dramatiq任务
    """
    # 准备任务数据
    task = {
        "parent_task_id": task_data.get("parent_task_id"),
        "dramatiq_message_id": task_data.get("dramatiq_message_id"),
        # 不再需要combination_key
        "v0": task_data.get("v0"),
        "v1": task_data.get("v1"),
        "v2": task_data.get("v2"),
        "v3": task_data.get("v3"),
        "v4": task_data.get("v4"),
        "v5": task_data.get("v5"),
        "status": task_data.get("status", DramatiqTaskStatus.PENDING.value),
        "result": task_data.get("result"),
        "error": task_data.get("error"),
        "retry_count": task_data.get("retry_count", 0),
        "prompt": task_data.get("prompt", []),
        "characters": task_data.get("characters", []),
        "elements": task_data.get("elements", []),
        "ratio": task_data.get("ratio", "1:1"),
        "seed": task_data.get("seed"),
        "use_polish": task_data.get("use_polish", False),
        "created_at": datetime.utcnow(),
        "updated_at": datetime.utcnow()
    }

    # 插入任务
    result = await db.dramatiq_tasks.insert_one(task)
    task_id = str(result.inserted_id)

    # 返回创建的任务
    created_task = await get_dramatiq_task(db, task_id)
    return created_task

async def get_dramatiq_task(db: Any, task_id: str) -> Optional[Dict[str, Any]]:
    """
    获取Dramatiq任务详情

    Args:
        db: 数据库连接
        task_id: 任务ID

    Returns:
        Dramatiq任务详情，如果不存在则返回None
    """
    # 查询任务
    task = await db.dramatiq_tasks.find_one({"_id": ObjectId(task_id)})

    if task:
        # 转换ID为字符串
        task["id"] = str(task.pop("_id"))

    return task

async def get_dramatiq_task_by_message_id(db: Any, message_id: str) -> Optional[Dict[str, Any]]:
    """
    通过Dramatiq消息ID获取任务详情

    Args:
        db: 数据库连接
        message_id: Dramatiq消息ID

    Returns:
        Dramatiq任务详情，如果不存在则返回None
    """
    # 查询任务
    task = await db.dramatiq_tasks.find_one({"dramatiq_message_id": message_id})

    if task:
        # 转换ID为字符串
        task["id"] = str(task.pop("_id"))

    return task

async def get_dramatiq_task_by_variables(db: Any, parent_task_id: str, v0: Optional[int] = None, v1: Optional[int] = None, v2: Optional[int] = None, v3: Optional[int] = None, v4: Optional[int] = None, v5: Optional[int] = None) -> Optional[Dict[str, Any]]:
    """
    通过父任务ID和变量索引获取Dramatiq任务

    Args:
        db: 数据库连接
        parent_task_id: 父任务ID
        v0: v0变量索引
        v1: v1变量索引
        v2: v2变量索引
        v3: v3变量索引
        v4: v4变量索引
        v5: v5变量索引

    Returns:
        匹配的Dramatiq任务，如果不存在则返回None
    """
    # 构建查询条件
    query = {"parent_task_id": parent_task_id}

    # 添加变量索引条件
    if v0 is not None:
        query["v0"] = v0
    if v1 is not None:
        query["v1"] = v1
    if v2 is not None:
        query["v2"] = v2
    if v3 is not None:
        query["v3"] = v3
    if v4 is not None:
        query["v4"] = v4
    if v5 is not None:
        query["v5"] = v5

    # 查询任务
    task = await db.dramatiq_tasks.find_one(query)

    if task:
        # 转换ID为字符串
        task["id"] = str(task.pop("_id"))

    return task


async def get_dramatiq_task_by_combination(db: Any, parent_task_id: str, combination_key: str) -> Optional[Dict[str, Any]]:
    """
    通过父任务ID和组合键获取Dramatiq任务（已弃用，使用get_dramatiq_task_by_variables代替）

    Args:
        db: 数据库连接
        parent_task_id: 父任务ID
        combination_key: 组合键

    Returns:
        匹配的Dramatiq任务，如果不存在则返回None
    """
    # 查询任务
    task = await db.dramatiq_tasks.find_one({
        "parent_task_id": parent_task_id
    })

    if task:
        # 转换ID为字符串
        task["id"] = str(task.pop("_id"))

    return task

async def get_dramatiq_tasks_by_parent_id(
    db: Any,
    parent_task_id: str,
    status: Optional[str] = None
) -> List[Dict[str, Any]]:
    """
    获取父任务的所有Dramatiq子任务

    Args:
        db: 数据库连接
        parent_task_id: 父任务ID
        status: 状态过滤（可选）

    Returns:
        Dramatiq任务列表
    """
    # 构建查询条件
    query = {"parent_task_id": parent_task_id}

    if status:
        query["status"] = status

    # 查询任务
    cursor = db.dramatiq_tasks.find(query)
    tasks = await cursor.to_list(length=None)

    # 转换ID为字符串
    for task in tasks:
        task["id"] = str(task.pop("_id"))

    return tasks

async def update_dramatiq_task(db: Any, task_id: str, update_data: Dict[str, Any]) -> Optional[Dict[str, Any]]:
    """
    更新Dramatiq任务

    Args:
        db: 数据库连接
        task_id: 任务ID
        update_data: 更新数据

    Returns:
        更新后的Dramatiq任务，如果不存在则返回None
    """
    # 添加更新时间
    update_data["updated_at"] = datetime.utcnow()

    # 更新任务
    result = await db.dramatiq_tasks.update_one(
        {"_id": ObjectId(task_id)},
        {"$set": update_data}
    )

    if result.modified_count == 0:
        return None

    # 获取更新后的任务
    updated_task = await get_dramatiq_task(db, task_id)
    return updated_task

async def update_dramatiq_task_status(db: Any, task_id: str, status: str) -> bool:
    """
    更新Dramatiq任务状态

    Args:
        db: 数据库连接
        task_id: 任务ID
        status: 新状态

    Returns:
        更新是否成功
    """
    # 更新任务
    result = await db.dramatiq_tasks.update_one(
        {"_id": ObjectId(task_id)},
        {
            "$set": {
                "status": status,
                "updated_at": datetime.utcnow()
            }
        }
    )

    return result.modified_count > 0

async def update_dramatiq_task_result(db: Any, task_id: str, status: str, result: Dict[str, Any]) -> bool:
    """
    更新Dramatiq任务结果

    Args:
        db: 数据库连接
        task_id: 任务ID
        status: 新状态
        result: 结果数据

    Returns:
        更新是否成功
    """
    # 更新任务
    update_result = await db.dramatiq_tasks.update_one(
        {"_id": ObjectId(task_id)},
        {
            "$set": {
                "status": status,
                "result": result,
                "updated_at": datetime.utcnow()
            }
        }
    )

    return update_result.modified_count > 0

async def update_dramatiq_task_error(db: Any, task_id: str, status: str, error: str) -> bool:
    """
    更新Dramatiq任务错误

    Args:
        db: 数据库连接
        task_id: 任务ID
        status: 新状态
        error: 错误信息

    Returns:
        更新是否成功
    """
    # 更新任务
    result = await db.dramatiq_tasks.update_one(
        {"_id": ObjectId(task_id)},
        {
            "$set": {
                "status": status,
                "error": error,
                "updated_at": datetime.utcnow()
            },
            "$inc": {
                "retry_count": 1
            }
        }
    )

    return result.modified_count > 0

async def update_dramatiq_task_message_id(db: Any, task_id: str, message_id: str) -> bool:
    """
    更新Dramatiq任务的消息ID

    Args:
        db: 数据库连接
        task_id: 任务ID
        message_id: 消息ID

    Returns:
        更新是否成功
    """
    # 更新任务
    result = await db.dramatiq_tasks.update_one(
        {"_id": ObjectId(task_id)},
        {
            "$set": {
                "dramatiq_message_id": message_id,
                "updated_at": datetime.utcnow()
            }
        }
    )

    return result.modified_count > 0

async def delete_dramatiq_tasks_by_parent_id(db: Any, parent_task_id: str) -> int:
    """
    删除父任务的所有Dramatiq子任务

    Args:
        db: 数据库连接
        parent_task_id: 父任务ID

    Returns:
        删除的任务数量
    """
    # 删除任务
    result = await db.dramatiq_tasks.delete_many({"parent_task_id": parent_task_id})
    return result.deleted_count
