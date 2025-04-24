# Docker 部署指南

本项目提供了Docker部署方案，可以通过单一Docker镜像同时运行前端和后端服务。

## 镜像说明

该Docker镜像包含：
- 前端应用（Next.js）
- 后端API（FastAPI）
- Nginx作为反向代理

## 环境变量配置

镜像支持通过环境变量进行配置，主要环境变量包括：

### 后端环境变量

- `MONGODB_URL`: MongoDB连接URL
- `REDIS_URL`: Redis连接URL
- `SECRET_KEY`: JWT密钥
- `DB_NAME`: MongoDB数据库名称
- `LOG_LEVEL`: 日志级别
- `CACHE_ENABLED`: 是否启用缓存
- `ADMIN_EMAIL`: 管理员邮箱
- `ADMIN_PASSWORD`: 管理员密码

### 前端环境变量

- `NEXT_PUBLIC_API_BASE_URL`: API基础URL，默认为`http://localhost/api/v1`

## 使用方法

### 本地运行

```bash
docker run -d \
  -p 80:80 \
  -e MONGODB_URL=mongodb://your-mongodb-host:27017 \
  -e REDIS_URL=redis://your-redis-host:6379/0 \
  -e SECRET_KEY=your-secret-key \
  -e DB_NAME=your-db-name \
  --name app-container \
  your-registry/your-image-name:latest
```

### 使用Docker Compose

创建`docker-compose.yml`文件：

```yaml
version: '3'

services:
  app:
    image: your-registry/your-image-name:latest
    ports:
      - "80:80"
    environment:
      - MONGODB_URL=mongodb://mongo:27017
      - REDIS_URL=redis://redis:6379/0
      - SECRET_KEY=your-secret-key
      - DB_NAME=your-db-name
    depends_on:
      - mongo
      - redis

  mongo:
    image: mongo:latest
    volumes:
      - mongo-data:/data/db

  redis:
    image: redis:latest
    volumes:
      - redis-data:/data

volumes:
  mongo-data:
  redis-data:
```

然后运行：

```bash
docker-compose up -d
```

## 访问服务

- 前端应用: http://localhost/
- 后端API: http://localhost/api/
- API文档: http://localhost/docs
- 健康检查: http://localhost/health

## GitHub Actions自动构建

本项目配置了GitHub Actions自动构建和推送Docker镜像到阿里云容器镜像服务。

需要在GitHub仓库中配置以下Secrets：

- `ALIYUN_REGISTRY`: 阿里云容器镜像服务地址
- `ALIYUN_USERNAME`: 阿里云容器镜像服务用户名
- `ALIYUN_PASSWORD`: 阿里云容器镜像服务密码
- `ALIYUN_NAMESPACE`: 阿里云容器镜像服务命名空间
- `ALIYUN_IMAGE_NAME`: 镜像名称

每次推送到main或master分支时，GitHub Actions会自动构建并推送镜像。
