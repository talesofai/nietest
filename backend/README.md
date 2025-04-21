# Backend2 API 后端系统

## 项目简介

Backend2 API 是基于 FastAPI 和 MongoDB 构建的后端 API 系统，使用常规架构实现。
系统实现了完整的用户身份与权限管理系统以及任务管理功能。

## 功能特点

- **基于邮箱和密码的用户认证**：支持邮箱+密码登录
- **基于 JWT 的身份验证**：安全可靠的身份验证机制
- **多角色权限管理**：支持管理员、经理、普通用户和访客四种角色
- **基于角色的访问控制**：每个角色具有不同的权限
- **精细化的权限控制**：支持读取、写入、删除和管理四种操作权限
- **API 接口的统一响应格式**：标准化 API 响应
- **基于 Dramatiq 的异步任务队列**：支持长时间运行的任务处理
- **任务进度跟踪和管理**：支持任务创建、查询、取消和删除

## 技术栈

- **FastAPI**：高性能的 Python Web 框架
- **MongoDB**：文档型数据库
- **Motor**：MongoDB 的异步 Python 驱动
- **Pydantic**：数据验证和设置管理
- **Python-jose**：JWT 认证
- **Passlib**：密码哈希
- **Dramatiq**：简单高效的分布式任务队列
- **Redis**：缓存和消息代理

## 系统架构

系统采用了传统的三层架构:

1. **表示层(API层)**: 处理HTTP请求和响应
2. **业务逻辑层**: 实现核心业务逻辑
3. **数据访问层**: 处理数据库操作

```
backend2/
├── app/                    # 应用主目录
│   ├── api/                # API路由和端点
│   │   ├── v1/             # API版本1
│   │   │   ├── auth.py     # 认证相关API
│   │   │   ├── users.py    # 用户管理API
│   │   │   └── tasks.py    # 任务管理API
│   │   └── deps.py         # API依赖项
│   ├── core/               # 核心配置
│   │   ├── config.py       # 应用配置
│   │   ├── security.py     # 安全相关
│   │   └── logging.py      # 日志配置
│   ├── db/                 # 数据库相关
│   │   ├── mongodb.py      # MongoDB连接
│   │   └── redis.py        # Redis连接
│   ├── models/             # 数据模型
│   │   ├── user.py         # 用户模型
│   │   ├── task.py         # 任务模型
│   │   └── dramatiq_task.py # Dramatiq任务模型
│   ├── schemas/            # Pydantic模式
│   │   ├── user.py         # 用户相关模式
│   │   ├── task.py         # 任务相关模式
│   │   └── common.py       # 通用模式
│   ├── services/           # 业务服务
│   │   ├── user.py         # 用户服务
│   │   ├── task.py         # 任务服务
│   │   └── image.py        # 图片生成服务
│   ├── crud/               # 数据库操作
│   │   ├── base.py         # 基础CRUD操作
│   │   ├── user.py         # 用户CRUD
│   │   └── task.py         # 任务CRUD
│   ├── utils/              # 工具函数
│   │   ├── make_image.py   # 图片生成工具
│   │   └── common.py       # 通用工具
│   ├── dramatiq/           # Dramatiq任务
│   │   ├── broker.py       # 消息代理配置
│   │   └── tasks.py        # 任务定义
│   └── main.py             # 应用入口
├── docs/                   # 文档
├── dramatiq_worker.py      # Dramatiq工作进程
└── requirements.txt        # 依赖项
```

## 初始用户

系统初始化时会创建一个管理员用户：

- **邮箱**：admin@example.com
- **密码**：admin123

## 快速开始

### 环境要求

- Python 3.11+
- MongoDB
- Redis

### 安装依赖

```bash
# 安装依赖
pip install -r requirements.txt
```

### 配置环境变量

复制 `.env.example` 到 `.env` 并根据需要修改配置。

### 初始化数据库

```bash
# Windows
init_db.bat

# Linux/Mac
python app/db/init_db.py
```

### 启动服务

```bash
# 启动 Web 服务
# Windows
start_web.bat

# Linux/Mac
uvicorn app.main:app --reload

# 启动 Dramatiq Worker
# Windows
start_worker.bat

# Linux/Mac
python dramatiq_worker.py --processes 2 app.dramatiq.tasks

# 启动定时任务调度器
# Windows
start_scheduler.bat

# Linux/Mac
python dramatiq_worker.py --scheduler
```

服务将在 http://localhost:8000 上运行，API 文档可在 http://localhost:8000/docs 访问。

## API 文档

API 文档可在 http://localhost:8000/docs 访问。

### 主要API端点

- **认证**
  - `POST /api/v1/auth/login` - 获取访问令牌

- **用户管理**
  - `GET /api/v1/users/me` - 获取当前用户信息
  - `GET /api/v1/users/{user_id}` - 获取用户信息
  - `GET /api/v1/users/` - 获取用户列表
  - `POST /api/v1/users/` - 创建用户
  - `PUT /api/v1/users/{user_id}` - 更新用户信息
  - `DELETE /api/v1/users/{user_id}` - 删除用户

- **任务管理**
  - `POST /api/v1/tasks/` - 创建任务
  - `GET /api/v1/tasks/` - 获取任务列表
  - `GET /api/v1/tasks/{task_id}` - 获取任务详情
  - `POST /api/v1/tasks/{task_id}/cancel` - 取消任务
  - `DELETE /api/v1/tasks/{task_id}` - 删除任务


