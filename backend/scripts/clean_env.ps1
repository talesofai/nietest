# 清理Python虚拟环境

Write-Host "===================================" -ForegroundColor Cyan
Write-Host "清理Python虚拟环境" -ForegroundColor Cyan
Write-Host "===================================" -ForegroundColor Cyan

# 检查虚拟环境是否存在
if (-not (Test-Path ".venv")) {
    Write-Host "[!] 虚拟环境不存在，无需清理" -ForegroundColor Yellow
    exit 0
}

# 确认是否删除
$confirm = Read-Host "确定要删除虚拟环境吗？(Y/N)"
if ($confirm -ne "Y" -and $confirm -ne "y") {
    Write-Host "操作已取消" -ForegroundColor Yellow
    exit 0
}

# 删除虚拟环境
Write-Host "正在删除虚拟环境..." -ForegroundColor Cyan
Remove-Item -Recurse -Force .venv

Write-Host "===================================" -ForegroundColor Cyan
Write-Host "[√] 虚拟环境已清理完成！" -ForegroundColor Green
Write-Host "===================================" -ForegroundColor Cyan
