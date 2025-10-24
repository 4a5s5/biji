@echo off
chcp 65001 >nul
echo Smart Note Collector - Context Menu Installer
echo =============================================
echo.

REM Check administrator privileges
net session >nul 2>&1
if %errorlevel% neq 0 (
    echo ERROR: Administrator privileges required to modify registry
    echo Please right-click this file and select "Run as administrator"
    pause
    exit /b 1
)

echo Installing context menu...

REM Import registry file
regedit /s install-context-menu.reg

if %errorlevel% equ 0 (
    echo SUCCESS: Context menu installed successfully!
    echo.
    echo You can now right-click anywhere and select "Add to Notes" to quickly collect content.
    echo.
    echo Notes:
    echo - Make sure Smart Note Collector server is running (http://localhost:3000)
    echo - Select text content before using the context menu
    echo.
) else (
    echo FAILED: Context menu installation failed!
    echo Please check if registry file exists, or run as administrator again.
)

pause
