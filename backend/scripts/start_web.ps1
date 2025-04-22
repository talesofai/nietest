# 启动Web服务

. .\venv\Scripts\Activate.ps1
Write-Host "虚拟环境已激活." -ForegroundColor Green


# 设置环境变量
$env:PYTHONPATH = $PWD
Set-Location ..

# 启动Web服务
Write-Host "正在启动Web服务..." -ForegroundColor Cyan
uvicorn app.main:app --host 127.0.0.1 --port 8000 --reload
