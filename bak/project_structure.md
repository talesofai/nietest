# 项目结构

## 概述

本文档详细描述了Backend2项目的目录结构和文件组织。项目采用模块化设计，清晰分离不同功能组件，便于维护和扩展。

## 目录结构

```
backend2/
├── alembic/                  # 数据库迁移相关文件
│   ├── versions/             # 迁移版本
│   └── env.py                # 迁移环境配置
├── app/                      # 应用主目录
│   ├── api/                  # API路由和端点
│   │   ├── deps.py           # API依赖项
│   │   └── v1/               # API版本1
│   │       ├── endpoints/    # API端点
│   │       │   ├── auth.py   # 认证相关API
│   │       │   ├── users.py  # 用户管理API
│   │       │   ├── tasks.py  # 任务管理API
│   │       │   └── system.py # 系统管理API
│   │       └── api.py        # API路由注册
│   ├── core/                 # 核心配置
│   │   ├── config.py         # 应用配置
│   │   ├── security.py       # 安全相关
│   │   └── logging.py        # 日志配置
│   ├── db/                   # 数据库相关
│   │   ├── base.py           # 数据库基础设置
│   │   ├── session.py        # 数据库会话
│   │   └── init_db.py        # 数据库初始化
│   ├── models/               # 数据库模型
│   │   ├── base.py           # 基础模型
│   │   ├── user.py           # 用户模型
│   │   ├── task.py           # 任务模型
│   │   └── subtask.py        # 子任务模型
│   ├── schemas/              # Pydantic模式
│   │   ├── base.py           # 基础模式
│   │   ├── user.py           # 用户相关模式
│   │   ├── task.py           # 任务相关模式
│   │   ├── subtask.py        # 子任务相关模式
│   │   └── common.py         # 通用模式
│   ├── services/             # 业务服务
│   │   ├── user.py           # 用户服务
│   │   ├── task.py           # 任务服务
│   │   ├── subtask.py        # 子任务服务
│   │   └── image.py          # 图片生成服务
│   ├── tasks/                # Dramatiq任务
│   │   ├── base.py           # 基础任务
│   │   ├── image.py          # 图片生成任务
│   │   └── monitoring.py     # 监控任务
│   ├── utils/                # 工具函数
│   │   ├── common.py         # 通用工具
│   │   ├── image.py          # 图片处理工具
│   │   └── notification.py   # 通知工具
│   ├── main.py               # 应用入口
│   └── dramatiq_config.py    # Dramatiq配置
├── scripts/                  # 脚本文件
│   ├── start_api.py          # 启动API服务
│   ├── start_worker.py       # 启动Worker
│   ├── init_db.py            # 初始化数据库
│   └── backup_db.py          # 备份数据库
├── tests/                    # 测试文件
│   ├── conftest.py           # 测试配置
│   ├── api/                  # API测试
│   ├── services/             # 服务测试
│   └── tasks/                # 任务测试
├── logs/                     # 日志文件
├── .env.example              # 环境变量示例
├── alembic.ini               # Alembic配置
├── pyproject.toml            # 项目配置
├── requirements.txt          # 依赖项
├── Dockerfile.api            # API服务Dockerfile
├── Dockerfile.worker         # Worker Dockerfile
└── docker-compose.yml        # Docker Compose配置
```

## 核心模块说明

### API模块

API模块负责处理HTTP请求和响应，包括路由定义、请求验证和响应格式化。

```python
# app/api/v1/endpoints/tasks.py 示例
from fastapi import APIRouter, Depends, HTTPException, Query, Path
from typing import List, Optional

from app.api import deps
from app.schemas.task import TaskCreate, TaskResponse, TaskListResponse
from app.schemas.common import APIResponse
from app.services import task as task_service

router = APIRouter()

@router.post("", response_model=APIResponse)
async def create_task(
    task_in: TaskCreate,
    current_user = Depends(deps.get_current_user)
):
    """创建新任务"""
    task = await task_service.create_task(task_in, current_user.email)
    return APIResponse(
        code=200,
        message="success",
        data=task
    )

@router.get("", response_model=APIResponse)
async def list_tasks(
    page: int = Query(1, ge=1),
    limit: int = Query(10, ge=1, le=100),
    status: Optional[str] = None,
    search: Optional[str] = None,
    current_user = Depends(deps.get_optional_current_user)
):
    """获取任务列表"""
    tasks = await task_service.list_tasks(
        page=page,
        limit=limit,
        status=status,
        search=search,
        username=current_user.email if current_user else None
    )
    return APIResponse(
        code=200,
        message="success",
        data=tasks
    )
```

### 数据库模型

数据库模型定义了数据库表结构和关系。

```python
# app/models/task.py 示例
from sqlalchemy import Column, String, Integer, Boolean, ForeignKey, DateTime, Text, JSON
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
import uuid
from datetime import datetime

from app.models.base import Base

class Task(Base):
    __tablename__ = "tasks"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    task_name = Column(String(255), nullable=False)
    username = Column(String(255), nullable=False)
    tags = Column(JSON, default=list)
    variables = Column(JSON, default=dict)
    settings = Column(JSON, default=dict)
    status = Column(String(50), default="pending")
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    total_images = Column(Integer, default=0)
    all_subtasks_completed = Column(Boolean, default=False)
    is_deleted = Column(Boolean, default=False)
    priority = Column(Integer, default=1)

    # 关系
    subtasks = relationship("SubTask", back_populates="task", cascade="all, delete-orphan")
```

### 服务层

服务层实现业务逻辑，连接API和数据库操作。

```python
# app/services/task.py 示例
from typing import Dict, Any, List, Optional
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
import uuid

from app.db.session import get_db
from app.models.task import Task
from app.models.subtask import SubTask
from app.schemas.task import TaskCreate, TaskResponse, TaskListResponse
from app.tasks.image import process_image

async def create_task(task_in: TaskCreate, username: str) -> Dict[str, Any]:
    """创建新任务"""
    async with get_db() as db:
        # 创建任务记录
        task = Task(
            id=uuid.uuid4(),
            task_name=task_in.task_name,
            username=username,
            tags=task_in.tags,
            variables=task_in.variables,
            settings=task_in.settings,
            priority=task_in.priority
        )
        db.add(task)
        await db.commit()
        await db.refresh(task)

        # 计算总图片数
        total_images = calculate_total_images(task_in.variables)
        task.total_images = total_images
        await db.commit()

        # 准备子任务
        subtasks = await prepare_subtasks(db, task.id, task_in)

        # 提交任务到队列
        for subtask in subtasks:
            process_image.send(str(subtask.id))

        return {
            "id": str(task.id),
            "task_name": task.task_name,
            "username": task.username,
            "status": task.status,
            "created_at": task.created_at,
            "updated_at": task.updated_at,
            "total_images": task.total_images,
            "processed_images": 0,
            "progress": 0,
            "priority": task.priority
        }
```

### Dramatiq任务

Dramatiq任务处理异步操作，如图片生成。

```python
# app/tasks/image.py 示例
import dramatiq
from dramatiq.middleware import Retries
from typing import Dict, Any
import logging
import traceback

from app.db.session import get_db_sync
from app.models.subtask import SubTask
from app.services.image import create_image

logger = logging.getLogger(__name__)

@dramatiq.actor(
    queue_name="standard_tasks",
    max_retries=3,
    min_backoff=1000,
    max_backoff=60000
)
def process_image(subtask_id: str):
    """处理图片生成任务"""
    logger.info(f"开始处理子任务: {subtask_id}")
    
    try:
        # 获取子任务信息
        with get_db_sync() as db:
            subtask = db.query(SubTask).filter(SubTask.id == subtask_id).first()
            if not subtask:
                logger.error(f"子任务不存在: {subtask_id}")
                return
            
            # 更新子任务状态为处理中
            subtask.status = "processing"
            db.commit()
        
        # 生成图片
        result = create_image(
            prompts=subtask.prompts,
            ratio=subtask.ratio,
            seed=subtask.seed,
            use_polish=subtask.use_polish
        )
        
        # 更新子任务结果
        with get_db_sync() as db:
            subtask = db.query(SubTask).filter(SubTask.id == subtask_id).first()
            if subtask:
                subtask.status = "completed"
                subtask.result = result
                db.commit()
                
                # 更新父任务进度
                update_task_progress(db, str(subtask.parent_task_id))
        
        logger.info(f"子任务处理完成: {subtask_id}")
        
    except Exception as e:
        logger.error(f"子任务处理失败: {subtask_id}, 错误: {str(e)}")
        logger.error(traceback.format_exc())
        
        # 更新子任务状态为失败
        with get_db_sync() as db:
            subtask = db.query(SubTask).filter(SubTask.id == subtask_id).first()
            if subtask:
                subtask.status = "failed"
                subtask.error = str(e)
                subtask.retry_count += 1
                db.commit()
        
        # 重新抛出异常，触发重试机制
        raise
```

## 配置管理

系统使用环境变量和配置文件管理配置。

```python
# app/core/config.py 示例
from pydantic import BaseSettings, PostgresDsn, RedisDsn
from typing import List, Optional
import os

class Settings(BaseSettings):
    """应用配置类"""
    # 项目基本信息
    PROJECT_NAME: str = "Backend API"
    DESCRIPTION: str = "Backend API系统"
    VERSION: str = "1.0.0"

    # API配置
    API_V1_STR: str = "/api/v1"

    # CORS配置
    CORS_ORIGINS: List[str] = ["*"]

    # 数据库配置
    DATABASE_URL: PostgresDsn = os.getenv("DATABASE_URL", "postgresql://postgres:postgres@localhost:5432/backend")
    DB_POOL_SIZE: int = int(os.getenv("DB_POOL_SIZE", "5"))
    DB_MAX_OVERFLOW: int = int(os.getenv("DB_MAX_OVERFLOW", "10"))
    DB_POOL_TIMEOUT: int = int(os.getenv("DB_POOL_TIMEOUT", "30"))

    # Redis配置
    REDIS_URL: RedisDsn = os.getenv("REDIS_URL", "redis://localhost:6379/0")
    REDIS_KEY_PREFIX: str = os.getenv("REDIS_KEY_PREFIX", "app:")

    # JWT配置
    SECRET_KEY: str = os.getenv("SECRET_KEY", "supersecretkey")
    ALGORITHM: str = os.getenv("ALGORITHM", "HS256")
    ACCESS_TOKEN_EXPIRE_MINUTES: int = int(os.getenv("ACCESS_TOKEN_EXPIRE_MINUTES", "10080"))

    # 日志配置
    LOG_LEVEL: str = os.getenv("LOG_LEVEL", "INFO")

    # Dramatiq配置
    DRAMATIQ_RESULT_TTL: int = int(os.getenv("DRAMATIQ_RESULT_TTL", "86400"))
    
    # Worker配置
    STANDARD_WORKER_PROCESSES: int = int(os.getenv("STANDARD_WORKER_PROCESSES", "4"))
    STANDARD_WORKER_THREADS: int = int(os.getenv("STANDARD_WORKER_THREADS", "8"))
    LUMINA_WORKER_PROCESSES: int = int(os.getenv("LUMINA_WORKER_PROCESSES", "2"))
    LUMINA_WORKER_THREADS: int = int(os.getenv("LUMINA_WORKER_THREADS", "4"))

    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"

# 创建全局设置对象
settings = Settings()
```

## 数据库会话管理

系统使用SQLAlchemy异步会话管理数据库连接。

```python
# app/db/session.py 示例
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import sessionmaker
from contextlib import asynccontextmanager, contextmanager

from app.core.config import settings

# 创建异步引擎
engine = create_async_engine(
    str(settings.DATABASE_URL),
    pool_size=settings.DB_POOL_SIZE,
    max_overflow=settings.DB_MAX_OVERFLOW,
    pool_timeout=settings.DB_POOL_TIMEOUT,
    pool_pre_ping=True,
    echo=False,
)

# 创建异步会话工厂
AsyncSessionLocal = sessionmaker(
    engine,
    class_=AsyncSession,
    expire_on_commit=False,
)

@asynccontextmanager
async def get_db():
    """获取异步数据库会话"""
    session = AsyncSessionLocal()
    try:
        yield session
    finally:
        await session.close()

# 同步会话工厂（用于Dramatiq任务）
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, Session

# 从异步URL创建同步URL
sync_db_url = str(settings.DATABASE_URL).replace("+asyncpg", "")

# 创建同步引擎
sync_engine = create_engine(
    sync_db_url,
    pool_size=settings.DB_POOL_SIZE,
    max_overflow=settings.DB_MAX_OVERFLOW,
    pool_timeout=settings.DB_POOL_TIMEOUT,
    pool_pre_ping=True,
    echo=False,
)

# 创建同步会话工厂
SessionLocal = sessionmaker(
    sync_engine,
    expire_on_commit=False,
)

@contextmanager
def get_db_sync():
    """获取同步数据库会话（用于Dramatiq任务）"""
    session = SessionLocal()
    try:
        yield session
    finally:
        session.close()
```

## 应用入口

应用入口文件配置FastAPI应用和中间件。

```python
# app/main.py 示例
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager
import logging

from app.core.config import settings
from app.core.logging import configure_logging
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

    yield

    # 关闭时执行
    logger.info("Application shutting down...")

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

# 添加CORS中间件
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
    uvicorn.run("app.main:app", host="0.0.0.0", port=8000, reload=True)
```

## Dramatiq配置

Dramatiq配置文件设置消息代理和中间件。

```python
# app/dramatiq_config.py 示例
import dramatiq
from dramatiq.brokers.redis import RedisBroker
from dramatiq.middleware import AgeLimit, TimeLimit, Retries, Callbacks
from datetime import timedelta

from app.core.config import settings

# 配置中间件
middleware = [
    AgeLimit(max_age=timedelta(days=1)),  # 任务最大存活时间
    TimeLimit(limit=timedelta(minutes=5)),  # 任务执行时间限制
    Retries(max_retries=3, min_backoff=1000, max_backoff=60000),  # 重试配置
    Callbacks(),  # 支持回调函数
]

# 配置Redis作为消息代理
broker = RedisBroker(url=str(settings.REDIS_URL))
broker.add_middleware(middleware)
dramatiq.set_broker(broker)
```

## 启动脚本

启动脚本用于启动API服务和Worker。

```python
# scripts/start_api.py 示例
import uvicorn
import os
import sys
import logging

# 添加项目根目录到Python路径
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from app.core.config import settings

# 配置日志
logging.basicConfig(
    level=getattr(logging, settings.LOG_LEVEL),
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
)

logger = logging.getLogger("start_api")

def main():
    """启动API服务"""
    logger.info("Starting API server...")
    uvicorn.run(
        "app.main:app",
        host="0.0.0.0",
        port=8000,
        reload=False,
        log_level=settings.LOG_LEVEL.lower(),
    )

if __name__ == "__main__":
    main()
```

```python
# scripts/start_worker.py 示例
import os
import sys
import logging
import argparse
import subprocess

# 添加项目根目录到Python路径
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from app.core.config import settings

# 配置日志
logging.basicConfig(
    level=getattr(logging, settings.LOG_LEVEL),
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
)

logger = logging.getLogger("start_worker")

def main():
    """启动Worker"""
    parser = argparse.ArgumentParser(description="Start Dramatiq worker")
    parser.add_argument(
        "--queue",
        type=str,
        default="standard_tasks",
        choices=["standard_tasks", "lumina_tasks", "high_priority_tasks"],
        help="Queue to process",
    )
    parser.add_argument(
        "--processes",
        type=int,
        default=None,
        help="Number of processes",
    )
    parser.add_argument(
        "--threads",
        type=int,
        default=None,
        help="Number of threads per process",
    )
    args = parser.parse_args()

    # 根据队列类型设置默认进程数和线程数
    if args.queue == "standard_tasks":
        processes = args.processes or settings.STANDARD_WORKER_PROCESSES
        threads = args.threads or settings.STANDARD_WORKER_THREADS
    elif args.queue == "lumina_tasks":
        processes = args.processes or settings.LUMINA_WORKER_PROCESSES
        threads = args.threads or settings.LUMINA_WORKER_THREADS
    else:
        processes = args.processes or 2
        threads = args.threads or 4

    logger.info(f"Starting Dramatiq worker for queue {args.queue}...")
    logger.info(f"Processes: {processes}, Threads: {threads}")

    # 构建启动命令
    cmd = [
        sys.executable,
        "-m",
        "dramatiq",
        "app.dramatiq_config:broker",
        "-p", str(processes),
        "-t", str(threads),
        "-Q", args.queue,
    ]

    # 启动Worker
    subprocess.run(cmd)

if __name__ == "__main__":
    main()
```
