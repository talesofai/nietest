# 项目启动指南

本项目包含前端和后端两个部分，下面将详细说明如何启动每个部分。

## 目录结构

```
.
├── front/            # 前端项目 (Next.js)
├── backend/          # 后端项目 (FastAPI)
└── openapi.json      # API规范文件
```

## 后端启动步骤

后端是基于FastAPI和MongoDB构建的API系统，使用了领域驱动设计(DDD)架构。

### 环境要求

- Python 3.11+
- MongoDB
- Redis (用于任务队列)

### 安装依赖

```bash
# 进入后端目录
cd backend

# 创建并激活虚拟环境
python -m venv venv

# Windows系统
.\venv\Scripts\Activate.ps1
# Linux/Mac系统
source venv/bin/activate

# 安装依赖
python -m pip install --upgrade pip
pip install -r requirements.txt
```

### 配置环境变量

```bash
# 复制示例环境变量文件并根据需要修改
cp .env.example .env
```

请根据自己的环境配置修改`.env`文件中的配置项。

### 初始化数据库

```bash
python -m app.infrastructure.database.init_db
```

系统初始化时会创建一个管理员用户：
- **邮箱**：admin@example.com
- **密码**：admin123

### 启动服务

后端服务包含三个部分，需要分别启动：

1. **Web服务**：
```bash
uvicorn app.main:app --reload
```

2. **任务队列Worker**：
```bash
python dramatiq_worker.py --processes 4 app.infrastructure.dramatiq.tasks
```

3. **定时任务调度器**：
```bash
python dramatiq_worker.py --scheduler
```

服务将在 http://localhost:8000 上运行，API文档可在 http://localhost:8000/docs 访问。

## 前端启动步骤

前端是基于Next.js构建的现代化Web应用。

### 环境要求

- Node.js 18+
- pnpm (推荐) 或 npm

### 安装依赖

```bash
# 进入前端目录
cd front

# 使用pnpm安装依赖
pnpm install
# 或使用npm
# npm install
```

### 配置环境变量

前端项目已包含基本的`.env.local`配置文件，如需修改可以编辑该文件。

### 启动开发服务器

```bash
# 启动开发服务器
pnpm dev
# 或使用npm
# npm run dev
```

前端开发服务器将在 http://localhost:3000 上运行。

### 构建生产版本

```bash
# 构建生产版本
pnpm build
# 或使用npm
# npm run build

# 启动生产服务器
pnpm start
# 或使用npm
# npm start
```

## 完整启动流程

推荐的完整启动流程如下：

1. 启动MongoDB和Redis服务（如使用Docker或本地安装）
2. 启动后端的三个组件：
   - Web服务
   - 任务队列Worker
   - 定时任务调度器
3. 启动前端开发服务器

## 问题排查

- **后端启动失败**：确保MongoDB和Redis服务已启动，且`.env`文件中的连接信息正确
- **前端启动失败**：检查Node.js版本是否兼容，以及是否正确安装了所有依赖
- **API连接错误**：确保后端服务正在运行，且前端的API基础URL配置正确

## 许可证

[MIT License](LICENSE)#