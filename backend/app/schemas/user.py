from datetime import datetime
from typing import List, Optional
from pydantic import BaseModel, EmailStr, Field, field_validator

from app.models.user import Role

class UserBase(BaseModel):
    """用户基础模式"""
    email: EmailStr
    fullname: Optional[str] = None
    roles: List[Role] = [Role.USER]
    is_active: bool = True

class UserCreate(UserBase):
    """用户创建模式"""
    password: str = Field(..., min_length=8)

    @field_validator('password')
    def password_strength(cls, v):
        """验证密码强度"""
        if len(v) < 8:
            raise ValueError('密码长度必须至少为8个字符')
        return v

class UserUpdate(BaseModel):
    """用户更新模式"""
    email: Optional[EmailStr] = None
    fullname: Optional[str] = None
    password: Optional[str] = None
    roles: Optional[List[Role]] = None
    is_active: Optional[bool] = None

    @field_validator('password')
    def password_strength(cls, v):
        """验证密码强度"""
        if v is not None and len(v) < 8:
            raise ValueError('密码长度必须至少为8个字符')
        return v

class UserInDB(UserBase):
    """数据库中的用户模式"""
    id: str
    hashed_password: str
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True

class UserResponse(BaseModel):
    """用户响应模式"""
    id: str
    email: EmailStr
    fullname: Optional[str] = None
    roles: List[Role] = [Role.USER]
    is_active: bool = True
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True