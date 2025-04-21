#!/bin/bash
# 初始化数据库

# 颜色定义
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo -e "${CYAN}===================================${NC}"
echo -e "${CYAN}初始化数据库${NC}"
echo -e "${CYAN}===================================${NC}"

# 检查并激活虚拟环境
if [ -f ".venv/bin/activate" ]; then
    source .venv/bin/activate
    echo -e "${GREEN}[√] 虚拟环境已激活${NC}"
else
    echo -e "${RED}[×] 虚拟环境未找到，请先运行 create_env.sh 创建虚拟环境${NC}"
    exit 1
fi

# 设置环境变量
export PYTHONPATH=$(pwd)
cd ..

# 确认是否初始化数据库
read -p "确定要初始化数据库吗？这将清除所有现有数据 (Y/N): " CONFIRM
if [[ ! $CONFIRM =~ ^[Yy]$ ]]; then
    echo -e "${YELLOW}操作已取消${NC}"
    exit 0
fi

# 初始化数据库
echo -e "${CYAN}正在初始化数据库...${NC}"
python -c "from app.db.init_db import init_db; import asyncio; asyncio.run(init_db())"

echo -e "${CYAN}===================================${NC}"
echo -e "${GREEN}[√] 数据库初始化完成！${NC}"
echo -e "${CYAN}===================================${NC}"
