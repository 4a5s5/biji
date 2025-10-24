@echo off
REM Smart Note Collector - Context Menu Handler Wrapper
REM This batch file wraps the Node.js context handler

REM 设置工作目录
cd /d "%~dp0"

REM 运行Node.js处理程序
node context-handler.js %*

REM 退出
exit /b %errorlevel%
