@echo off
chcp 65001 >nul
echo Smart Note Collector - Context Menu Uninstaller
echo ===============================================
echo.

REM Check administrator privileges
net session >nul 2>&1
if %errorlevel% neq 0 (
    echo ERROR: Administrator privileges required to modify registry
    echo Please right-click this file and select "Run as administrator"
    pause
    exit /b 1
)

echo Uninstalling context menu...

REM Import uninstall registry file
regedit /s uninstall-context-menu.reg

if %errorlevel% equ 0 (
    echo SUCCESS: Context menu uninstalled successfully!
    echo All context menu items have been removed from the system.
) else (
    echo FAILED: Context menu uninstallation failed!
    echo Please check if registry file exists, or run as administrator again.
)

pause
