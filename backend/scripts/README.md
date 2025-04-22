# 后端脚本

本目录包含用于管理和运行后端服务的脚本。提供了 PowerShell (.ps1) 和 Shell (.sh) 脚本，分别支持 Windows 和 Linux/macOS 环境。

## 环境管理脚本

- `create_env.ps1` / `create_env.sh` - 创建Python虚拟环境并安装依赖
- `clean_env.ps1` / `clean_env.sh` - 清理Python虚拟环境

## 数据库脚本

- `init_db.ps1` / `init_db.sh` - 初始化数据库，创建必要的表和初始数据

## 启动脚本

- `start_web.ps1` / `start_web.sh` - 启动Web服务

注意：`start_all.ps1` / `start_all.sh` 脚本已过时，现在只需要启动Web服务即可，任务执行器会自动初始化。

## 工具脚本

以下脚本已过时，仅供参考：

- `check_queues.py` - (已过时) 检查Redis中的队列状态
- `clear_queues.py` - (已过时) 清空Redis中的队列
- `dramatiq_worker.py` - (已过时) 旧版任务处理脚本

## 使用方法

### Windows 环境

#### 首次使用

1. 打开 PowerShell 窗口，进入 `backend\scripts` 目录
2. 运行 `./create_env.ps1` 创建虚拟环境并安装依赖
3. 运行 `./init_db.ps1` 初始化数据库
4. 运行 `./start_web.ps1` 启动Web服务

#### 日常使用

- 启动Web服务：运行 `./start_web.ps1`

### Linux/macOS 环境

#### 首次使用

1. 打开终端，进入 `backend/scripts` 目录
2. 运行 `chmod +x *.sh` 设置脚本执行权限
3. 运行 `./create_env.sh` 创建虚拟环境并安装依赖
4. 运行 `./init_db.sh` 初始化数据库
5. 运行 `./start_web.sh` 启动Web服务

#### 日常使用

- 启动Web服务：运行 `./start_web.sh`

### 注意事项

- 所有脚本应该在 `backend/scripts` 目录下运行
- Web服务启动后会自动初始化内置的任务执行器，无需单独启动其他组件
- 日志文件保存在 `backend/logs` 目录下
