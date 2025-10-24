@echo off
echo 快速修复npm安装问题...

REM 删除旧文件
if exist "node_modules" rmdir /s /q "node_modules"
if exist "package-lock.json" del "package-lock.json"

REM 清理缓存
npm cache clean --force

REM 设置国内镜像
npm config set registry https://registry.npmmirror.com/

REM 重新安装
npm install

echo 修复完成！
pause