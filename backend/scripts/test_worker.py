"""
测试worker是否正常工作
"""

import asyncio
import logging
import sys
import os

# 设置Python路径
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

# 配置日志
logging.basicConfig(
    level=logging.DEBUG,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
)
logger = logging.getLogger(__name__)

async def main():
    """主函数"""
    try:
        # 导入必要的模块
        from app.dramatiq.tasks import generate_single_image
        from app.db.mongodb import get_database
        from app.models.dramatiq_task import DramatiqTaskStatus
        from app.crud import dramatiq_task as dramatiq_task_crud
        
        # 创建一个测试任务
        db = await get_database()
        
        # 创建一个测试任务数据
        test_task_data = {
            "parent_task_id": "test_task",
            "status": DramatiqTaskStatus.PENDING.value,
            "prompt": {"value": "test prompt", "weight": 1.0},
            "characters": [],
            "elements": [],
            "ratio": "1:1",
            "seed": 12345,
            "use_polish": False,
            "v0": 0,
            "v1": 0,
            "v2": 0,
            "v3": 0,
            "v4": 0,
            "v5": 0
        }
        
        # 创建任务
        dramatiq_task = await dramatiq_task_crud.create_dramatiq_task(db, test_task_data)
        logger.info(f"创建了测试任务: {dramatiq_task['id']}")
        
        # 发送任务到队列
        message = generate_single_image.send(dramatiq_task["id"])
        logger.info(f"发送了测试任务到队列: {message.message_id}")
        
        # 更新任务的消息ID
        await dramatiq_task_crud.update_dramatiq_task_message_id(db, dramatiq_task["id"], message.message_id)
        
        # 等待任务处理
        logger.info("等待任务处理...")
        for i in range(30):  # 最多等待30秒
            # 获取任务状态
            task = await dramatiq_task_crud.get_dramatiq_task(db, dramatiq_task["id"])
            status = task.get("status")
            
            logger.info(f"任务状态: {status}")
            
            # 如果任务已完成或失败，退出循环
            if status in [DramatiqTaskStatus.COMPLETED.value, DramatiqTaskStatus.FAILED.value]:
                break
                
            # 等待1秒
            await asyncio.sleep(1)
        
        # 获取最终任务状态
        task = await dramatiq_task_crud.get_dramatiq_task(db, dramatiq_task["id"])
        logger.info(f"最终任务状态: {task.get('status')}")
        
        if task.get("status") == DramatiqTaskStatus.COMPLETED.value:
            logger.info(f"任务成功完成，结果: {task.get('result')}")
        elif task.get("status") == DramatiqTaskStatus.FAILED.value:
            logger.error(f"任务失败，错误: {task.get('error')}")
        else:
            logger.warning(f"任务未完成，当前状态: {task.get('status')}")
            
    except Exception as e:
        logger.error(f"测试失败: {str(e)}")
        raise

if __name__ == "__main__":
    asyncio.run(main())
