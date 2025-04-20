from typing import List
from fastapi import APIRouter, Depends, HTTPException, status

from app.api.deps import get_current_active_user, get_current_admin_user, get_current_admin_or_manager_user
from app.schemas.user import UserCreate, UserUpdate, UserResponse
from app.schemas.common import APIResponse
from app.services.user import get_user, get_user_by_email, create_user, update_user, delete_user, list_users

router = APIRouter()

@router.get("/me", response_model=APIResponse[UserResponse])
async def read_users_me(current_user = Depends(get_current_active_user)):
    """
    获取当前登录用户的信息

    Args:
        current_user: 当前用户

    Returns:
        当前用户信息
    """
    return APIResponse[UserResponse](
        code=200,
        message="success",
        data=UserResponse(**current_user)
    )

@router.get("/{user_id}", response_model=APIResponse[UserResponse])
async def read_user(
    user_id: str,
    current_user = Depends(get_current_admin_or_manager_user)
):
    """
    查询特定用户信息 (需要管理员或经理权限)

    Args:
        user_id: 用户ID
        current_user: 当前用户

    Returns:
        用户信息

    Raises:
        HTTPException: 用户不存在
    """
    user = await get_user(user_id)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="用户不存在"
        )

    return APIResponse[UserResponse](
        code=200,
        message="success",
        data=UserResponse(**user)
    )

@router.get("/", response_model=APIResponse[List[UserResponse]])
async def read_users(
    skip: int = 0,
    limit: int = 100,
    current_user = Depends(get_current_admin_or_manager_user)
):
    """
    获取用户列表 (需要管理员或经理权限)

    Args:
        skip: 跳过的记录数
        limit: 返回的记录数
        current_user: 当前用户

    Returns:
        用户列表
    """
    users = await list_users(skip=skip, limit=limit)

    return APIResponse[List[UserResponse]](
        code=200,
        message="success",
        data=[UserResponse(**user) for user in users]
    )

@router.post("/", response_model=APIResponse[UserResponse])
async def create_new_user(
    user_data: UserCreate,
    current_user = Depends(get_current_admin_user)
):
    """
    创建新用户 (需要管理员权限)

    Args:
        user_data: 用户创建数据
        current_user: 当前用户

    Returns:
        创建的用户

    Raises:
        HTTPException: 邮箱已注册
    """
    # 检查邮箱是否已注册
    existing_user = await get_user_by_email(user_data.email)
    if existing_user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="邮箱已注册"
        )

    # 创建用户
    user = await create_user(user_data)

    return APIResponse[UserResponse](
        code=200,
        message="success",
        data=UserResponse(**user)
    )

@router.put("/{user_id}", response_model=APIResponse[UserResponse])
async def update_user_info(
    user_id: str,
    user_data: UserUpdate,
    current_user = Depends(get_current_admin_user)
):
    """
    更新用户信息 (需要管理员权限)

    Args:
        user_id: 用户ID
        user_data: 用户更新数据
        current_user: 当前用户

    Returns:
        更新后的用户

    Raises:
        HTTPException: 用户不存在
    """
    # 检查用户是否存在
    existing_user = await get_user(user_id)
    if not existing_user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="用户不存在"
        )

    # 更新用户
    updated_user = await update_user(user_id, user_data)

    return APIResponse[UserResponse](
        code=200,
        message="success",
        data=UserResponse(**updated_user)
    )

@router.delete("/{user_id}", response_model=APIResponse)
async def delete_user_account(
    user_id: str,
    current_user = Depends(get_current_admin_user)
):
    """
    删除用户 (需要管理员权限)

    Args:
        user_id: 用户ID
        current_user: 当前用户

    Returns:
        删除结果

    Raises:
        HTTPException: 用户不存在
    """
    # 检查用户是否存在
    existing_user = await get_user(user_id)
    if not existing_user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="用户不存在"
        )

    # 删除用户
    result = await delete_user(user_id)

    return APIResponse(
        code=200,
        message="用户删除成功"
    )
