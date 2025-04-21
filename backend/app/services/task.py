from typing import Dict, Any, List, Optional, Tuple
import logging
import uuid
import random

from app.db.mongodb import get_database
from app.db.redis import get_redis_cache
from app.crud import task as task_crud
from app.crud import dramatiq_task as dramatiq_task_crud
from app.models.task import TaskStatus
from app.models.dramatiq_task import DramatiqTaskStatus
from app.services.task_processor import create_and_submit_subtasks, monitor_task_progress
from app.core.config import settings

# 配置日志
logger = logging.getLogger(__name__)

async def clear_all_task_cache():
    """
    清理Redis中的所有任务缓存
    """
    try:
        redis_cache = get_redis_cache()
        # 清除所有task:开头的键
        deleted_count = await redis_cache.delete_pattern("task:*")
        logger.info(f"清除了 {deleted_count} 个任务缓存键")
        return deleted_count
    except Exception as e:
        logger.error(f"清理任务缓存时出错: {str(e)}")
        return 0

async def create_task(task_data: Dict[str, Any]) -> Dict[str, Any]:
    """
    创建任务

    Args:
        task_data: 任务数据

    Returns:
        创建的任务
    """
    db = await get_database()

    # 创建任务
    task = await task_crud.create_task(db, task_data)

    # 返回创建的任务
    return task

async def get_task(db: Any, task_id: str) -> Optional[Dict[str, Any]]:
    """
    获取任务详情

    Args:
        db: 数据库连接
        task_id: 任务ID

    Returns:
        任务详情，如果不存在则返回None
    """
    task = await task_crud.get_task(db, task_id)

    if task:
        # 无论任务状态如何，都查询子任务状态并计算进度
        # 获取所有子任务
        all_dramatiq_tasks = await dramatiq_task_crud.get_dramatiq_tasks_by_parent_id(db, task_id)

        # 计算进度
        total_tasks = len(all_dramatiq_tasks)
        completed_tasks = sum(1 for dt in all_dramatiq_tasks if dt.get("status") == DramatiqTaskStatus.COMPLETED.value)
        failed_tasks = sum(1 for dt in all_dramatiq_tasks if dt.get("status") == DramatiqTaskStatus.FAILED.value)

        # 添加计算出的进度到任务
        if total_tasks > 0:
            task["processed_images"] = completed_tasks + failed_tasks
            task["progress"] = int((completed_tasks + failed_tasks) / total_tasks * 100)

            # 如果任务未完成，检查是否所有子任务都已完成
            if task.get("status") != TaskStatus.COMPLETED.value and completed_tasks + failed_tasks == total_tasks:
                # 更新任务状态为已完成
                await task_crud.update_task_status(db, task_id, TaskStatus.COMPLETED.value)
                task["status"] = TaskStatus.COMPLETED.value
        else:
            # 如果没有子任务，但任务状态为已完成，则设置进度为100%
            if task.get("status") == TaskStatus.COMPLETED.value:
                task["processed_images"] = task.get("total_images", 0)
                task["progress"] = 100
            else:
                task["processed_images"] = 0
                task["progress"] = 0

        # 如果任务状态为已完成或处理中，获取结果
        if task.get("status") in [TaskStatus.COMPLETED.value, TaskStatus.PROCESSING.value]:
            # 获取已完成的子任务
            all_dramatiq_tasks = await dramatiq_task_crud.get_dramatiq_tasks_by_parent_id(db, task_id)
            completed_dramatiq_tasks = [dt for dt in all_dramatiq_tasks if dt.get("status") == DramatiqTaskStatus.COMPLETED.value]

            # 整理结果
            raw_results = {}
            for dt in completed_dramatiq_tasks:
                if dt.get("result"):
                    # 提取变量索引
                    v0 = dt.get("v0")
                    v1 = dt.get("v1")
                    v2 = dt.get("v2")
                    v3 = dt.get("v3")
                    v4 = dt.get("v4")
                    v5 = dt.get("v5")

                    # 构建组合键
                    combination_key = dt.get("combination_key", f"v0_{v0}:v1_{v1}")
                    raw_results[combination_key] = dt.get("result")

                    # 将变量索引添加到结果中
                    raw_results[combination_key]["v0"] = v0
                    raw_results[combination_key]["v1"] = v1
                    raw_results[combination_key]["v2"] = v2
                    raw_results[combination_key]["v3"] = v3
                    raw_results[combination_key]["v4"] = v4
                    raw_results[combination_key]["v5"] = v5

            # 转换结果格式为前端期望的格式
            if raw_results:
                # 获取任务变量
                variables = task.get("variables", {})

                # 创建矩阵结果结构
                matrix_results = {}

                # 遍历所有变量
                for var_name, var_data in variables.items():
                    if var_name.startswith('v') and var_data.get("values"):
                        # 创建变量索引映射
                        var_index = int(var_name[1:])
                        var_values = var_data.get("values", [])

                        # 初始化变量结果
                        matrix_results[var_name] = {}

                        # 遍历所有结果
                        for combination_key, result in raw_results.items():
                            # 获取当前变量的索引
                            current_var_index = result.get(var_name)

                            # 如果有效索引
                            if current_var_index is not None and current_var_index < len(var_values):
                                # 获取变量值
                                var_value = var_values[current_var_index].get("value", "")

                                # 将结果添加到矩阵中
                                if var_value not in matrix_results[var_name]:
                                    matrix_results[var_name][var_value] = result.get("url", "")

                # 添加结果到任务
                task["results"] = {
                    "matrix": matrix_results,
                    "raw": raw_results
                }

    return task

async def list_tasks(
    username: Optional[str] = None,
    status: Optional[str] = None,
    task_name: Optional[str] = None,
    page: int = 1,
    page_size: int = 10
) -> Dict[str, Any]:
    """
    获取任务列表

    Args:
        username: 用户名过滤
        status: 状态过滤
        task_name: 任务名称搜索
        page: 页码
        page_size: 每页大小

    Returns:
        任务列表和分页信息
    """
    # 记录查询参数
    logger.info(f"获取任务列表: username={username}, status={status}, task_name={task_name}, page={page}, page_size={page_size}")

    db = await get_database()

    # 查询最新的任务列表
    result = await task_crud.list_tasks(db, username, status, task_name, page, page_size)

    # 记录查询结果
    logger.info(f"任务列表查询结果: 总数={result.get('total', 0)}, 项目数={len(result.get('items', []))}")

    # 对每个任务计算进度
    for task in result.get("items", []):
        # 确保必要字段存在
        if "priority" not in task:
            task["priority"] = 1
        if "total_images" not in task:
            task["total_images"] = 0
        if "processed_images" not in task:
            task["processed_images"] = 0
        if "progress" not in task:
            task["progress"] = 0

        # 获取任务状态
        task_status = task.get("status")
        task_id = task.get("id")

        # 如果任务状态为已完成/失败/取消，则不需要重新计算进度
        if task_status in [TaskStatus.COMPLETED.value, TaskStatus.FAILED.value, TaskStatus.CANCELLED.value]:
            # 如果是已完成状态，确保进度为100%
            if task_status == TaskStatus.COMPLETED.value:
                task["processed_images"] = task.get("total_images", 0)
                task["progress"] = 100
            continue

        # 只对未完成的任务计算进度
        if task_id:
            # 获取子任务
            all_dramatiq_tasks = await dramatiq_task_crud.get_dramatiq_tasks_by_parent_id(db, task_id)

            # 计算进度
            total_tasks = len(all_dramatiq_tasks)
            completed_tasks = sum(1 for dt in all_dramatiq_tasks if dt.get("status") == DramatiqTaskStatus.COMPLETED.value)
            failed_tasks = sum(1 for dt in all_dramatiq_tasks if dt.get("status") == DramatiqTaskStatus.FAILED.value)

            # 记录子任务状态
            logger.debug(f"任务 {task_id} 的子任务状态: 总数={total_tasks}, 已完成={completed_tasks}, 失败={failed_tasks}")

            # 添加计算出的进度到任务
            if total_tasks > 0:
                task["processed_images"] = completed_tasks + failed_tasks
                task["progress"] = int((completed_tasks + failed_tasks) / total_tasks * 100)

                # 如果任务未完成，检查是否所有子任务都已完成
                if completed_tasks + failed_tasks == total_tasks:
                    # 更新任务状态为已完成
                    await task_crud.update_task_status(db, task_id, TaskStatus.COMPLETED.value)
                    task["status"] = TaskStatus.COMPLETED.value
                    logger.info(f"任务 {task_id} 已完成，更新状态")
            else:
                # 如果没有子任务，设置进度为0
                task["processed_images"] = 0
                task["progress"] = 0

        # 记录任务字段
        logger.debug(f"任务 {task_id} 的字段: {list(task.keys())}")

        # 如果任务状态为已完成或处理中，且有完成的子任务，获取结果
        if task_id and task.get("status") in [TaskStatus.COMPLETED.value, TaskStatus.PROCESSING.value] and task.get("processed_images", 0) > 0:
            # 获取子任务（如果还没有获取过）
            if not locals().get('all_dramatiq_tasks'):
                all_dramatiq_tasks = await dramatiq_task_crud.get_dramatiq_tasks_by_parent_id(db, task_id)

            # 获取已完成的子任务
            completed_dramatiq_tasks = [dt for dt in all_dramatiq_tasks if dt.get("status") == DramatiqTaskStatus.COMPLETED.value]

            # 整理结果
            raw_results = {}
            for dt in completed_dramatiq_tasks:
                if dt.get("result"):
                    # 提取变量索引
                    v0 = dt.get("v0")
                    v1 = dt.get("v1")
                    v2 = dt.get("v2")
                    v3 = dt.get("v3")
                    v4 = dt.get("v4")
                    v5 = dt.get("v5")

                    # 构建组合键
                    combination_key = dt.get("combination_key", f"v0_{v0}:v1_{v1}")
                    raw_results[combination_key] = dt.get("result")

                    # 将变量索引添加到结果中
                    raw_results[combination_key]["v0"] = v0
                    raw_results[combination_key]["v1"] = v1
                    raw_results[combination_key]["v2"] = v2
                    raw_results[combination_key]["v3"] = v3
                    raw_results[combination_key]["v4"] = v4
                    raw_results[combination_key]["v5"] = v5

            # 转换结果格式为前端期望的格式
            if raw_results:
                # 获取任务变量
                task_detail = await get_task(db, task_id)
                variables = task_detail.get("variables", {})

                # 创建矩阵结果结构
                matrix_results = {}

                # 遍历所有变量
                for var_name, var_data in variables.items():
                    if var_name.startswith('v') and var_data.get("values"):
                        # 创建变量索引映射
                        var_values = var_data.get("values", [])

                        # 初始化变量结果
                        matrix_results[var_name] = {}

                        # 遍历所有结果
                        for combination_key, result in raw_results.items():
                            # 获取当前变量的索引
                            current_var_index = result.get(var_name)

                            # 如果有效索引
                            if current_var_index is not None and current_var_index < len(var_values):
                                # 获取变量值
                                var_value = var_values[current_var_index].get("value", "")

                                # 将结果添加到矩阵中
                                if var_value not in matrix_results[var_name]:
                                    matrix_results[var_name][var_value] = result.get("url", "")

                # 添加结果到任务
                task["results"] = {
                    "matrix": matrix_results,
                    "raw": raw_results
                }

    return result

async def cancel_task(task_id: str) -> bool:
    """
    取消任务

    Args:
        task_id: 任务ID

    Returns:
        取消是否成功
    """
    db = await get_database()
    return await task_crud.cancel_task(db, task_id)

async def delete_task(task_id: str) -> bool:
    """
    删除任务

    Args:
        task_id: 任务ID

    Returns:
        删除是否成功
    """
    db = await get_database()
    return await task_crud.delete_task(db, task_id)

async def prepare_dramatiq_tasks(task_id: str) -> Dict[str, Any]:
    """
    准备任务

    Args:
        task_id: 任务ID

    Returns:
        准备结果
    """
    try:
        logger.info(f"开始准备任务 {task_id} 的子任务")
        db = await get_database()

        # 获取任务
        task_data = await task_crud.get_task(db, task_id)
        if not task_data:
            logger.error(f"找不到任务 {task_id}")
            return {"status": "failed", "error": f"找不到任务 {task_id}"}

        # 计算变量组合
        logger.info(f"开始计算任务 {task_id} 的变量组合")
        combinations = await calculate_combinations(task_id, task_data)
        logger.info(f"任务 {task_id} 共有 {len(combinations)} 个变量组合")

        # 更新任务状态为处理中
        await task_crud.update_task_status(db, task_id, TaskStatus.PROCESSING.value)

        # 使用新的任务处理器创建和提交子任务
        # 将计算好的变量组合传递给create_and_submit_subtasks函数
        result = await create_and_submit_subtasks(task_id, combinations)

        if result.get("status") == "success":
            logger.info(f"任务 {task_id} 已成功创建子任务: {result.get('message')}")
            return result
        else:
            logger.error(f"创建子任务失败: {result.get('error')}")
            await task_crud.update_task_status(db, task_id, TaskStatus.FAILED.value, result.get('error'))
            return result

    except Exception as e:
        logger.error(f"准备任务时出错: {str(e)}")
        try:
            db = await get_database()
            await task_crud.update_task_status(db, task_id, TaskStatus.FAILED.value, str(e))
        except Exception as update_error:
            logger.error(f"更新任务状态时出错: {str(update_error)}")
        return {"status": "failed", "error": str(e)}

async def calculate_combinations(
    task_id: str,
    task_data: Dict[str, Any]
) -> List[Dict[str, Dict[str, str]]]:
    """
    计算所有变量组合

    Args:
        task_id: 任务ID
        task_data: 任务数据

    Returns:
        变量组合列表
    """
    db = await get_database()

    # 获取变量
    variables = task_data.get("variables", {})

    # 记录变量结构
    logger.debug(f"任务 {task_id} 的变量结构: {variables}")

    # 手动计算组合数量
    manual_count = 1
    for var_key, var_data in variables.items():
        if var_key.startswith('v'):
            # 优先使用values_count字段
            values_count = var_data.get('values_count')
            if values_count is None and var_data.get('values'):
                values_count = len(var_data.get('values'))

            if values_count and values_count > 0:
                manual_count *= values_count

    logger.info(f"手动计算的组合数量: {manual_count}")

    # 计算组合
    # 在这里我们需要实现一个简单的组合计算逻辑
    import itertools

    # 准备变量值列表
    var_values = []
    var_names = []

    for var_name, var_data in sorted(variables.items()):
        if var_name.startswith('v'):
            values = var_data.get('values', [])
            if values:
                var_names.append(var_name)
                var_values.append(values)

    # 计算笛卡尔积
    combinations = []
    if var_values:
        for values in itertools.product(*var_values):
            combination = {}
            for i, var_name in enumerate(var_names):
                # 保留变量值的完整信息，包括value、uuid等
                combination[var_name] = values[i]
            combinations.append(combination)
    else:
        # 如果没有变量，返回一个空组合
        combinations = [{}]

    # 记录组合详情
    logger.debug(f"计算出的组合详情: {combinations}")

    # 更新任务的图片总数
    total_images = len(combinations)
    logger.info(f"计算出的组合数量: {total_images}")

    # 如果计算出的组合数量与手动计算的不一致，使用手动计算的结果
    if total_images != manual_count and manual_count > 0:
        logger.warning(f"计算出的组合数量 ({total_images}) 与手动计算的 ({manual_count}) 不一致，使用手动计算的结果")

        # 如果组合为空或数量不正确，创建正确数量的组合
        if not combinations or len(combinations) != manual_count:
            logger.warning(f"组合数量不正确，创建 {manual_count} 个组合")

            # 如果有现有组合，使用第一个作为模板
            template_combination = combinations[0] if combinations else {}

            # 创建新的组合列表
            new_combinations = []
            for i in range(manual_count):
                if i < len(combinations):
                    new_combinations.append(combinations[i])
                else:
                    # 复制模板并修改ID以避免重复
                    new_combination = template_combination.copy()
                    for var_name in new_combination:
                        if isinstance(new_combination[var_name], dict):
                            new_dict = new_combination[var_name].copy()
                            if 'variable_id' in new_dict:
                                new_dict['variable_id'] = f"{new_dict['variable_id']}_{i}"
                            new_combination[var_name] = new_dict
                    new_combinations.append(new_combination)

            combinations = new_combinations

    # 记录组合详情
    for i, combination in enumerate(combinations):
        logger.debug(f"组合 {i+1}: {combination}")

    # 更新任务的图片总数
    await task_crud.update_task_total_images(db, task_id, total_images)

    return combinations

async def extract_parameters(
    tags: List[Dict[str, Any]],
    combination: Dict[str, Dict[str, Any]]
) -> Tuple[List[str], str, Optional[int], bool]:
    """
    从标签和组合中提取参数

    Args:
        tags: 标签列表
        combination: 变量组合

    Returns:
        提示词、比例、种子和是否使用润色
    """
    try:
        # 记录输入参数
        logger.debug(f"提取参数输入: tags={tags}, combination={combination}")

        # 初始化参数
        prompts = []
        ratio = "1:1"  # 默认比例
        seed = random.randint(1, 2147483647)  # 默认随机种子
        use_polish = False  # 默认不使用润色

        # 创建标签ID到标签类型的映射
        tag_id_to_type = {}
        for tag in tags:
            if tag.get("id") and tag.get("type"):
                tag_id_to_type[tag.get("id")] = tag.get("type")

        # 从组合中提取变量值
        for var_key, var_data in combination.items():
            if var_key.startswith('v') and isinstance(var_data, dict):
                # 获取变量值和标签ID
                var_value = var_data.get("value", "")
                var_tag_id = var_data.get("tag_id", "")

                # 如果没有值或标签ID，跳过
                if not var_value or not var_tag_id:
                    continue

                # 获取标签类型
                var_type = tag_id_to_type.get(var_tag_id)

                # 根据标签类型处理变量值
                if var_type == "prompt":
                    # 提示词变量
                    prompts.append(var_value)
                elif var_type == "ratio":
                    # 比例变量
                    ratio = var_value
                elif var_type == "seed":
                    # 种子变量
                    try:
                        seed = int(var_value)
                    except (ValueError, TypeError):
                        pass
                elif var_type == "polish":
                    # 润色变量
                    use_polish = var_value.lower() == "true"
                elif var_type == "character":
                    # 角色变量 - 不在这里处理，在create_and_submit_subtasks中处理
                    pass
                elif var_type == "element":
                    # 元素变量 - 不在这里处理，在create_and_submit_subtasks中处理
                    pass

        # 处理非变量标签
        for tag in tags:
            tag_type = tag.get("type")
            is_variable = tag.get("is_variable", False)

            # 只处理非变量标签
            if is_variable:
                continue

            if tag_type == "prompt":
                # 提示词标签
                tag_value = tag.get("value", "")
                if tag_value:
                    prompts.append(tag_value)
            elif tag_type == "ratio" and ratio == "1:1":  # 只有当没有变量覆盖时才使用
                # 比例标签
                ratio = tag.get("value", "1:1")
            elif tag_type == "seed" and seed == random.randint(1, 2147483647):  # 只有当没有变量覆盖时才使用
                # 种子标签
                try:
                    seed_value = tag.get("value")
                    if seed_value:
                        seed = int(seed_value)
                except (ValueError, TypeError):
                    pass
            elif tag_type == "polish" and not use_polish:  # 只有当没有变量覆盖时才使用
                # 润色标签
                use_polish = tag.get("value", "false").lower() == "true"

        result = (prompts, ratio, seed, use_polish)

        # 记录提取结果
        logger.debug(f"提取参数结果: {result}")

        return result
    except Exception as e:
        logger.error(f"提取参数时出错: {str(e)}")
        # 返回默认值
        return [], "1:1", random.randint(1, 2147483647), False