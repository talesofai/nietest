from typing import Generic, TypeVar, Optional, Any, Dict, List
from pydantic import BaseModel, Field

# 定义一个类型变量，用于泛型响应
T = TypeVar('T')

class APIResponse(BaseModel, Generic[T]):
    """通用API响应模型"""
    code: int = Field(200, description="状态码")
    message: str = Field("success", description="响应消息")
    data: Optional[T] = Field(None, description="响应数据")

class PaginatedResponse(BaseModel, Generic[T]):
    """分页响应模型"""
    items: List[T] = Field(..., description="数据项列表")
    total: int = Field(..., description="总数")
    page: int = Field(..., description="当前页码")
    page_size: int = Field(..., description="每页大小")

class Token(BaseModel):
    """令牌模型"""
    access_token: str
    token_type: str

class TokenData(BaseModel):
    """令牌数据模型"""
    user_id: Optional[str] = None
