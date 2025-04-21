# 后端脚本

本目录包含用于管理和运行后端服务的脚本。提供了 PowerShell (.ps1) 和 Shell (.sh) 脚本，分别支持 Windows 和 Linux/macOS 环境。

## 环境管理脚本

- `create_env.ps1` / `create_env.sh` - 创建Python虚拟环境并安装依赖
- `clean_env.ps1` / `clean_env.sh` - 清理Python虚拟环境

## 数据库脚本

- `init_db.ps1` / `init_db.sh` - 初始化数据库，创建必要的表和初始数据

## 启动脚本

- `start_web.ps1` / `start_web.sh` - 启动Web服务
- `start_all.ps1` / `start_all.sh` - 一键启动所有服务（Web服务、Worker和调度器）

## 工具脚本

- `check_queues.py` - 检查Dramatiq队列状态
- `clear_queues.py` - 清空Dramatiq队列
- `dramatiq_worker.py` - Dramatiq Worker启动脚本

## 使用方法

### Windows 环境

#### 首次使用

1. 打开 PowerShell 窗口，进入 `backend\scripts` 目录
2. 运行 `./create_env.ps1` 创建虚拟环境并安装依赖
3. 运行 `./init_db.ps1` 初始化数据库
4. 运行 `./start_all.ps1` 启动所有服务

#### 日常使用

- 如果只需要启动Web服务，运行 `./start_web.ps1`
- 如果需要启动所有服务，运行 `./start_all.ps1`

#### 工具使用

- 检查队列状态：`python -m scripts.check_queues`
- 清空队列：`python -m scripts.clear_queues`

### Linux/macOS 环境

#### 首次使用

1. 打开终端，进入 `backend/scripts` 目录
2. 运行 `chmod +x *.sh` 设置脚本执行权限
3. 运行 `./create_env.sh` 创建虚拟环境并安装依赖
4. 运行 `./init_db.sh` 初始化数据库
5. 运行 `./start_all.sh` 启动所有服务

#### 日常使用

- 如果只需要启动Web服务，运行 `./start_web.sh`
- 如果需要启动所有服务，运行 `./start_all.sh`

#### 工具使用

- 检查队列状态：`python -m scripts.check_queues`
- 清空队列：`python -m scripts.clear_queues`

### 注意事项

- 所有脚本应该在 `backend/scripts` 目录下运行
- `start_all.ps1` / `start_all.sh` 会在前台运行Web服务，在后台运行Worker和调度器
- 关闭 `start_all.ps1` / `start_all.sh` 窗口时，会询问是否关闭所有后台服务
- 日志文件保存在 `backend/logs` 目录下
