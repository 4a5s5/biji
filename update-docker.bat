@echo off
REM Docker Hub 镜像更新脚本 (Windows版本)
REM 使用方法: update-docker.bat [版本号]

setlocal enabledelayedexpansion

REM 配置
set DOCKER_USERNAME=4a5s5
set IMAGE_NAME=smart-note-collector
set FULL_IMAGE_NAME=%DOCKER_USERNAME%/%IMAGE_NAME%

REM 获取版本号参数，默认为当前时间戳
if "%1"=="" (
    for /f "tokens=1-4 delims=/ " %%a in ('date /t') do set mydate=%%c%%a%%b
    for /f "tokens=1-2 delims=: " %%a in ('time /t') do set mytime=%%a%%b
    set VERSION=!mydate!-!mytime!
) else (
    set VERSION=%1
)

echo 🚀 开始更新 Docker 镜像...
echo 📦 镜像名称: %FULL_IMAGE_NAME%
echo 🏷️  版本标签: %VERSION%

REM 1. 构建镜像
echo 🔨 构建镜像...
docker build -t %FULL_IMAGE_NAME%:latest .
if errorlevel 1 (
    echo ❌ 镜像构建失败
    exit /b 1
)

docker build -t %FULL_IMAGE_NAME%:%VERSION% .
if errorlevel 1 (
    echo ❌ 版本镜像构建失败
    exit /b 1
)

REM 2. 检查镜像是否构建成功
echo ✅ 验证镜像构建...
docker images %FULL_IMAGE_NAME%

REM 3. 推送到 Docker Hub
echo 📤 推送镜像到 Docker Hub...
docker push %FULL_IMAGE_NAME%:latest
if errorlevel 1 (
    echo ❌ 推送 latest 标签失败
    exit /b 1
)

docker push %FULL_IMAGE_NAME%:%VERSION%
if errorlevel 1 (
    echo ❌ 推送版本标签失败
    exit /b 1
)

echo 🎉 Docker 镜像更新完成！
echo 📋 可用标签:
echo    - %FULL_IMAGE_NAME%:latest
echo    - %FULL_IMAGE_NAME%:%VERSION%
echo.
echo 🔧 在 Claw Cloud 中使用:
echo    docker pull %FULL_IMAGE_NAME%:latest
echo    docker run -d -p 3000:3000 %FULL_IMAGE_NAME%:latest

pause
