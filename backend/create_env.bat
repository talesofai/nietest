@echo off
REM Create and setup virtual environment

echo Creating Python virtual environment...

REM Check if Python is installed
python --version > nul 2>&1
if %ERRORLEVEL% neq 0 (
    echo Python is not installed or not in PATH. Please install Python 3.8 or higher.
    exit /b 1
)

REM Create virtual environment
python -m venv .venv
if %ERRORLEVEL% neq 0 (
    echo Failed to create virtual environment. Please make sure venv module is available.
    exit /b 1
)

echo Virtual environment created successfully.

REM Activate virtual environment
call .venv\Scripts\activate.bat

REM Upgrade pip
echo Upgrading pip...
python -m pip install --upgrade pip

REM Install dependencies
echo Installing dependencies...
pip install -r requirements.txt

echo.
echo Virtual environment setup completed successfully.
echo You can now run the application using start_web.bat
echo.
