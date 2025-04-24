FROM node:20-slim AS frontend-builder

# 安装pnpm
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
RUN npm install -g pnpm@9.0.5

# 复制前端代码并构建
WORKDIR /app/frontend
COPY frontend/package.json frontend/pnpm-lock.yaml ./

# 禁用husky，因为在Docker构建环境中不需要Git钩子
ENV HUSKY=0
RUN pnpm install --frozen-lockfile --ignore-scripts

COPY frontend/ ./
# 跳过prepare脚本，直接构建
RUN pnpm build

# Python后端构建阶段
FROM python:3.11-slim AS backend-builder

# 安装依赖
WORKDIR /app/backend
COPY backend/requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt

# 复制后端代码
COPY backend/ ./

# 最终镜像
FROM python:3.11-slim

# 安装Nginx
RUN apt-get update && apt-get install -y nginx && apt-get clean && rm -rf /var/lib/apt/lists/*

# 配置Nginx
COPY nginx.conf /etc/nginx/conf.d/default.conf
RUN rm /etc/nginx/sites-enabled/default

# 复制前端构建产物
COPY --from=frontend-builder /app/frontend/.next /app/frontend/.next
COPY --from=frontend-builder /app/frontend/public /app/frontend/public
COPY --from=frontend-builder /app/frontend/node_modules /app/frontend/node_modules
COPY --from=frontend-builder /app/frontend/package.json /app/frontend/package.json

# 复制后端代码和依赖
COPY --from=backend-builder /usr/local/lib/python3.11/site-packages /usr/local/lib/python3.11/site-packages
COPY --from=backend-builder /app/backend /app/backend

# 设置工作目录
WORKDIR /app

# 添加启动脚本
COPY start.sh /app/start.sh
RUN chmod +x /app/start.sh

# 暴露端口
EXPOSE 80

# 设置环境变量
ENV PYTHONPATH=/app/backend
ENV NEXT_PUBLIC_API_BASE_URL=http://localhost/api/v1

# 启动服务
CMD ["/app/start.sh"]
