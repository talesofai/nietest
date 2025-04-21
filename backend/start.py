"""
应用启动脚本

该脚本用于启动FastAPI应用和任务执行器
"""
import os
import sys
import logging
import argparse
import asyncio
import subprocess
import signal
import time

# 配置日志
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[
        logging.StreamHandler(sys.stdout)
    ]
)

logger = logging.getLogger("start")

# 全局变量跟踪子进程
processes = {}

def start_fastapi():
    """启动FastAPI应用"""
    logger.info("启动FastAPI应用")

    # 构建启动命令
    cmd = [
        sys.executable,
        "-m",
        "uvicorn",
        "app.main:app",
        "--host", "0.0.0.0",
        "--port", "8000",
        "--reload"
    ]

    # 启动进程
    process = subprocess.Popen(
        cmd,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        cwd=os.path.dirname(os.path.abspath(__file__)),
        env=os.environ.copy()
    )

    # 记录进程
    processes["fastapi"] = process
    logger.info(f"FastAPI应用已启动，PID={process.pid}")

    return process

def start_task_executor(args):
    """启动任务执行器"""
    logger.info("启动任务执行器")

    # 构建启动命令
    cmd = [
        sys.executable,
        "-m",
        "scripts.task_executor",
        "--min-concurrent-tasks", str(args.min_concurrent_tasks),
        "--max-concurrent-tasks", str(args.max_concurrent_tasks),
        "--scale-up-step", str(args.scale_up_step),
        "--scale-up-interval", str(args.scale_up_interval),
        "--scale-down-interval", str(args.scale_down_interval)
    ]

    # 启动进程
    process = subprocess.Popen(
        cmd,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        cwd=os.path.dirname(os.path.abspath(__file__)),
        env=os.environ.copy()
    )

    # 记录进程
    processes["task_executor"] = process
    logger.info(f"任务执行器已启动，PID={process.pid}")

    return process

def cleanup():
    """清理所有子进程"""
    logger.info("清理子进程")

    for name, process in processes.items():
        try:
            if process.poll() is None:  # 如果进程还在运行
                logger.info(f"停止{name}进程，PID={process.pid}")
                process.terminate()

                # 等待进程结束，最多等待5秒
                try:
                    process.wait(timeout=5)
                except subprocess.TimeoutExpired:
                    # 如果超时，强制终止
                    logger.warning(f"{name}进程未能正常终止，强制终止")
                    process.kill()
        except Exception as e:
            logger.error(f"停止{name}进程时出错: {str(e)}")

def signal_handler(sig, frame):
    """信号处理函数"""
    logger.info(f"收到信号{sig}，开始清理")
    cleanup()
    sys.exit(0)

def main(args):
    """主函数"""
    # 注册信号处理函数
    signal.signal(signal.SIGINT, signal_handler)
    signal.signal(signal.SIGTERM, signal_handler)

    try:
        # 启动FastAPI应用
        fastapi_process = start_fastapi()

        # 启动任务执行器
        task_executor_process = start_task_executor(args)

        # 监控子进程
        while True:
            # 检查FastAPI应用是否还在运行
            if fastapi_process.poll() is not None:
                logger.error(f"FastAPI应用已退出，退出码={fastapi_process.returncode}")
                # 重启FastAPI应用
                logger.info("重启FastAPI应用")
                fastapi_process = start_fastapi()

            # 检查任务执行器是否还在运行
            if task_executor_process.poll() is not None:
                logger.error(f"任务执行器已退出，退出码={task_executor_process.returncode}")
                # 重启任务执行器
                logger.info("重启任务执行器")
                task_executor_process = start_task_executor(args)

            # 每5秒检查一次
            time.sleep(5)
    except KeyboardInterrupt:
        logger.info("收到中断信号，开始清理")
        cleanup()
    except Exception as e:
        logger.error(f"发生错误: {str(e)}")
        cleanup()

if __name__ == "__main__":
    # 解析命令行参数
    parser = argparse.ArgumentParser(description="应用启动脚本")
    parser.add_argument("--min-concurrent-tasks", type=int, default=5, help="最小并发任务数")
    parser.add_argument("--max-concurrent-tasks", type=int, default=50, help="最大并发任务数")
    parser.add_argument("--scale-up-step", type=int, default=5, help="每次扩容增加的并发任务数")
    parser.add_argument("--scale-up-interval", type=int, default=120, help="扩容间隔（秒），默认两分钟")
    parser.add_argument("--scale-down-interval", type=int, default=300, help="缩容间隔（秒）")

    args = parser.parse_args()

    # 运行主函数
    main(args)
