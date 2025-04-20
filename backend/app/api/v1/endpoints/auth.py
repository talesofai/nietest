from datetime import timedelta
from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordRequestForm

from app.core.config import settings
from app.core.security import create_access_token
from app.schemas.token import Token
from app.schemas.common import APIResponse
from app.services.user import authenticate_user

router = APIRouter()

@router.post("/login", response_model=APIResponse[Token])
async def login_for_access_token(form_data: OAuth2PasswordRequestForm = Depends()):
    """
    获取访问令牌

    Args:
        form_data: 表单数据，包含用户名和密码

    Returns:
        访问令牌

    Raises:
        HTTPException: 认证失败
    """
    # 验证用户
    user = await authenticate_user(form_data.username, form_data.password)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="邮箱或密码错误",
            headers={"WWW-Authenticate": "Bearer"},
        )

    # 创建访问令牌
    access_token_expires = timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    access_token = create_access_token(
        data={"sub": user["id"], "email": user["email"]},
        expires_delta=access_token_expires,
    )

    token_data = {"access_token": access_token, "token_type": "bearer"}

    return APIResponse[
        Token
    ](
        code=200,
        message="登录成功",
        data=token_data
    )
