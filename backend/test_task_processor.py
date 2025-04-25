"""
测试任务处理器的变量类型映射功能
"""

import asyncio
import json
import uuid
from datetime import datetime, timezone

# 模拟任务数据
test_task = {
    "_id": "680ba391c4431d9e65405291",
    "id": "44da98f3-01cb-4ce8-8d26-cd289ac83c82",
    "task_name": "测试任务",
    "username": "test@nieta.com",
    "tags": [
        {
            "id": "batch-1745547936568",
            "type": "batch",
            "isVariable": False,
            "value": "1",
            "color": "#8CC63F",
            "useGradient": False
        },
        {
            "id": "seed-1745547936568",
            "type": "seed",
            "isVariable": False,
            "value": "0",
            "color": "#662D91",
            "useGradient": False
        },
        {
            "id": "polish-1745547936568",
            "type": "polish",
            "isVariable": False,
            "value": "false",
            "color": "#FFCC00",
            "useGradient": False
        },
        {
            "id": "1745590871462",
            "type": "element",
            "isVariable": True,
            "value": "",
            "color": "#c1651a",
            "name": "测试用元素",
            "gradientToColor": "#c09351",
            "useGradient": True
        },
        {
            "id": "1745593221819",
            "type": "character",
            "isVariable": True,
            "value": "",
            "color": "#a35c8f",
            "name": "测试角色",
            "gradientToColor": "#f8d86a",
            "useGradient": True
        }
    ],
    "variables": {
        "v0": {
            "tag_id": "1745590871462",
            "name": "测试用元素",
            "values": [
                {
                    "id": "1745590871462-default",
                    "value": "入狱照",
                    "uuid": "df81b59b-62dc-45cd-8607-22ebae31f88b",
                    "header_img": "https://oss.talesofai.cn/fe_assets/mng/19/29145a87c97873f1b4e39f870ed165ef.png"
                }
            ],
            "values_count": 1
        },
        "v1": {
            "tag_id": "1745593221819",
            "name": "测试角色",
            "values": [
                {
                    "id": "1745593221819-default",
                    "value": "阿尼亚",
                    "uuid": "052d52e7-bfb2-4e81-aaa5-8d8181e51b41",
                    "header_img": "https://oss.talesofai.cn/fe_assets/mng/28/a4acee03898a2b7bf6a47b123500fb20.png"
                }
            ],
            "values_count": 1
        },
        "v2": {
            "name": "",
            "values": [],
            "values_count": 0
        },
        "v3": {
            "name": "",
            "values": [],
            "values_count": 0
        },
        "v4": {
            "name": "",
            "values": [],
            "values_count": 0
        },
        "v5": {
            "name": "",
            "values": [],
            "values_count": 0
        }
    },
    "settings": {
        "maxThreads": 4,
        "xToken": ""
    },
    "status": "processing",
    "created_at": datetime.now(timezone.utc),
    "updated_at": datetime.now(timezone.utc),
    "total_images": 1,
    "processed_images": 0,
    "progress": 0,
    "all_subtasks_completed": False,
    "is_deleted": False,
    "priority": 1
}

# 模拟变量组合
test_combination = {
    "v0": {
        "id": "1745590871462-default",
        "value": "入狱照",
        "uuid": "df81b59b-62dc-45cd-8607-22ebae31f88b",
        "header_img": "https://oss.talesofai.cn/fe_assets/mng/19/29145a87c97873f1b4e39f870ed165ef.png",
        "index": 0
    },
    "v1": {
        "id": "1745593221819-default",
        "value": "阿尼亚",
        "uuid": "052d52e7-bfb2-4e81-aaa5-8d8181e51b41",
        "header_img": "https://oss.talesofai.cn/fe_assets/mng/28/a4acee03898a2b7bf6a47b123500fb20.png",
        "index": 0
    }
}

# 模拟标签ID到类型的映射
tag_id_to_type = {
    "batch-1745547936568": "batch",
    "seed-1745547936568": "seed",
    "polish-1745547936568": "polish",
    "1745590871462": "element",
    "1745593221819": "character"
}

async def test_prepare_subtask_data():
    """测试prepare_subtask_data函数"""
    from app.services.task_processor import prepare_subtask_data
    
    # 调用函数
    subtask_data = await prepare_subtask_data(test_task, test_combination, tag_id_to_type, 0)
    
    # 打印结果
    print("变量索引数组:", subtask_data["variable_indices"])
    print("变量类型映射:", subtask_data["variable_types_map"])
    print("类型到变量映射:", subtask_data["type_to_variable"])
    
    # 检查结果
    assert "variable_types_map" in subtask_data, "缺少变量类型映射字段"
    assert "type_to_variable" in subtask_data, "缺少类型到变量映射字段"
    
    # 检查映射内容
    assert subtask_data["variable_types_map"].get("v0") == "element", "v0应该映射到element类型"
    assert subtask_data["variable_types_map"].get("v1") == "character", "v1应该映射到character类型"
    
    assert subtask_data["type_to_variable"].get("element") == "v0", "element类型应该映射到v0"
    assert subtask_data["type_to_variable"].get("character") == "v1", "character类型应该映射到v1"
    
    print("测试通过!")
    return subtask_data

if __name__ == "__main__":
    # 运行测试
    subtask_data = asyncio.run(test_prepare_subtask_data())
    
    # 保存结果到文件，方便查看
    with open("test_subtask_data.json", "w", encoding="utf-8") as f:
        json.dump(subtask_data, f, ensure_ascii=False, indent=2, default=str)
    
    print(f"测试结果已保存到 test_subtask_data.json")
