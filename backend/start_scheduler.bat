@echo off
REM Start Task Scheduler

REM Activate virtual environment if it exists
if exist ".venv\Scripts\activate.bat" (
    call .venv\Scripts\activate.bat
) else (
    echo Virtual environment not found. Please create it first with create_env.bat
    exit /b 1
)

REM Set environment variables
set PYTHONPATH=%cd%

REM Start Task Scheduler
python dramatiq_worker.py --scheduler
