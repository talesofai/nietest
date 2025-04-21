"""
任务执行器启动脚本

该脚本用于启动任务执行器，替代Dramatiq Worker
"""
import os
import sys
import logging
import argparse
import asyncio
import time
from datetime import datetime

# 添加项目根目录到Python路径
sys.path.insert(0, os.path.abspath(os.path.dirname(os.path.dirname(__file__))))

from app.core.config import settings
from app.services.task_executor import get_task_executor, start_auto_scaling, get_executor_stats

# 配置日志
os.makedirs(os.path.join(os.path.dirname(os.path.dirname(__file__)), "logs"), exist_ok=True)
log_file = os.path.join(os.path.dirname(os.path.dirname(__file__)), "logs", f"task_executor_{datetime.now().strftime('%Y%m%d')}.log")

# 配置日志处理器
file_handler = logging.FileHandler(log_file, encoding='utf-8')
# 设置文件处理器为无缓冲模式
file_handler.setLevel(logging.DEBUG)  # 确保所有日志都被记录

stream_handler = logging.StreamHandler(sys.stdout)  # 明确指定输出到stdout

# 设置格式化器
formatter = logging.Formatter('%(asctime)s - %(name)s - %(levelname)s - %(message)s')
file_handler.setFormatter(formatter)
stream_handler.setFormatter(formatter)

# 配置根日志器
logging.basicConfig(
    level=getattr(logging, settings.LOG_LEVEL),
    handlers=[stream_handler, file_handler]
)

# 设置特定模块的日志级别
logging.getLogger('app').setLevel(logging.DEBUG)  # 设置app根日志器为DEBUG
logging.getLogger('app.services').setLevel(logging.DEBUG)
logging.getLogger('app.services.task_executor').setLevel(logging.DEBUG)
logging.getLogger('app.services.task_processor').setLevel(logging.DEBUG)
logging.getLogger('app.services.image').setLevel(logging.DEBUG)

# 确保日志立即刷新
for handler in logging.getLogger().handlers:
    handler.flush()

# 禁用不必要的日志输出
logging.getLogger('apscheduler').setLevel(logging.WARNING)
logging.getLogger('pymongo').setLevel(logging.WARNING)
logging.getLogger('asyncio').setLevel(logging.WARNING)

logger = logging.getLogger("task_executor")

async def log_executor_stats():
    """记录任务执行器统计信息"""
    while True:
        try:
            # 获取任务执行器统计信息
            stats = await get_executor_stats()

            # 计算下次可扩容时间
            from app.services.task_executor import get_auto_scaling_manager
            auto_scaling_manager = get_auto_scaling_manager()
            next_scale_up_time = 0
            if hasattr(auto_scaling_manager, 'last_scale_up_time') and auto_scaling_manager.last_scale_up_time > 0:
                next_scale_up_time = auto_scaling_manager.last_scale_up_time + auto_scaling_manager.scale_up_interval - time.time()
                if next_scale_up_time < 0:
                    next_scale_up_time = 0

            # 直接打印状态信息，不包含日志前缀
            status_msg = (
                f"任务执行器状态: 运行中任务={stats['running_tasks']}, "
                f"已完成任务={stats['completed_tasks']}, "
                f"最大并发任务数={stats['max_concurrent_tasks']}, "
                f"可用槽位={stats['available_slots']}, "
                f"下次可扩容时间={next_scale_up_time:.1f}秒\n"
            )
            sys.stdout.write(status_msg)
            sys.stdout.flush()  # 确保立即输出
        except Exception as e:
            logger.error(f"记录任务执行器统计信息失败: {str(e)}")

        # 每5秒记录一次
        await asyncio.sleep(5)

async def main(args):
    """主函数"""
    logger.info("启动任务执行器")

    # 启动任务执行器和自动扩容
    await start_auto_scaling(
        min_concurrent_tasks=args.min_concurrent_tasks,
        max_concurrent_tasks=args.max_concurrent_tasks,
        scale_up_step=args.scale_up_step,
        scale_up_interval=args.scale_up_interval,
        scale_down_interval=args.scale_down_interval
    )

    # 启动统计信息记录
    stats_task = asyncio.create_task(log_executor_stats())

    try:
        # 保持主线程运行
        while True:
            await asyncio.sleep(1)
    except KeyboardInterrupt:
        logger.info("收到中断信号，正在关闭任务执行器...")
        # 取消统计信息记录任务
        stats_task.cancel()
        try:
            await stats_task
        except asyncio.CancelledError:
            pass

        # 关闭任务执行器
        executor = get_task_executor()
        await executor.stop()
        logger.info("任务执行器已关闭")

if __name__ == "__main__":
    # 解析命令行参数
    parser = argparse.ArgumentParser(description="任务执行器启动脚本")
    parser.add_argument("--min-concurrent-tasks", type=int, default=5, help="最小并发任务数")
    parser.add_argument("--max-concurrent-tasks", type=int, default=50, help="最大并发任务数")
    parser.add_argument("--scale-up-step", type=int, default=5, help="每次扩容增加的并发任务数")
    parser.add_argument("--scale-up-interval", type=int, default=120, help="扩容间隔（秒），默认两分钟")
    parser.add_argument("--scale-down-interval", type=int, default=300, help="缩容间隔（秒）")

    args = parser.parse_args()

    # 运行主函数
    asyncio.run(main(args))
