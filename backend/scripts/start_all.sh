#!/bin/bash
# 启动所有后端服务和任务
# 此脚本将启动Web服务、Worker和调度器

# 颜色定义
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo -e "${CYAN}===================================${NC}"
echo -e "${CYAN}启动所有后端服务和任务${NC}"
echo -e "${CYAN}===================================${NC}"

# 检查并激活虚拟环境
if [ -f "venv/bin/activate" ]; then
    source venv/bin/activate
    echo -e "${GREEN}[√] 虚拟环境已激活${NC}"
else
    echo -e "${RED}[×] 虚拟环境未找到，请先运行 create_env.sh 创建虚拟环境${NC}"
    exit 1
fi

# 设置环境变量
export PYTHONPATH=$(pwd)
cd ..
echo -e "${GREEN}[√] 工作目录已设置为: $(pwd)${NC}"

# 创建日志目录
if [ ! -d "logs" ]; then
    mkdir -p logs
fi
echo -e "${GREEN}[√] 日志目录已创建${NC}"

# 启动调度器（后台运行）
echo ""
echo -e "${CYAN}===================================${NC}"
echo -e "${CYAN}正在启动任务调度器...${NC}"
echo -e "${CYAN}===================================${NC}"
python -m scripts.dramatiq_worker --scheduler > logs/scheduler.log 2>&1 &
SCHEDULER_PID=$!
echo -e "${GREEN}[√] 任务调度器已在后台启动 (PID: $SCHEDULER_PID)${NC}"

# 启动Worker（后台运行）
echo ""
echo -e "${CYAN}===================================${NC}"
echo -e "${CYAN}正在启动Dramatiq Worker...${NC}"
echo -e "${CYAN}===================================${NC}"
python -m scripts.dramatiq_worker --processes 2 app.dramatiq.tasks > logs/worker.log 2>&1 &
WORKER_PID=$!
echo -e "${GREEN}[√] Dramatiq Worker已在后台启动 (PID: $WORKER_PID)${NC}"

# 等待几秒钟，确保Worker和调度器已经启动
sleep 3

# 启动Web服务（前台运行）
echo ""
echo -e "${CYAN}===================================${NC}"
echo -e "${CYAN}正在启动Web服务...${NC}"
echo -e "${CYAN}===================================${NC}"
echo -e "${YELLOW}[!] Web服务将在前台运行，关闭此窗口将停止所有服务${NC}"
echo -e "${YELLOW}[!] 日志将显示在此窗口中${NC}"
echo -e "${YELLOW}[!] 按Ctrl+C可以停止Web服务${NC}"
echo -e "${CYAN}===================================${NC}"
echo ""

# 捕获SIGINT信号（Ctrl+C）
trap cleanup SIGINT SIGTERM

# 清理函数
cleanup() {
    echo ""
    echo -e "${CYAN}===================================${NC}"
    echo -e "${CYAN}Web服务已停止${NC}"
    echo -e "${CYAN}===================================${NC}"
    
    read -p "是否要关闭所有后台服务？(Y/N): " CLOSE_ALL
    
    if [[ $CLOSE_ALL =~ ^[Yy]$ ]]; then
        echo -e "${YELLOW}正在关闭所有后台服务...${NC}"
        kill $SCHEDULER_PID 2>/dev/null
        kill $WORKER_PID 2>/dev/null
        echo -e "${GREEN}[√] 所有服务已关闭${NC}"
    else
        echo -e "${YELLOW}[!] 后台服务仍在运行，您可以通过以下命令查看和停止它们:${NC}"
        echo -e "${YELLOW}    ps aux | grep dramatiq_worker${NC}"
        echo -e "${YELLOW}    kill <PID>${NC}"
    fi
    
    echo ""
    echo -e "${CYAN}===================================${NC}"
    echo -e "${CYAN}感谢使用！${NC}"
    echo -e "${CYAN}===================================${NC}"
    
    exit 0
}

# 启动Web服务
uvicorn app.main:app --host 127.0.0.1 --port 8000 --reload

# 如果Web服务自然退出，也执行清理
cleanup
