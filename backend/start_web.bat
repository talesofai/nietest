@echo off
REM Start Web Service

REM Activate virtual environment if it exists
if exist ".venv\Scripts\activate.bat" (
    call .venv\Scripts\activate.bat
    echo Virtual environment activated.
) else (
    echo Virtual environment not found. Please create it first with create_env.bat
    exit /b 1
)

REM Set environment variables
set PYTHONPATH=%cd%

REM Start Web Service
uvicorn app.main:app --host 127.0.0.1 --port 8000 --reload
