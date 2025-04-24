#!/bin/bash
set -e

# 启动Nginx
echo "Starting Nginx..."
service nginx start

# 启动后端服务
echo "Starting backend service..."
cd /app/backend
nohup python -m uvicorn app.main:app --host 0.0.0.0 --port 8000 &

# 启动前端服务
echo "Starting frontend service..."
cd /app/frontend
nohup node_modules/.bin/next start -p 3000 &

# 等待所有服务启动
echo "Waiting for services to start..."
sleep 5

# 保持容器运行
echo "All services started. Container is now running."
tail -f /dev/null
