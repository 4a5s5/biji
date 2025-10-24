@echo off
chcp 65001 >nul
title Smart Note Collector - 修复安装问题

echo.
echo ========================================
echo    Smart Note Collector 安装修复工具
echo ========================================
echo.

echo 🔧 正在修复npm安装问题...
echo.

REM 1. 强制删除node_modules文件夹
echo [步骤1] 清理旧的node_modules文件夹...
if exist "node_modules" (
    echo 正在删除node_modules文件夹...
    rmdir /s /q "node_modules" 2>nul
    if exist "node_modules" (
        echo ⚠️  部分文件无法删除，尝试使用管理员权限...
        powershell -Command "Remove-Item -Path 'node_modules' -Recurse -Force -ErrorAction SilentlyContinue"
    )
    echo ✅ node_modules已清理
) else (
    echo ✅ node_modules不存在，跳过
)

REM 2. 删除package-lock.json（如果存在）
echo.
echo [步骤2] 清理package-lock.json...
if exist "package-lock.json" (
    del "package-lock.json"
    echo ✅ package-lock.json已删除
) else (
    echo ✅ package-lock.json不存在，跳过
)

REM 3. 清理npm缓存
echo.
echo [步骤3] 清理npm缓存...
npm cache clean --force
echo ✅ npm缓存已清理

REM 4. 验证package.json内容
echo.
echo [步骤4] 验证package.json内容...
findstr /i "node-screenshots" package.json >nul 2>&1
if errorlevel 1 (
    echo ✅ package.json中未发现问题依赖
) else (
    echo ❌ package.json中仍包含问题依赖，正在修复...
    goto fix_package_json
)

goto install_deps

:fix_package_json
echo 正在修复package.json...
REM 备份原文件
copy package.json package.json.backup >nul

REM 创建新的package.json
echo {> package.json.new
echo   "name": "smart-note-collector-windows",>> package.json.new
echo   "version": "1.0.0",>> package.json.new
echo   "description": "Smart Note Collector Windows客户端 - 包含剪切板监听和Chrome扩展所有功能",>> package.json.new
echo   "main": "src/main.js",>> package.json.new
echo   "scripts": {>> package.json.new
echo     "start": "electron .",>> package.json.new
echo     "dev": "electron . --dev",>> package.json.new
echo     "build": "electron-builder",>> package.json.new
echo     "build:win": "electron-builder --win",>> package.json.new
echo     "dist": "electron-builder --publish=never",>> package.json.new
echo     "pack": "electron-builder --dir">> package.json.new
echo   },>> package.json.new
echo   "build": {>> package.json.new
echo     "appId": "com.smartnote.collector",>> package.json.new
echo     "productName": "Smart Note Collector",>> package.json.new
echo     "directories": {>> package.json.new
echo       "output": "dist">> package.json.new
echo     },>> package.json.new
echo     "win": {>> package.json.new
echo       "target": "nsis",>> package.json.new
echo       "icon": "assets/icon.ico">> package.json.new
echo     },>> package.json.new
echo     "nsis": {>> package.json.new
echo       "oneClick": false,>> package.json.new
echo       "allowToChangeInstallationDirectory": true,>> package.json.new
echo       "createDesktopShortcut": true,>> package.json.new
echo       "createStartMenuShortcut": true>> package.json.new
echo     },>> package.json.new
echo     "files": [>> package.json.new
echo       "src/**/*",>> package.json.new
echo       "assets/**/*",>> package.json.new
echo       "!**/*.md">> package.json.new
echo     ]>> package.json.new
echo   },>> package.json.new
echo   "devDependencies": {>> package.json.new
echo     "electron": "^28.0.0",>> package.json.new
echo     "electron-builder": "^24.8.1">> package.json.new
echo   },>> package.json.new
echo   "dependencies": {>> package.json.new
echo     "electron-store": "^8.1.0",>> package.json.new
echo     "axios": "^1.6.2",>> package.json.new
echo     "cheerio": "^1.0.0-rc.12",>> package.json.new
echo     "form-data": "^4.0.0">> package.json.new
echo   },>> package.json.new
echo   "author": "Smart Note Collector Team",>> package.json.new
echo   "license": "MIT",>> package.json.new
echo   "keywords": [>> package.json.new
echo     "electron",>> package.json.new
echo     "notes",>> package.json.new
echo     "clipboard",>> package.json.new
echo     "screenshot",>> package.json.new
echo     "productivity">> package.json.new
echo   ]>> package.json.new
echo }>> package.json.new

move package.json.new package.json >nul
echo ✅ package.json已修复

:install_deps
echo.
echo [步骤5] 尝试重新安装依赖...
echo.

REM 5. 设置npm配置以解决网络问题
echo 正在优化npm配置...
npm config set registry https://registry.npmmirror.com/
npm config set electron_mirror https://npmmirror.com/mirrors/electron/
npm config set electron_builder_binaries_mirror https://npmmirror.com/mirrors/electron-builder-binaries/

echo ✅ npm配置已优化（使用国内镜像源）
echo.

REM 6. 尝试安装
echo 正在安装依赖包（使用国内镜像）...
npm install

if errorlevel 1 (
    echo.
    echo ❌ 安装仍然失败，尝试备用方案...
    echo.

    REM 备用方案1：使用yarn
    echo [备用方案1] 尝试使用yarn安装...
    yarn --version >nul 2>&1
    if errorlevel 1 (
        echo yarn未安装，跳过yarn方案
    ) else (
        yarn install
        if not errorlevel 1 (
            echo ✅ 使用yarn安装成功！
            goto success
        )
    )

    REM 备用方案2：逐个安装依赖
    echo [备用方案2] 尝试逐个安装核心依赖...
    npm install electron@^28.0.0 --save-dev
    npm install electron-builder@^24.8.1 --save-dev
    npm install electron-store@^8.1.0 --save
    npm install axios@^1.6.2 --save
    npm install cheerio@^1.0.0-rc.12 --save
    npm install form-data@^4.0.0 --save

    if not errorlevel 1 (
        echo ✅ 逐个安装成功！
        goto success
    )

    echo.
    echo ❌ 所有安装方案都失败了
    echo.
    echo 可能的解决方案：
    echo 1. 检查网络连接
    echo 2. 关闭防火墙/杀毒软件
    echo 3. 使用VPN
    echo 4. 以管理员身份运行此脚本
    echo 5. 尝试使用其他网络环境
    echo.
    pause
    exit /b 1
)

:success
echo.
echo ========================================
echo           修复完成！
echo ========================================
echo.
echo ✅ 依赖安装成功
echo.
echo 现在可以启动应用：
echo 1. 双击 start.bat
echo 2. 或运行：npm start
echo.

set /p start_now="现在启动应用吗？(y/n): "
if /i "%start_now%"=="y" (
    echo.
    echo 🚀 正在启动应用...
    start "" "start.bat"
)

echo.
pause