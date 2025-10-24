@echo off
chcp 65001 >nul
title Smart Note Collector - 安装向导

echo.
echo ========================================
echo    Smart Note Collector 安装向导
echo ========================================
echo.

:: 检查管理员权限
net session >nul 2>&1
if %errorlevel% neq 0 (
    echo ⚠️  注意：某些功能可能需要管理员权限
    echo 建议以管理员身份运行此脚本
    echo.
)

:: 检查 Node.js
echo 🔍 检查系统环境...
node --version >nul 2>&1
if %errorlevel% neq 0 (
    echo ❌ 未检测到 Node.js
    echo.
    echo 正在打开 Node.js 下载页面...
    start https://nodejs.org/
    echo.
    echo 请下载并安装 Node.js LTS 版本后重新运行此脚本
    pause
    exit /b 1
)

echo ✅ Node.js 版本:
node --version

:: 检查 npm
npm --version >nul 2>&1
if %errorlevel% neq 0 (
    echo ❌ npm 未正确安装
    pause
    exit /b 1
)

echo ✅ npm 版本:
npm --version

:: 安装依赖
echo.
echo 📦 正在安装项目依赖...
echo 这可能需要几分钟时间，请耐心等待...
echo.

npm install
if %errorlevel% neq 0 (
    echo ❌ 依赖安装失败
    echo.
    echo 可能的解决方案：
    echo 1. 检查网络连接
    echo 2. 清除 npm 缓存：npm cache clean --force
    echo 3. 删除 node_modules 文件夹后重试
    echo.
    pause
    exit /b 1
)

echo.
echo ✅ 依赖安装完成

:: 创建桌面快捷方式（可选）
echo.
set /p create_shortcut="是否创建桌面快捷方式？(y/n): "
if /i "%create_shortcut%"=="y" (
    echo 正在创建桌面快捷方式...

    :: 获取当前目录
    set current_dir=%cd%

    :: 创建快捷方式的 VBScript
    echo Set oWS = WScript.CreateObject("WScript.Shell"^) > temp_shortcut.vbs
    echo sLinkFile = oWS.ExpandEnvironmentStrings("%%USERPROFILE%%\Desktop\Smart Note Collector.lnk"^) >> temp_shortcut.vbs
    echo Set oLink = oWS.CreateShortcut(sLinkFile^) >> temp_shortcut.vbs
    echo oLink.TargetPath = "%current_dir%\start.bat" >> temp_shortcut.vbs
    echo oLink.WorkingDirectory = "%current_dir%" >> temp_shortcut.vbs
    echo oLink.Description = "Smart Note Collector Windows 客户端" >> temp_shortcut.vbs
    echo oLink.Save >> temp_shortcut.vbs

    cscript //nologo temp_shortcut.vbs
    del temp_shortcut.vbs

    echo ✅ 桌面快捷方式已创建
)

:: 检查服务器
echo.
echo 🔍 检查服务器状态...
curl -s http://localhost:3000/api/health >nul 2>&1
if %errorlevel% neq 0 (
    echo ⚠️  服务器未在 localhost:3000 运行
    echo.
    echo 请确保您已经：
    echo 1. 启动了 Smart Note Collector 服务器
    echo 2. 服务器运行在默认端口 3000
    echo.
    echo 您也可以在应用设置中配置自定义服务器地址
) else (
    echo ✅ 服务器连接正常
)

echo.
echo ========================================
echo           安装完成！
echo ========================================
echo.
echo 使用方法：
echo 1. 双击 start.bat 启动应用
echo 2. 或使用命令：npm start
echo 3. 或通过桌面快捷方式启动（如果已创建）
echo.
echo 应用功能：
echo • 📋 自动监听剪切板变化
echo • 📝 快速创建文字笔记
echo • 📷 截图保存功能
echo • 🕷️ 网页内容爬取
echo • 🎯 系统托盘运行
echo.
echo 快捷键：
echo • Ctrl+Shift+S: 快速截图
echo • Ctrl+Shift+N: 新建笔记
echo • Ctrl+Shift+Q: 显示/隐藏窗口
echo.

set /p start_now="现在启动应用吗？(y/n): "
if /i "%start_now%"=="y" (
    echo.
    echo 🚀 正在启动 Smart Note Collector...
    start "" "start.bat"
)

echo.
echo 感谢使用 Smart Note Collector！
pause