@echo off
echo Smart Note Collector - 智能笔记收集器
echo =====================================
echo.

echo 正在检查Node.js...
node --version >nul 2>&1
if %errorlevel% neq 0 (
    echo 错误: 未找到Node.js，请先安装Node.js
    echo 下载地址: https://nodejs.org/
    pause
    exit /b 1
)

echo Node.js版本:
node --version

echo.
echo 正在检查依赖...
if not exist "node_modules" (
    echo 正在安装依赖...
    npm install
    if %errorlevel% neq 0 (
        echo 警告: 依赖安装失败，尝试继续运行...
    )
)

echo.
echo 正在启动服务器...
echo 请在浏览器中访问: http://localhost:3000
echo 按 Ctrl+C 停止服务器
echo.

node src/backend/server.js

pause
