#!/bin/bash
# 清理Python虚拟环境

# 颜色定义
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

echo -e "${CYAN}===================================${NC}"
echo -e "${CYAN}清理Python虚拟环境${NC}"
echo -e "${CYAN}===================================${NC}"

# 检查虚拟环境是否存在
if [ ! -d ".venv" ]; then
    echo -e "${YELLOW}[!] 虚拟环境不存在，无需清理${NC}"
    exit 0
fi

# 确认是否删除
read -p "确定要删除虚拟环境吗？(Y/N): " CONFIRM
if [[ ! $CONFIRM =~ ^[Yy]$ ]]; then
    echo -e "${YELLOW}操作已取消${NC}"
    exit 0
fi

# 删除虚拟环境
echo -e "${CYAN}正在删除虚拟环境...${NC}"
rm -rf .venv

echo -e "${CYAN}===================================${NC}"
echo -e "${GREEN}[√] 虚拟环境已清理完成！${NC}"
echo -e "${CYAN}===================================${NC}"
