from typing import Dict, Any, List, Optional
import json
from datetime import datetime
from bson import ObjectId

class JSONEncoder(json.JSONEncoder):
    """自定义JSON编码器，处理特殊类型"""
    
    def default(self, obj):
        if isinstance(obj, datetime):
            return obj.isoformat()
        if isinstance(obj, ObjectId):
            return str(obj)
        return super().default(obj)

def convert_datetime_fields(data: Dict[str, Any]) -> Dict[str, Any]:
    """
    转换字典中的日期时间字段为ISO格式字符串
    
    Args:
        data: 包含日期时间字段的字典
        
    Returns:
        转换后的字典
    """
    result = {}
    
    for key, value in data.items():
        if isinstance(value, datetime):
            result[key] = value.isoformat()
        elif isinstance(value, dict):
            result[key] = convert_datetime_fields(value)
        elif isinstance(value, list):
            result[key] = [
                convert_datetime_fields(item) if isinstance(item, dict) else item
                for item in value
            ]
        else:
            result[key] = value
    
    return result

def convert_objectid_fields(data: Dict[str, Any]) -> Dict[str, Any]:
    """
    转换字典中的ObjectId字段为字符串
    
    Args:
        data: 包含ObjectId字段的字典
        
    Returns:
        转换后的字典
    """
    result = {}
    
    for key, value in data.items():
        if isinstance(value, ObjectId):
            result[key] = str(value)
        elif isinstance(value, dict):
            result[key] = convert_objectid_fields(value)
        elif isinstance(value, list):
            result[key] = [
                convert_objectid_fields(item) if isinstance(item, dict) else (
                    str(item) if isinstance(item, ObjectId) else item
                )
                for item in value
            ]
        else:
            result[key] = value
    
    return result

def paginate_results(
    items: List[Any],
    total: int,
    page: int,
    page_size: int
) -> Dict[str, Any]:
    """
    创建分页结果
    
    Args:
        items: 数据项列表
        total: 总数
        page: 页码
        page_size: 每页大小
        
    Returns:
        分页结果
    """
    return {
        "items": items,
        "total": total,
        "page": page,
        "page_size": page_size
    }
