from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager
import logging

from app.core.config import settings
from app.core.logging import configure_logging
from app.db.mongodb import connect_to_mongo, close_mongo_connection
from app.db.redis import get_redis_cache
from app.api.v1.api import api_router
from app.schemas.common import APIResponse

# 配置日志
logger = logging.getLogger(__name__)

# 定义lifespan事件处理程序
@asynccontextmanager
async def lifespan(app_instance: FastAPI):
    # 启动时执行
    logger = configure_logging(settings.LOG_LEVEL)
    logger.info("Application starting up...")

    # 连接数据库
    await connect_to_mongo()
    logger.info("Database connection established")

    # 初始化Redis缓存
    redis_cache = get_redis_cache()
    await redis_cache.connect()
    logger.info("Redis cache initialized")

    # 清理Redis中的任务缓存
    from app.services.task import clear_all_task_cache
    deleted_count = await clear_all_task_cache()
    logger.info(f"应用启动时清理了 {deleted_count} 个任务缓存键")

    # 初始化任务执行器
    from app.services.task_processor import start_task_executor
    await start_task_executor(
        min_concurrent_tasks=settings.TASK_EXECUTOR_MIN_CONCURRENT,
        max_concurrent_tasks=settings.TASK_EXECUTOR_MAX_CONCURRENT,
        scale_up_step=settings.TASK_EXECUTOR_SCALE_UP_STEP,
        scale_up_interval=settings.TASK_EXECUTOR_SCALE_UP_INTERVAL,
        scale_down_interval=settings.TASK_EXECUTOR_SCALE_DOWN_INTERVAL
    )
    logger.info("任务执行器已初始化")

    yield

    # 关闭时执行
    logger.info("Application shutting down...")

    # 关闭Redis缓存
    redis_cache = get_redis_cache()
    await redis_cache.disconnect()
    logger.info("Redis cache connection closed")

    # 关闭数据库连接
    await close_mongo_connection()
    logger.info("Database connection closed")

# 创建FastAPI应用
app = FastAPI(
    title=settings.PROJECT_NAME,
    version=settings.VERSION,
    description=settings.DESCRIPTION,
    lifespan=lifespan,
    docs_url="/docs",
    redoc_url="/redoc",
    openapi_url="/openapi.json",
)

# 添加统一响应中间件 - 简化版本
@app.middleware("http")
async def response_middleware(request: Request, call_next):
    # 先处理非API路径请求，直接返回原始响应
    if not request.url.path.startswith(settings.API_V1_STR) or request.url.path.endswith("/docs") or request.url.path.endswith("/openapi.json") or request.url.path.endswith("/redoc"):
        return await call_next(request)

    # 处理OPTIONS请求
    if request.method == "OPTIONS":
        return await call_next(request)

    # 处理API请求
    response = await call_next(request)

    # 直接返回原始响应，不做额外处理
    return response

# 配置CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# 包含API路由
app.include_router(api_router, prefix=settings.API_V1_STR)

# 健康检查端点
@app.get("/health", response_model=APIResponse)
async def health_check():
    """健康检查端点"""
    return APIResponse(
        code=200,
        message="success",
        data={"status": "healthy"}
    )

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("app.main:app", host="127.0.0.1", port=8088, reload=True)
