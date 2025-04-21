#!/bin/bash
# 启动Web服务

# 颜色定义
GREEN='\033[0;32m'
RED='\033[0;31m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# 检查并激活虚拟环境
if [ -f "venv/bin/activate" ]; then
    source venv/bin/activate
    echo -e "${GREEN}虚拟环境已激活.${NC}"
else
    echo -e "${RED}虚拟环境未找到，请先运行 create_env.sh 创建虚拟环境${NC}"
    exit 1
fi

# 设置环境变量
export PYTHONPATH=$(pwd)
cd ..

# 启动Web服务
echo -e "${CYAN}正在启动Web服务...${NC}"
uvicorn app.main:app --host 127.0.0.1 --port 8000 --reload
