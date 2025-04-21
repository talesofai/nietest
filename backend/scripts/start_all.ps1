# 启动所有后端服务和任务
# 此脚本将启动Web服务、Worker和调度器

Write-Host "===================================" -ForegroundColor Cyan
Write-Host "启动所有后端服务和任务" -ForegroundColor Cyan
Write-Host "===================================" -ForegroundColor Cyan

# 检查并激活虚拟环境
if (Test-Path "venv\Scripts\Activate.ps1") {
    . .\venv\Scripts\Activate.ps1
    Write-Host "[√] 虚拟环境已激活" -ForegroundColor Green
} else {
    Write-Host "[×] 虚拟环境未找到，请先运行 create_env.ps1 创建虚拟环境" -ForegroundColor Red
    exit 1
}

# 设置环境变量
$env:PYTHONPATH = $PWD
Set-Location ..
Write-Host "[√] 工作目录已设置为: $PWD" -ForegroundColor Green

# 创建日志目录
if (-not (Test-Path "logs")) {
    New-Item -ItemType Directory -Path "logs" | Out-Null
}
Write-Host "[√] 日志目录已创建" -ForegroundColor Green

# 启动调度器（后台运行）
Write-Host ""
Write-Host "===================================" -ForegroundColor Cyan
Write-Host "正在启动任务调度器..." -ForegroundColor Cyan
Write-Host "===================================" -ForegroundColor Cyan
$schedulerJob = Start-Job -ScriptBlock {
    Set-Location $using:PWD
    python -m scripts.dramatiq_worker --scheduler
}
Write-Host "[√] 任务调度器已在后台启动 (JobId: $($schedulerJob.Id))" -ForegroundColor Green

# 启动Worker（后台运行）
Write-Host ""
Write-Host "===================================" -ForegroundColor Cyan
Write-Host "正在启动Dramatiq Worker..." -ForegroundColor Cyan
Write-Host "===================================" -ForegroundColor Cyan
$workerJob = Start-Job -ScriptBlock {
    Set-Location $using:PWD
    python -m scripts.dramatiq_worker --processes 2 app.dramatiq.tasks
}
Write-Host "[√] Dramatiq Worker已在后台启动 (JobId: $($workerJob.Id))" -ForegroundColor Green

# 等待几秒钟，确保Worker和调度器已经启动
Start-Sleep -Seconds 3

# 启动Web服务（前台运行）
Write-Host ""
Write-Host "===================================" -ForegroundColor Cyan
Write-Host "正在启动Web服务..." -ForegroundColor Cyan
Write-Host "===================================" -ForegroundColor Cyan
Write-Host "[!] Web服务将在前台运行，关闭此窗口将停止所有服务" -ForegroundColor Yellow
Write-Host "[!] 日志将显示在此窗口中" -ForegroundColor Yellow
Write-Host "[!] 按Ctrl+C可以停止Web服务" -ForegroundColor Yellow
Write-Host "===================================" -ForegroundColor Cyan
Write-Host ""

try {
    uvicorn app.main:app --host 127.0.0.1 --port 8000 --reload
} catch {
    Write-Host "Web服务已停止: $_" -ForegroundColor Red
} finally {
    # 如果Web服务停止，询问是否要关闭所有服务
    Write-Host ""
    Write-Host "===================================" -ForegroundColor Cyan
    Write-Host "Web服务已停止" -ForegroundColor Cyan
    Write-Host "===================================" -ForegroundColor Cyan
    $closeAll = Read-Host "是否要关闭所有后台服务？(Y/N)"

    if ($closeAll -eq "Y" -or $closeAll -eq "y") {
        Write-Host "正在关闭所有后台服务..." -ForegroundColor Yellow
        Stop-Job -Job $schedulerJob
        Stop-Job -Job $workerJob
        Remove-Job -Job $schedulerJob
        Remove-Job -Job $workerJob
        Write-Host "[√] 所有服务已关闭" -ForegroundColor Green
    } else {
        Write-Host "[!] 后台服务仍在运行，您可以通过以下命令查看和停止它们:" -ForegroundColor Yellow
        Write-Host "    Get-Job | Format-Table" -ForegroundColor Yellow
        Write-Host "    Stop-Job -Id <JobId>" -ForegroundColor Yellow
        Write-Host "    Remove-Job -Id <JobId>" -ForegroundColor Yellow
    }

    Write-Host ""
    Write-Host "===================================" -ForegroundColor Cyan
    Write-Host "感谢使用！" -ForegroundColor Cyan
    Write-Host "===================================" -ForegroundColor Cyan
}
