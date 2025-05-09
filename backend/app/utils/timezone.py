"""
时区工具模块 - 处理时区转换和格式化
"""
from datetime import datetime, timezone, timedelta
from typing import Optional

# 北京时区 (UTC+8)
BEIJING_TIMEZONE = timezone(timedelta(hours=8))

def get_beijing_now() -> datetime:
    """
    获取当前北京时间
    
    Returns:
        当前北京时间
    """
    return datetime.now(BEIJING_TIMEZONE)

def to_beijing_timezone(dt: Optional[datetime]) -> Optional[datetime]:
    """
    将任何时间转换为北京时区
    
    Args:
        dt: 要转换的日期时间对象
        
    Returns:
        转换后的日期时间对象，如果输入为None则返回None
    """
    if dt is None:
        return None
        
    # 如果没有时区信息，假定为UTC
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc)
        
    # 转换到北京时区
    return dt.astimezone(BEIJING_TIMEZONE)

def format_beijing_time(dt: Optional[datetime], format_str: str = "%Y-%m-%d %H:%M:%S") -> Optional[str]:
    """
    格式化为北京时间字符串
    
    Args:
        dt: 要格式化的日期时间对象
        format_str: 格式化字符串
        
    Returns:
        格式化后的字符串，如果输入为None则返回None
    """
    if dt is None:
        return None
        
    beijing_dt = to_beijing_timezone(dt)
    return beijing_dt.strftime(format_str)

def beijing_time_to_utc(dt: Optional[datetime]) -> Optional[datetime]:
    """
    将北京时间转换为UTC时间
    
    Args:
        dt: 北京时间的日期时间对象
        
    Returns:
        转换后的UTC日期时间对象，如果输入为None则返回None
    """
    if dt is None:
        return None
        
    # 如果没有时区信息，假定为北京时区
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=BEIJING_TIMEZONE)
        
    # 转换到UTC
    return dt.astimezone(timezone.utc)
