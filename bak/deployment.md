# 部署指南

## 概述

本文档详细描述了Backend2系统的部署方案，包括开发环境、测试环境和生产环境的部署步骤和配置。

## 系统要求

### 最低配置

- **CPU**: 4核
- **内存**: 8GB
- **存储**: 50GB SSD
- **操作系统**: Ubuntu 20.04 LTS或更高版本
- **Python**: 3.11或更高版本
- **PostgreSQL**: 14或更高版本
- **Redis**: 6或更高版本

### 推荐配置（生产环境）

- **CPU**: 8核或更多
- **内存**: 16GB或更多
- **存储**: 100GB SSD或更多
- **操作系统**: Ubuntu 22.04 LTS
- **Python**: 3.11
- **PostgreSQL**: 15
- **Redis**: 7

## 部署架构

### 单机部署

适用于开发环境和小型测试环境。

```
┌─────────────────────────────────────┐
│              单台服务器              │
│                                     │
│  ┌─────────┐  ┌─────────┐  ┌─────┐  │
│  │ API服务 │  │ Worker  │  │Redis│  │
│  └─────────┘  └─────────┘  └─────┘  │
│         │          │          │     │
│         └──────────┴──────────┘     │
│                    │                │
│              ┌──────────┐           │
│              │PostgreSQL│           │
│              └──────────┘           │
└─────────────────────────────────────┘
```

### 分布式部署

适用于生产环境和大型测试环境。

```
┌─────────────┐  ┌─────────────┐
│  API服务1   │  │  API服务2   │
└─────────────┘  └─────────────┘
       │               │
       └───────┬───────┘
               │
       ┌───────────────┐
       │  负载均衡器   │
       └───────────────┘
               │
       ┌───────────────┐
       │  Redis集群    │
       └───────────────┘
               │
┌─────────┬────┴────┬─────────┐
│         │         │         │
▼         ▼         ▼         ▼
┌─────┐  ┌─────┐  ┌─────┐  ┌─────┐
│Worker│  │Worker│  │Worker│  │Worker│
└─────┘  └─────┘  └─────┘  └─────┘
   │        │        │        │
   └────────┼────────┼────────┘
            │        │
     ┌──────┴──────┐ │
     │ PostgreSQL  │ │
     │  主服务器   │ │
     └─────────────┘ │
            │        │
            ▼        ▼
     ┌─────────────────┐
     │   PostgreSQL    │
     │   从服务器      │
     └─────────────────┘
```

## 容器化部署

系统支持使用Docker和Docker Compose进行容器化部署。

### Docker Compose配置

```yaml
version: '3.8'

services:
  # PostgreSQL数据库
  postgres:
    image: postgres:15
    environment:
      POSTGRES_USER: backend
      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD}
      POSTGRES_DB: backend
    volumes:
      - postgres_data:/var/lib/postgresql/data
    ports:
      - "5432:5432"
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U backend"]
      interval: 10s
      timeout: 5s
      retries: 5

  # Redis缓存和消息队列
  redis:
    image: redis:7
    command: redis-server --requirepass ${REDIS_PASSWORD}
    volumes:
      - redis_data:/data
    ports:
      - "6379:6379"
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 10s
      timeout: 5s
      retries: 5

  # API服务
  api:
    build:
      context: .
      dockerfile: Dockerfile.api
    environment:
      - DATABASE_URL=postgresql://backend:${POSTGRES_PASSWORD}@postgres:5432/backend
      - REDIS_URL=redis://:${REDIS_PASSWORD}@redis:6379/0
      - SECRET_KEY=${SECRET_KEY}
      - LOG_LEVEL=INFO
    ports:
      - "8000:8000"
    depends_on:
      postgres:
        condition: service_healthy
      redis:
        condition: service_healthy
    restart: always

  # 标准任务Worker
  worker-standard:
    build:
      context: .
      dockerfile: Dockerfile.worker
    environment:
      - DATABASE_URL=postgresql://backend:${POSTGRES_PASSWORD}@postgres:5432/backend
      - REDIS_URL=redis://:${REDIS_PASSWORD}@redis:6379/0
      - LOG_LEVEL=INFO
      - WORKER_QUEUE=standard_tasks
      - WORKER_PROCESSES=4
      - WORKER_THREADS=8
    depends_on:
      postgres:
        condition: service_healthy
      redis:
        condition: service_healthy
    restart: always

  # Lumina任务Worker
  worker-lumina:
    build:
      context: .
      dockerfile: Dockerfile.worker
    environment:
      - DATABASE_URL=postgresql://backend:${POSTGRES_PASSWORD}@postgres:5432/backend
      - REDIS_URL=redis://:${REDIS_PASSWORD}@redis:6379/0
      - LOG_LEVEL=INFO
      - WORKER_QUEUE=lumina_tasks
      - WORKER_PROCESSES=2
      - WORKER_THREADS=4
    depends_on:
      postgres:
        condition: service_healthy
      redis:
        condition: service_healthy
    restart: always

volumes:
  postgres_data:
  redis_data:
```

### Dockerfile.api

```dockerfile
FROM python:3.11-slim

WORKDIR /app

# 安装依赖
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# 复制应用代码
COPY . .

# 运行数据库迁移
RUN alembic upgrade head

# 启动API服务
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
```

### Dockerfile.worker

```dockerfile
FROM python:3.11-slim

WORKDIR /app

# 安装依赖
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# 复制应用代码
COPY . .

# 启动Worker
CMD dramatiq app.tasks:broker -p ${WORKER_PROCESSES:-2} -t ${WORKER_THREADS:-4} -Q ${WORKER_QUEUE:-standard_tasks}
```

## Kubernetes部署

对于大规模生产环境，系统支持使用Kubernetes进行部署。

### Kubernetes配置示例

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: backend-api
spec:
  replicas: 3
  selector:
    matchLabels:
      app: backend-api
  template:
    metadata:
      labels:
        app: backend-api
    spec:
      containers:
      - name: api
        image: backend-api:latest
        ports:
        - containerPort: 8000
        env:
        - name: DATABASE_URL
          valueFrom:
            secretKeyRef:
              name: backend-secrets
              key: database-url
        - name: REDIS_URL
          valueFrom:
            secretKeyRef:
              name: backend-secrets
              key: redis-url
        - name: SECRET_KEY
          valueFrom:
            secretKeyRef:
              name: backend-secrets
              key: secret-key
        resources:
          limits:
            cpu: "1"
            memory: "2Gi"
          requests:
            cpu: "500m"
            memory: "1Gi"
        livenessProbe:
          httpGet:
            path: /health
            port: 8000
          initialDelaySeconds: 30
          periodSeconds: 10
        readinessProbe:
          httpGet:
            path: /health
            port: 8000
          initialDelaySeconds: 5
          periodSeconds: 5
---
apiVersion: apps/v1
kind: Deployment
metadata:
  name: backend-worker-standard
spec:
  replicas: 4
  selector:
    matchLabels:
      app: backend-worker-standard
  template:
    metadata:
      labels:
        app: backend-worker-standard
    spec:
      containers:
      - name: worker
        image: backend-worker:latest
        env:
        - name: DATABASE_URL
          valueFrom:
            secretKeyRef:
              name: backend-secrets
              key: database-url
        - name: REDIS_URL
          valueFrom:
            secretKeyRef:
              name: backend-secrets
              key: redis-url
        - name: WORKER_QUEUE
          value: "standard_tasks"
        - name: WORKER_PROCESSES
          value: "4"
        - name: WORKER_THREADS
          value: "8"
        resources:
          limits:
            cpu: "2"
            memory: "4Gi"
          requests:
            cpu: "1"
            memory: "2Gi"
---
apiVersion: v1
kind: Service
metadata:
  name: backend-api
spec:
  selector:
    app: backend-api
  ports:
  - port: 80
    targetPort: 8000
  type: ClusterIP
---
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: backend-ingress
  annotations:
    nginx.ingress.kubernetes.io/ssl-redirect: "true"
spec:
  rules:
  - host: api.example.com
    http:
      paths:
      - path: /
        pathType: Prefix
        backend:
          service:
            name: backend-api
            port:
              number: 80
  tls:
  - hosts:
    - api.example.com
    secretName: api-tls-secret
```

## 环境变量配置

系统使用环境变量进行配置，主要环境变量包括：

### 基础配置

- `DEBUG`: 是否启用调试模式，生产环境应设为False
- `LOG_LEVEL`: 日志级别，可选值：DEBUG, INFO, WARNING, ERROR
- `SECRET_KEY`: 用于JWT加密的密钥
- `API_V1_STR`: API前缀，默认为/api/v1

### 数据库配置

- `DATABASE_URL`: PostgreSQL连接URL
- `DB_POOL_SIZE`: 数据库连接池大小，默认为5
- `DB_MAX_OVERFLOW`: 数据库连接池最大溢出连接数，默认为10
- `DB_POOL_TIMEOUT`: 数据库连接池超时时间，默认为30秒

### Redis配置

- `REDIS_URL`: Redis连接URL
- `REDIS_KEY_PREFIX`: Redis键前缀，默认为app:

### 任务处理配置

- `DRAMATIQ_BROKER`: Dramatiq消息代理类型，默认为redis
- `DRAMATIQ_RESULT_BACKEND`: Dramatiq结果后端类型，默认为redis
- `DRAMATIQ_RESULT_TTL`: Dramatiq结果过期时间，默认为86400秒（1天）
- `STANDARD_WORKER_PROCESSES`: 标准Worker进程数，默认为4
- `STANDARD_WORKER_THREADS`: 标准Worker线程数，默认为8
- `LUMINA_WORKER_PROCESSES`: Lumina Worker进程数，默认为2
- `LUMINA_WORKER_THREADS`: Lumina Worker线程数，默认为4

### 安全配置

- `CORS_ORIGINS`: 允许的CORS源，默认为*
- `ACCESS_TOKEN_EXPIRE_MINUTES`: 访问令牌过期时间，默认为10080分钟（7天）
- `ALGORITHM`: JWT算法，默认为HS256

## 监控和日志

### 日志配置

系统使用结构化日志，支持输出到文件、控制台和Elasticsearch。

```python
# 日志配置示例
LOGGING = {
    "version": 1,
    "disable_existing_loggers": False,
    "formatters": {
        "json": {
            "()": "pythonjsonlogger.jsonlogger.JsonFormatter",
            "fmt": "%(asctime)s %(levelname)s %(name)s %(message)s",
        },
        "standard": {
            "format": "%(asctime)s [%(levelname)s] %(name)s: %(message)s",
        },
    },
    "handlers": {
        "console": {
            "class": "logging.StreamHandler",
            "formatter": "standard",
        },
        "file": {
            "class": "logging.handlers.RotatingFileHandler",
            "filename": "logs/app.log",
            "formatter": "json",
            "maxBytes": 10485760,  # 10MB
            "backupCount": 10,
        },
    },
    "root": {
        "handlers": ["console", "file"],
        "level": os.getenv("LOG_LEVEL", "INFO"),
    },
}
```

### 监控工具

系统集成了以下监控工具：

1. **Prometheus**: 收集系统和应用指标
2. **Grafana**: 可视化监控数据
3. **Sentry**: 错误跟踪和性能监控
4. **ELK Stack**: 日志收集和分析

## 备份和恢复

### 数据库备份

```bash
# 创建PostgreSQL备份
pg_dump -U backend -d backend -F c -f backup.dump

# 恢复PostgreSQL备份
pg_restore -U backend -d backend -c backup.dump
```

### Redis备份

```bash
# 创建Redis备份
redis-cli -a ${REDIS_PASSWORD} --rdb backup.rdb

# 恢复Redis备份
# 1. 停止Redis服务
# 2. 复制backup.rdb到Redis数据目录
# 3. 重启Redis服务
```

## 安全最佳实践

1. **使用HTTPS**: 所有API通信必须使用HTTPS
2. **定期更新密钥**: 定期更新JWT密钥和其他敏感凭据
3. **最小权限原则**: 应用和数据库用户使用最小必要权限
4. **网络隔离**: 使用网络隔离保护数据库和Redis
5. **定期安全审计**: 定期进行安全审计和漏洞扫描
6. **容器安全**: 使用非root用户运行容器，定期更新基础镜像

## 故障排除

### 常见问题

1. **数据库连接失败**
   - 检查数据库URL和凭据
   - 检查数据库服务是否运行
   - 检查网络连接和防火墙设置

2. **Redis连接失败**
   - 检查Redis URL和凭据
   - 检查Redis服务是否运行
   - 检查网络连接和防火墙设置

3. **任务处理失败**
   - 检查Worker日志
   - 检查Redis连接
   - 检查任务参数和格式

### 诊断工具

1. **健康检查API**: `/health`端点提供系统组件状态
2. **日志分析**: 使用ELK Stack分析日志
3. **性能分析**: 使用Prometheus和Grafana监控性能
4. **数据库诊断**: 使用PostgreSQL内置工具诊断数据库问题

## 扩展指南

### 水平扩展

1. **API服务**: 增加API服务实例，使用负载均衡器分发请求
2. **Worker**: 增加Worker实例，处理更多任务
3. **Redis**: 使用Redis集群或Redis Sentinel提高可用性
4. **PostgreSQL**: 使用读写分离或分片提高数据库性能

### 垂直扩展

1. **增加资源**: 为服务器增加CPU、内存和存储
2. **优化配置**: 调整PostgreSQL、Redis和应用配置以充分利用资源
3. **代码优化**: 优化关键路径代码，提高性能
