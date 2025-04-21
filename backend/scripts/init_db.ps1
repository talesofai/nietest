# 初始化数据库

Write-Host "===================================" -ForegroundColor Cyan
Write-Host "初始化数据库" -ForegroundColor Cyan
Write-Host "===================================" -ForegroundColor Cyan

# 检查并激活虚拟环境
if (Test-Path ".venv\Scripts\Activate.ps1") {
    . .\.venv\Scripts\Activate.ps1
    Write-Host "[√] 虚拟环境已激活" -ForegroundColor Green
} else {
    Write-Host "[×] 虚拟环境未找到，请先运行 create_env.ps1 创建虚拟环境" -ForegroundColor Red
    exit 1
}

# 设置环境变量
$env:PYTHONPATH = $PWD
Set-Location ..

# 确认是否初始化数据库
$confirm = Read-Host "确定要初始化数据库吗？这将清除所有现有数据 (Y/N)"
if ($confirm -ne "Y" -and $confirm -ne "y") {
    Write-Host "操作已取消" -ForegroundColor Yellow
    exit 0
}

# 初始化数据库
Write-Host "正在初始化数据库..." -ForegroundColor Cyan
python -c "from app.db.init_db import init_db; import asyncio; asyncio.run(init_db())"

Write-Host "===================================" -ForegroundColor Cyan
Write-Host "[√] 数据库初始化完成！" -ForegroundColor Green
Write-Host "===================================" -ForegroundColor Cyan
