# 启动Web服务

# 检查并激活虚拟环境
if (Test-Path "venv\Scripts\Activate.ps1") {
    . .\venv\Scripts\Activate.ps1
    Write-Host "虚拟环境已激活." -ForegroundColor Green
} else {
    Write-Host "虚拟环境未找到，请先运行 create_env.ps1 创建虚拟环境" -ForegroundColor Red
    exit 1
}

# 设置环境变量
$env:PYTHONPATH = $PWD
Set-Location ..

# 启动Web服务
Write-Host "正在启动Web服务..." -ForegroundColor Cyan
uvicorn app.main:app --host 127.0.0.1 --port 8000 --reload
