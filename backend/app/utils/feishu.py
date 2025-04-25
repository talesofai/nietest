"""
飞书通知工具模块

该模块提供了发送飞书通知的功能，用于在任务状态变化时发送通知。
"""

import logging
import threading
import requests

# 配置日志
logger = logging.getLogger(__name__)

# 飞书通知webhook URL
FEISHU_WEBHOOK_URL = 'https://open.feishu.cn/open-apis/bot/v2/hook/313385c2-b4b9-46f0-8a6e-695dcf11190b'

def feishu_notify(event_type: str, task_id: str = None, task_name: str = None,
               submitter: str = None, details: dict = None, message: str = None):
    """
    发送飞书通知

    Args:
        event_type: 事件类型，如'task_submitted', 'task_completed', 'task_failed'
        task_id: 任务ID
        task_name: 任务名称
        submitter: 提交者
        details: 详细信息字典
        message: 额外消息
    """
    threading.Thread(target=_send_feishu_notify,
                    args=(event_type, task_id, task_name, submitter, details, message)).start()

def _send_feishu_notify(event_type: str, task_id: str = None, task_name: str = None,
                       submitter: str = None, details: dict = None, message: str = None):
    """
    实际发送飞书通知的函数

    Args:
        event_type: 事件类型，如'task_submitted', 'task_completed', 'task_failed'
        task_id: 任务ID
        task_name: 任务名称
        submitter: 提交者
        details: 详细信息字典
        message: 额外消息
    """
    try:
        # 构建通知标题
        title_map = {
            'task_submitted': '🆕 任务已提交',
            'task_processing': '⏳ 任务处理中',
            'task_completed': '✅ 任务已完成',
            'task_failed': '❌ 任务失败',
            'task_partial_completed': '⚠️ 任务部分完成',
            'test': '🔍 测试通知'
        }

        title = title_map.get(event_type, f'📢 {event_type}')

        # 构建通知内容
        content_lines = [title]

        if task_id:
            content_lines.append(f"任务ID: {task_id}")

        if task_name:
            content_lines.append(f"任务名称: {task_name}")

        if submitter:
            content_lines.append(f"提交者: {submitter}")

        # 添加详细信息
        if details:
            for key, value in details.items():
                content_lines.append(f"{key}: {value}")

        # 添加额外消息
        if message:
            content_lines.append(f"\n{message}")

        # 添加时间戳
        from datetime import datetime
        timestamp = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        content_lines.append(f"\n时间: {timestamp}")

        # 合并所有内容
        full_content = "\n".join(content_lines)

        headers = {
            'Content-Type': 'application/json',
        }
        content = {
            "msg_type": "text",
            "content": {
                "text": full_content,
            }
        }
        response = requests.post(FEISHU_WEBHOOK_URL, headers=headers, json=content)
        logger.debug(f"飞书通知发送结果: {response.status_code}, {response.text}")
    except Exception as e:
        logger.error(f"发送飞书通知失败: {str(e)}")
