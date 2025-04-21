# 启动Dramatiq Worker

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

# 启动Dramatiq Worker
Write-Host "正在启动Dramatiq Worker..." -ForegroundColor Cyan
python -m scripts.dramatiq_worker --processes 2 app.dramatiq.tasks
