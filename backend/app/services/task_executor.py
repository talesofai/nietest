"""
任务执行器模块 - 替代Dramatiq的异步任务执行系统
"""
import asyncio
import logging
import time
import uuid
from typing import Dict, Any, List, Callable, Coroutine, Optional
from datetime import datetime, timezone

logger = logging.getLogger(__name__)

class TaskExecutor:
    """任务执行器，管理异步任务的执行"""

    def __init__(self, max_concurrent_tasks: int = 5):
        """
        初始化任务执行器

        Args:
            max_concurrent_tasks: 最大并发任务数
        """
        self.max_concurrent_tasks = max_concurrent_tasks
        self.semaphore = asyncio.Semaphore(max_concurrent_tasks)
        self.running_tasks: Dict[str, asyncio.Task] = {}
        self.task_results: Dict[str, Any] = {}
        self._is_running = False
        self._monitor_task = None

    async def start(self):
        """启动任务执行器"""
        if self._is_running:
            return

        self._is_running = True
        self._monitor_task = asyncio.create_task(self._monitor_tasks())
        logger.info(f"任务执行器已启动，最大并发任务数: {self.max_concurrent_tasks}")

    async def stop(self):
        """停止任务执行器"""
        if not self._is_running:
            return

        self._is_running = False
        if self._monitor_task:
            self._monitor_task.cancel()
            try:
                await self._monitor_task
            except asyncio.CancelledError:
                pass

        # 取消所有运行中的任务
        for task_id, task in list(self.running_tasks.items()):
            if not task.done():
                task.cancel()
                try:
                    await task
                except asyncio.CancelledError:
                    logger.info(f"任务 {task_id} 已取消")
                except Exception as e:
                    logger.error(f"取消任务 {task_id} 时出错: {str(e)}")

        logger.info("任务执行器已停止")

    async def submit_task(self, coro: Coroutine, task_id: Optional[str] = None) -> str:
        """
        提交一个任务

        Args:
            coro: 要执行的协程
            task_id: 任务ID，如果不提供则自动生成

        Returns:
            任务ID
        """
        if not self._is_running:
            await self.start()

        if task_id is None:
            task_id = str(uuid.uuid4())

        # 创建一个包装任务，使用信号量控制并发
        wrapped_task = asyncio.create_task(self._execute_task(coro, task_id))
        self.running_tasks[task_id] = wrapped_task

        logger.info(f"任务 {task_id} 已提交，当前运行任务数: {len(self.running_tasks)}")
        return task_id

    async def _execute_task(self, coro: Coroutine, task_id: str) -> Any:
        """
        执行任务并管理结果

        Args:
            coro: 要执行的协程
            task_id: 任务ID

        Returns:
            任务执行结果
        """
        start_time = time.time()
        logger.info(f"任务 {task_id} 等待执行，当前信号量: {self.semaphore._value}")

        try:
            async with self.semaphore:
                logger.info(f"任务 {task_id} 开始执行")
                result = await coro
                elapsed_time = time.time() - start_time
                logger.info(f"任务 {task_id} 执行完成，耗时: {elapsed_time:.2f}秒")
                self.task_results[task_id] = {
                    "status": "completed",
                    "result": result,
                    "completed_at": datetime.now(timezone.utc),
                    "elapsed_time": elapsed_time
                }
                return result
        except asyncio.CancelledError:
            elapsed_time = time.time() - start_time
            logger.warning(f"任务 {task_id} 被取消，已运行: {elapsed_time:.2f}秒")
            self.task_results[task_id] = {
                "status": "cancelled",
                "error": "任务被取消",
                "completed_at": datetime.now(timezone.utc),
                "elapsed_time": elapsed_time
            }
            raise
        except Exception as e:
            elapsed_time = time.time() - start_time
            logger.error(f"任务 {task_id} 执行失败: {str(e)}")
            import traceback
            logger.error(f"任务 {task_id} 异常堆栈:\n{traceback.format_exc()}")
            self.task_results[task_id] = {
                "status": "failed",
                "error": str(e),
                "traceback": traceback.format_exc(),
                "completed_at": datetime.now(timezone.utc),
                "elapsed_time": elapsed_time
            }
            raise
        finally:
            # 从运行任务列表中移除
            if task_id in self.running_tasks:
                del self.running_tasks[task_id]

    async def get_task_result(self, task_id: str, wait: bool = False, timeout: Optional[float] = None) -> Dict[str, Any]:
        """
        获取任务结果

        Args:
            task_id: 任务ID
            wait: 是否等待任务完成
            timeout: 等待超时时间（秒）

        Returns:
            任务结果
        """
        if task_id in self.task_results:
            return self.task_results[task_id]

        if task_id not in self.running_tasks:
            return {"status": "not_found", "error": f"任务 {task_id} 不存在"}

        if not wait:
            return {"status": "running"}

        try:
            task = self.running_tasks[task_id]
            await asyncio.wait_for(task, timeout=timeout)
            return self.task_results.get(task_id, {"status": "unknown"})
        except asyncio.TimeoutError:
            return {"status": "timeout", "error": f"等待任务 {task_id} 超时"}
        except Exception as e:
            return {"status": "error", "error": f"获取任务 {task_id} 结果时出错: {str(e)}"}

    async def cancel_task(self, task_id: str) -> Dict[str, Any]:
        """
        取消任务

        Args:
            task_id: 任务ID

        Returns:
            取消结果
        """
        if task_id not in self.running_tasks:
            return {"status": "not_found", "error": f"任务 {task_id} 不存在或已完成"}

        task = self.running_tasks[task_id]
        if task.done():
            return {"status": "already_done"}

        task.cancel()
        try:
            await task
        except asyncio.CancelledError:
            return {"status": "cancelled", "message": f"任务 {task_id} 已取消"}
        except Exception as e:
            return {"status": "error", "error": f"取消任务 {task_id} 时出错: {str(e)}"}

    async def _monitor_tasks(self):
        """监控任务执行情况"""
        while self._is_running:
            try:
                running_count = len(self.running_tasks)
                completed_count = len(self.task_results)
                logger.debug(f"任务监控: 运行中任务数={running_count}, 已完成任务数={completed_count}, 信号量={self.semaphore._value}")

                # 清理过期的任务结果（可选）
                # 这里可以添加清理逻辑，例如删除完成超过一定时间的任务结果

                await asyncio.sleep(10)  # 每10秒监控一次
            except asyncio.CancelledError:
                break
            except Exception as e:
                logger.error(f"任务监控出错: {str(e)}")
                await asyncio.sleep(10)  # 出错后等待一段时间再继续

    def set_max_concurrent_tasks(self, max_concurrent_tasks: int):
        """
        设置最大并发任务数

        Args:
            max_concurrent_tasks: 新的最大并发任务数
        """
        if max_concurrent_tasks <= 0:
            raise ValueError("最大并发任务数必须大于0")

        # 创建新的信号量
        old_value = self.semaphore._value
        self.max_concurrent_tasks = max_concurrent_tasks
        new_semaphore = asyncio.Semaphore(max_concurrent_tasks)

        # 如果新的并发数更大，释放额外的信号量
        if max_concurrent_tasks > old_value:
            for _ in range(max_concurrent_tasks - old_value):
                if self.semaphore._value < old_value:
                    self.semaphore.release()

        self.semaphore = new_semaphore
        logger.info(f"最大并发任务数已更新为: {max_concurrent_tasks}")

    def get_stats(self) -> Dict[str, Any]:
        """
        获取任务执行器统计信息

        Returns:
            统计信息
        """
        return {
            "running_tasks": len(self.running_tasks),
            "completed_tasks": len(self.task_results),
            "max_concurrent_tasks": self.max_concurrent_tasks,
            "available_slots": self.semaphore._value,
            "is_running": self._is_running
        }

# 全局任务执行器实例
_task_executor = None

def get_task_executor() -> TaskExecutor:
    """
    获取全局任务执行器实例

    Returns:
        任务执行器实例
    """
    global _task_executor
    if _task_executor is None:
        # 默认最大并发任务数为5
        _task_executor = TaskExecutor(max_concurrent_tasks=5)
    return _task_executor

async def submit_task(coro: Coroutine, task_id: Optional[str] = None) -> str:
    """
    提交任务的便捷函数

    Args:
        coro: 要执行的协程
        task_id: 任务ID，如果不提供则自动生成

    Returns:
        任务ID
    """
    executor = get_task_executor()
    return await executor.submit_task(coro, task_id)

async def get_task_result(task_id: str, wait: bool = False, timeout: Optional[float] = None) -> Dict[str, Any]:
    """
    获取任务结果的便捷函数

    Args:
        task_id: 任务ID
        wait: 是否等待任务完成
        timeout: 等待超时时间（秒）

    Returns:
        任务结果
    """
    executor = get_task_executor()
    return await executor.get_task_result(task_id, wait, timeout)

async def cancel_task(task_id: str) -> Dict[str, Any]:
    """
    取消任务的便捷函数

    Args:
        task_id: 任务ID

    Returns:
        取消结果
    """
    executor = get_task_executor()
    return await executor.cancel_task(task_id)

async def set_max_concurrent_tasks(max_concurrent_tasks: int):
    """
    设置最大并发任务数的便捷函数

    Args:
        max_concurrent_tasks: 新的最大并发任务数
    """
    executor = get_task_executor()
    executor.set_max_concurrent_tasks(max_concurrent_tasks)

async def get_executor_stats() -> Dict[str, Any]:
    """
    获取任务执行器统计信息的便捷函数

    Returns:
        统计信息
    """
    executor = get_task_executor()
    return executor.get_stats()

# 自动扩容管理器
class AutoScalingManager:
    """自动扩容管理器，根据任务队列长度自动调整并发任务数"""

    def __init__(self,
                 min_concurrent_tasks: int = 5,
                 max_concurrent_tasks: int = 50,
                 scale_up_step: int = 5,
                 scale_up_interval: int = 120,  # 秒，默认两分钟
                 scale_down_interval: int = 300):  # 秒
        """
        初始化自动扩容管理器

        Args:
            min_concurrent_tasks: 最小并发任务数
            max_concurrent_tasks: 最大并发任务数
            scale_up_step: 每次扩容增加的并发任务数
            scale_up_interval: 扩容间隔（秒）
            scale_down_interval: 缩容间隔（秒）
        """
        self.min_concurrent_tasks = min_concurrent_tasks
        self.max_concurrent_tasks = max_concurrent_tasks
        self.scale_up_step = scale_up_step
        self.scale_up_interval = scale_up_interval
        self.scale_down_interval = scale_down_interval

        self.last_scale_up_time = 0
        self.last_scale_down_time = 0
        self._is_running = False
        self._monitor_task = None

    async def start(self):
        """启动自动扩容管理器"""
        if self._is_running:
            return

        self._is_running = True
        self._monitor_task = asyncio.create_task(self._monitor_load())
        logger.info(f"自动扩容管理器已启动，最小并发任务数: {self.min_concurrent_tasks}, 最大并发任务数: {self.max_concurrent_tasks}")

    async def stop(self):
        """停止自动扩容管理器"""
        if not self._is_running:
            return

        self._is_running = False
        if self._monitor_task:
            self._monitor_task.cancel()
            try:
                await self._monitor_task
            except asyncio.CancelledError:
                pass

        logger.info("自动扩容管理器已停止")

    async def _monitor_load(self):
        """监控负载并自动调整并发任务数"""
        executor = get_task_executor()

        # 确保初始并发任务数不低于最小值
        if executor.max_concurrent_tasks < self.min_concurrent_tasks:
            executor.set_max_concurrent_tasks(self.min_concurrent_tasks)

        while self._is_running:
            try:
                stats = executor.get_stats()
                running_tasks = stats["running_tasks"]
                max_concurrent = stats["max_concurrent_tasks"]
                available_slots = stats["available_slots"]

                current_time = time.time()

                # 判断是否需要扩容
                # 只有当运行中的任务数量大于并发任务数的两倍时才扩容
                if running_tasks >= max_concurrent * 2 and max_concurrent < self.max_concurrent_tasks:
                    # 检查是否可以扩容（时间间隔）
                    if current_time - self.last_scale_up_time >= self.scale_up_interval:
                        new_concurrent = min(max_concurrent + self.scale_up_step, self.max_concurrent_tasks)
                        logger.info(f"自动扩容: {max_concurrent} -> {new_concurrent} 并发任务, 当前运行任务数: {running_tasks}")
                        executor.set_max_concurrent_tasks(new_concurrent)
                        self.last_scale_up_time = current_time
                        logger.info(f"扩容后将在 {self.scale_up_interval} 秒内不再扩容")

                # 判断是否需要缩容
                elif running_tasks < max_concurrent // 2 and max_concurrent > self.min_concurrent_tasks:
                    # 检查是否可以缩容（时间间隔）
                    if current_time - self.last_scale_down_time >= self.scale_down_interval:
                        new_concurrent = max(max_concurrent - self.scale_up_step, self.min_concurrent_tasks)
                        logger.info(f"自动缩容: {max_concurrent} -> {new_concurrent} 并发任务")
                        executor.set_max_concurrent_tasks(new_concurrent)
                        self.last_scale_down_time = current_time

                await asyncio.sleep(10)  # 每10秒检查一次
            except asyncio.CancelledError:
                break
            except Exception as e:
                logger.error(f"自动扩容管理出错: {str(e)}")
                await asyncio.sleep(10)  # 出错后等待一段时间再继续

# 全局自动扩容管理器实例
_auto_scaling_manager = None

def get_auto_scaling_manager() -> AutoScalingManager:
    """
    获取全局自动扩容管理器实例

    Returns:
        自动扩容管理器实例
    """
    global _auto_scaling_manager
    if _auto_scaling_manager is None:
        _auto_scaling_manager = AutoScalingManager()
    return _auto_scaling_manager

async def start_auto_scaling(
    min_concurrent_tasks: int = 5,
    max_concurrent_tasks: int = 50,
    scale_up_step: int = 5,
    scale_up_interval: int = 60,
    scale_down_interval: int = 300
):
    """
    启动自动扩容的便捷函数

    Args:
        min_concurrent_tasks: 最小并发任务数
        max_concurrent_tasks: 最大并发任务数
        scale_up_step: 每次扩容增加的并发任务数
        scale_up_interval: 扩容间隔（秒）
        scale_down_interval: 缩容间隔（秒）
    """
    global _auto_scaling_manager
    if _auto_scaling_manager is None:
        _auto_scaling_manager = AutoScalingManager(
            min_concurrent_tasks=min_concurrent_tasks,
            max_concurrent_tasks=max_concurrent_tasks,
            scale_up_step=scale_up_step,
            scale_up_interval=scale_up_interval,
            scale_down_interval=scale_down_interval
        )
    await _auto_scaling_manager.start()

async def stop_auto_scaling():
    """停止自动扩容的便捷函数"""
    if _auto_scaling_manager is not None:
        await _auto_scaling_manager.stop()
