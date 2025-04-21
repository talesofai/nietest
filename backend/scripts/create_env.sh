#!/bin/bash
# 创建Python虚拟环境并安装依赖

# 颜色定义
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo -e "${CYAN}===================================${NC}"
echo -e "${CYAN}创建Python虚拟环境并安装依赖${NC}"
echo -e "${CYAN}===================================${NC}"

# 检查Python是否已安装
if command -v python3 &>/dev/null; then
    PYTHON_VERSION=$(python3 --version)
    echo -e "${GREEN}[√] 已安装Python: $PYTHON_VERSION${NC}"
else
    echo -e "${RED}[×] 未找到Python，请先安装Python 3.8或更高版本${NC}"
    exit 1
fi

# 检查虚拟环境是否已存在
if [ -d ".venv" ]; then
    read -p "虚拟环境已存在，是否重新创建？(Y/N): " OVERWRITE
    if [[ ! $OVERWRITE =~ ^[Yy]$ ]]; then
        echo -e "${YELLOW}操作已取消${NC}"
        exit 0
    fi
    
    echo -e "${YELLOW}正在删除现有虚拟环境...${NC}"
    rm -rf .venv
fi

# 创建虚拟环境
echo -e "${CYAN}正在创建虚拟环境...${NC}"
python3 -m venv .venv

# 激活虚拟环境
source .venv/bin/activate
echo -e "${GREEN}[√] 虚拟环境已创建并激活${NC}"

# 升级pip
echo -e "${CYAN}正在升级pip...${NC}"
python -m pip install --upgrade pip

# 安装依赖
echo -e "${CYAN}正在安装依赖...${NC}"
pip install -r requirements.txt

echo -e "${CYAN}===================================${NC}"
echo -e "${GREEN}[√] 虚拟环境创建完成！${NC}"
echo -e "${CYAN}===================================${NC}"
