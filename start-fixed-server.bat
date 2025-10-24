@echo off
echo ========================================
echo 启动修复版服务器
echo ========================================

REM 检查并停止占用8964端口的进程
echo.
echo 检查端口8964...
for /f "tokens=5" %%a in ('netstat -aon ^| findstr :8964 ^| findstr LISTENING') do (
    echo 发现进程 PID: %%a 占用端口8964
    echo 正在停止进程...
    taskkill /F /PID %%a >nul 2>&1
    echo 进程已停止
)

REM 等待端口释放
timeout /t 2 /nobreak >nul

REM 启动新服务器
echo.
echo 启动修复版服务器...
echo.
start cmd /k "node full-server-fixed.js"

REM 等待服务器启动
echo 等待服务器启动...
timeout /t 5 /nobreak >nul

REM 运行测试
echo.
echo ========================================
echo 运行测试套件
echo ========================================
echo.
node test-fixed-server.js

echo.
echo ========================================
echo 测试完成！
echo ========================================
echo.
echo 如果测试全部通过，你可以：
echo 1. 备份原来的 full-server.js 为 full-server-backup.js
echo 2. 将 full-server-fixed.js 重命名为 full-server.js
echo 3. 重启Docker容器或服务
echo.
pause
