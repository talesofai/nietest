from datetime import datetime, timedelta
from typing import Optional, Dict, Any
from jose import jwt, JWTError
from passlib.context import CryptContext
from fastapi import HTTPException, status
from fastapi.security import OAuth2PasswordBearer

from app.core.config import settings
from app.utils.timezone import get_beijing_now

# 密码上下文
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

# OAuth2密码Bearer
oauth2_scheme = OAuth2PasswordBearer(tokenUrl=f"{settings.API_V1_STR}/auth/login")

def verify_password(plain_password: str, hashed_password: str) -> bool:
    """验证密码

    Args:
        plain_password: 明文密码
        hashed_password: 哈希密码

    Returns:
        密码是否匹配
    """
    return pwd_context.verify(plain_password, hashed_password)

def get_password_hash(password: str) -> str:
    """获取密码哈希

    Args:
        password: 明文密码

    Returns:
        密码哈希
    """
    return pwd_context.hash(password)

def create_access_token(data: Dict[str, Any], expires_delta: Optional[timedelta] = None) -> str:
    """创建访问令牌

    Args:
        data: 令牌数据
        expires_delta: 过期时间增量

    Returns:
        JWT令牌
    """
    to_encode = data.copy()

    # 设置过期时间
    if expires_delta:
        expire = get_beijing_now() + expires_delta
    else:
        expire = get_beijing_now() + timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)

    to_encode.update({"exp": expire})

    # 使用密钥和算法生成JWT
    encoded_jwt = jwt.encode(to_encode, settings.SECRET_KEY, algorithm=settings.ALGORITHM)
    return encoded_jwt

def verify_token(token: str) -> Dict[str, Any]:
    """验证令牌

    Args:
        token: JWT令牌

    Returns:
        令牌数据

    Raises:
        HTTPException: 令牌无效或已过期
    """
    try:
        # 解码JWT
        payload = jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])

        # 提取用户ID
        user_id: str = payload.get("sub")
        if user_id is None:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="无效的认证凭据",
                headers={"WWW-Authenticate": "Bearer"},
            )

        return payload

    except JWTError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="无效的认证凭据",
            headers={"WWW-Authenticate": "Bearer"},
        )
