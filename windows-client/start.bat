@echo off
chcp 65001 >nul
title Smart Note Collector - Windows Client

echo.
echo ========================================
echo    Smart Note Collector Windows 客户端
echo ========================================
echo.

:: 检查 Node.js 是否已安装
node --version >nul 2>&1
if %errorlevel% neq 0 (
    echo ❌ 错误：未检测到 Node.js
    echo 请先安装 Node.js: https://nodejs.org/
    echo.
    pause
    exit /b 1
)

echo ✅ Node.js 已安装
node --version

:: 检查是否存在 node_modules
if not exist "node_modules" (
    echo.
    echo 📦 首次运行，正在安装依赖...
    echo.
    npm install
    if %errorlevel% neq 0 (
        echo ❌ 依赖安装失败
        pause
        exit /b 1
    )
    echo ✅ 依赖安装完成
)

:: 检查服务器是否运行
echo.
echo 🔍 检查服务器状态...
curl -s http://localhost:3000/api/health >nul 2>&1
if %errorlevel% neq 0 (
    echo ⚠️  警告：服务器未运行在 localhost:3000
    echo 请确保 Smart Note Collector 服务器已启动
    echo 或在应用设置中配置正确的服务器地址
    echo.
    echo 继续启动客户端...
) else (
    echo ✅ 服务器连接正常
)

echo.
echo 🚀 启动 Smart Note Collector Windows 客户端...
echo.

:: 启动应用
npm start

if %errorlevel% neq 0 (
    echo.
    echo ❌ 应用启动失败
    pause
)