# 创建Python虚拟环境并安装依赖

Write-Host "===================================" -ForegroundColor Cyan
Write-Host "创建Python虚拟环境并安装依赖" -ForegroundColor Cyan
Write-Host "===================================" -ForegroundColor Cyan

# 检查Python是否已安装
try {
    $pythonVersion = python --version
    Write-Host "[√] 已安装Python: $pythonVersion" -ForegroundColor Green
} catch {
    Write-Host "[×] 未找到Python，请先安装Python 3.8或更高版本" -ForegroundColor Red
    exit 1
}

# 检查虚拟环境是否已存在
if (Test-Path ".venv") {
    $overwrite = Read-Host "虚拟环境已存在，是否重新创建？(Y/N)"
    if ($overwrite -ne "Y" -and $overwrite -ne "y") {
        Write-Host "操作已取消" -ForegroundColor Yellow
        exit 0
    }
    
    Write-Host "正在删除现有虚拟环境..." -ForegroundColor Yellow
    Remove-Item -Recurse -Force .venv
}

# 创建虚拟环境
Write-Host "正在创建虚拟环境..." -ForegroundColor Cyan
python -m venv .venv

# 激活虚拟环境
. .\.venv\Scripts\Activate.ps1
Write-Host "[√] 虚拟环境已创建并激活" -ForegroundColor Green

# 升级pip
Write-Host "正在升级pip..." -ForegroundColor Cyan
python -m pip install --upgrade pip

# 安装依赖
Write-Host "正在安装依赖..." -ForegroundColor Cyan
pip install -r requirements.txt

Write-Host "===================================" -ForegroundColor Cyan
Write-Host "[√] 虚拟环境创建完成！" -ForegroundColor Green
Write-Host "===================================" -ForegroundColor Cyan
