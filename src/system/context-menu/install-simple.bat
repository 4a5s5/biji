@echo off
echo Smart Note Collector - Context Menu Installer
echo =============================================
echo.

REM Check admin privileges
net session >nul 2>&1
if %errorlevel% neq 0 (
    echo ERROR: Need administrator privileges
    echo Right-click this file and select "Run as administrator"
    pause
    exit /b 1
)

echo Installing context menu...
regedit /s install-context-menu.reg

if %errorlevel% equ 0 (
    echo SUCCESS: Context menu installed!
    echo You can now right-click and select "Add to Notes"
    echo Make sure the server is running at http://localhost:3000
) else (
    echo FAILED: Installation failed
    echo Check if registry file exists
)

echo.
pause
