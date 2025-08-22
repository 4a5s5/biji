@echo off
echo Smart Note Collector - Context Menu Diagnostic Tool
echo ==================================================
echo.

echo 1. Checking registry entries...
echo.

echo Checking file context menu:
reg query "HKEY_CLASSES_ROOT\*\shell\SmartNoteCollector" 2>nul
if %errorlevel% equ 0 (
    echo   File context menu: FOUND
    reg query "HKEY_CLASSES_ROOT\*\shell\SmartNoteCollector" /s
) else (
    echo   File context menu: NOT FOUND
)

echo.
echo Checking directory context menu:
reg query "HKEY_CLASSES_ROOT\Directory\shell\SmartNoteCollector" 2>nul
if %errorlevel% equ 0 (
    echo   Directory context menu: FOUND
    reg query "HKEY_CLASSES_ROOT\Directory\shell\SmartNoteCollector" /s
) else (
    echo   Directory context menu: NOT FOUND
)

echo.
echo Checking desktop background context menu:
reg query "HKEY_CLASSES_ROOT\DesktopBackground\Shell\SmartNoteCollector" 2>nul
if %errorlevel% equ 0 (
    echo   Desktop background context menu: FOUND
    reg query "HKEY_CLASSES_ROOT\DesktopBackground\Shell\SmartNoteCollector" /s
) else (
    echo   Desktop background context menu: NOT FOUND
)

echo.
echo 2. Checking file paths...
echo.

set "PROJECT_PATH=C:\Users\ghc\Desktop\新建文件夹 (5)\笔记"
set "HANDLER_BAT=%PROJECT_PATH%\src\system\context-menu\context-handler.bat"
set "HANDLER_JS=%PROJECT_PATH%\src\system\context-menu\context-handler.js"

echo Project path: %PROJECT_PATH%
echo Handler batch: %HANDLER_BAT%
echo Handler script: %HANDLER_JS%

echo.
if exist "%HANDLER_BAT%" (
    echo Handler batch file: EXISTS
) else (
    echo Handler batch file: MISSING
)

if exist "%HANDLER_JS%" (
    echo Handler script file: EXISTS
) else (
    echo Handler script file: MISSING
)

echo.
echo 3. Testing handler directly...
echo.

if exist "%HANDLER_JS%" (
    echo Testing Node.js handler:
    node "%HANDLER_JS%" "test-file.txt"
) else (
    echo Cannot test handler - file missing
)

echo.
echo 4. Checking Windows Explorer process...
echo.

tasklist /FI "IMAGENAME eq explorer.exe" | find /I "explorer.exe" >nul
if %errorlevel% equ 0 (
    echo Windows Explorer: RUNNING
    echo Suggestion: Try restarting Explorer to refresh context menus
    echo Press Ctrl+Shift+Esc, find Windows Explorer, right-click and Restart
) else (
    echo Windows Explorer: NOT RUNNING
)

echo.
echo 5. Registry file content check...
echo.

set "REG_FILE=%PROJECT_PATH%\src\system\context-menu\install-context-menu.reg"
if exist "%REG_FILE%" (
    echo Registry file exists. Content preview:
    type "%REG_FILE%" | more
) else (
    echo Registry file missing: %REG_FILE%
)

echo.
echo Diagnostic complete. Press any key to exit...
pause >nul
