@echo off
REM Clean virtual environment

echo This will delete the virtual environment (.venv directory).
echo All installed packages will be removed.
echo.

set /p CONFIRM=Are you sure you want to continue? (Y/N): 

if /i "%CONFIRM%" neq "Y" (
    echo Operation cancelled.
    exit /b 0
)

echo.
echo Removing virtual environment...

REM Deactivate virtual environment if active
if defined VIRTUAL_ENV (
    call deactivate
)

REM Remove virtual environment directory
if exist .venv (
    rmdir /s /q .venv
    if %ERRORLEVEL% neq 0 (
        echo Failed to remove virtual environment.
        exit /b 1
    )
    echo Virtual environment removed successfully.
) else (
    echo Virtual environment not found.
)

echo.
echo Cleanup completed.
echo.
