from fastapi import APIRouter

from app.api.v1.endpoints import auth, users, tasks, search

api_router = APIRouter()

# 添加各个模块的路由
api_router.include_router(auth.router, prefix="/auth", tags=["认证"])
api_router.include_router(users.router, prefix="/users", tags=["用户管理"])
api_router.include_router(tasks.router, prefix="/tasks", tags=["任务管理"])
api_router.include_router(search.router, prefix="/search", tags=["搜索服务"])
