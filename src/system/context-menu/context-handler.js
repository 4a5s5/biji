#!/usr/bin/env node

// Smart Note Collector - 右键菜单处理程序
// 处理右键菜单点击事件，获取剪贴板内容并发送到主应用程序

const http = require('http');
const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

// 配置
const CONFIG = {
    serverUrl: 'http://localhost:3000',
    clipboardTimeout: 1000, // 等待剪贴板更新的时间（毫秒）
    maxRetries: 3
};

// 日志函数
function log(message) {
    const timestamp = new Date().toISOString();
    const logMessage = `[${timestamp}] ${message}\n`;
    
    // 写入日志文件
    const logFile = path.join(__dirname, 'context-handler.log');
    fs.appendFileSync(logFile, logMessage);
    
    // 也输出到控制台（调试用）
    console.log(message);
}

// 获取剪贴板内容
function getClipboardContent() {
    return new Promise((resolve, reject) => {
        // 使用PowerShell获取剪贴板内容
        const powershell = spawn('powershell', [
            '-Command',
            'Get-Clipboard -Raw'
        ], {
            windowsHide: true
        });

        let output = '';
        let error = '';

        powershell.stdout.on('data', (data) => {
            output += data.toString();
        });

        powershell.stderr.on('data', (data) => {
            error += data.toString();
        });

        powershell.on('close', (code) => {
            if (code === 0) {
                resolve(output.trim());
            } else {
                reject(new Error(`PowerShell error: ${error}`));
            }
        });

        // 设置超时
        setTimeout(() => {
            powershell.kill();
            reject(new Error('Clipboard read timeout'));
        }, 5000);
    });
}

// 获取当前活动窗口信息
function getActiveWindow() {
    return new Promise((resolve, reject) => {
        // 使用PowerShell获取活动窗口信息
        const powershell = spawn('powershell', [
            '-Command',
            `
            Add-Type -AssemblyName System.Windows.Forms
            $activeWindow = [System.Windows.Forms.Form]::ActiveForm
            if ($activeWindow -eq $null) {
                Add-Type @"
                    using System;
                    using System.Runtime.InteropServices;
                    public class Win32 {
                        [DllImport("user32.dll")]
                        public static extern IntPtr GetForegroundWindow();
                        [DllImport("user32.dll")]
                        public static extern int GetWindowText(IntPtr hWnd, System.Text.StringBuilder text, int count);
                        [DllImport("user32.dll", SetLastError=true)]
                        public static extern uint GetWindowThreadProcessId(IntPtr hWnd, out uint lpdwProcessId);
                    }
"@
                $hwnd = [Win32]::GetForegroundWindow()
                $title = New-Object System.Text.StringBuilder 256
                [Win32]::GetWindowText($hwnd, $title, $title.Capacity) | Out-Null
                $processId = 0
                [Win32]::GetWindowThreadProcessId($hwnd, [ref]$processId) | Out-Null
                $process = Get-Process -Id $processId -ErrorAction SilentlyContinue
                $result = @{
                    Title = $title.ToString()
                    ProcessName = if ($process) { $process.ProcessName } else { "Unknown" }
                    ProcessPath = if ($process) { $process.Path } else { "Unknown" }
                }
                $result | ConvertTo-Json
            }
            `
        ], {
            windowsHide: true
        });

        let output = '';
        let error = '';

        powershell.stdout.on('data', (data) => {
            output += data.toString();
        });

        powershell.stderr.on('data', (data) => {
            error += data.toString();
        });

        powershell.on('close', (code) => {
            if (code === 0) {
                try {
                    const windowInfo = JSON.parse(output.trim());
                    resolve(windowInfo);
                } catch (e) {
                    resolve({
                        Title: 'Unknown',
                        ProcessName: 'Unknown',
                        ProcessPath: 'Unknown'
                    });
                }
            } else {
                resolve({
                    Title: 'Unknown',
                    ProcessName: 'Unknown',
                    ProcessPath: 'Unknown'
                });
            }
        });

        setTimeout(() => {
            powershell.kill();
            resolve({
                Title: 'Unknown',
                ProcessName: 'Unknown',
                ProcessPath: 'Unknown'
            });
        }, 3000);
    });
}

// 发送数据到主应用程序
function sendToMainApp(data) {
    return new Promise((resolve, reject) => {
        const postData = JSON.stringify(data);
        
        const options = {
            hostname: 'localhost',
            port: 3000,
            path: '/api/quick-import',
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Content-Length': Buffer.byteLength(postData)
            }
        };

        const req = http.request(options, (res) => {
            let responseData = '';
            
            res.on('data', (chunk) => {
                responseData += chunk;
            });
            
            res.on('end', () => {
                if (res.statusCode === 200 || res.statusCode === 201) {
                    resolve(responseData);
                } else {
                    reject(new Error(`HTTP ${res.statusCode}: ${responseData}`));
                }
            });
        });

        req.on('error', (error) => {
            reject(error);
        });

        req.write(postData);
        req.end();
    });
}

// 显示快速导入对话框
function showQuickImportDialog(content, source) {
    const url = `${CONFIG.serverUrl}/quick-import?content=${encodeURIComponent(content)}&source=${encodeURIComponent(JSON.stringify(source))}`;
    
    // 使用默认浏览器打开快速导入页面
    const start = spawn('cmd', ['/c', 'start', url], {
        windowsHide: true
    });
    
    start.on('error', (error) => {
        log(`Failed to open browser: ${error.message}`);
    });
}

// 主处理函数
async function handleContextMenu(filePath) {
    try {
        log(`Context menu triggered for: ${filePath || 'clipboard content'}`);
        
        // 等待一小段时间，让用户有时间复制内容
        await new Promise(resolve => setTimeout(resolve, CONFIG.clipboardTimeout));
        
        // 获取剪贴板内容
        let clipboardContent = '';
        try {
            clipboardContent = await getClipboardContent();
            log(`Clipboard content length: ${clipboardContent.length}`);
        } catch (error) {
            log(`Failed to get clipboard content: ${error.message}`);
        }
        
        // 获取活动窗口信息
        let windowInfo = {};
        try {
            windowInfo = await getActiveWindow();
            log(`Active window: ${windowInfo.Title} (${windowInfo.ProcessName})`);
        } catch (error) {
            log(`Failed to get window info: ${error.message}`);
        }
        
        // 如果没有剪贴板内容，使用文件路径
        const content = clipboardContent || filePath || '';
        
        if (!content) {
            log('No content to import');
            return;
        }
        
        // 构建源信息
        const source = {
            app: windowInfo.ProcessName || 'Unknown',
            title: windowInfo.Title || 'Unknown',
            path: windowInfo.ProcessPath || 'Unknown',
            timestamp: new Date().toISOString(),
            filePath: filePath || null
        };
        
        // 显示快速导入对话框
        showQuickImportDialog(content, source);
        
        log('Quick import dialog opened successfully');
        
    } catch (error) {
        log(`Error in handleContextMenu: ${error.message}`);
    }
}

// 主程序入口
function main() {
    const args = process.argv.slice(2);
    const filePath = args[0];
    
    log('=== Smart Note Collector Context Handler Started ===');
    log(`Arguments: ${JSON.stringify(args)}`);
    
    handleContextMenu(filePath).then(() => {
        log('Context handler completed successfully');
        process.exit(0);
    }).catch((error) => {
        log(`Context handler failed: ${error.message}`);
        process.exit(1);
    });
}

// 运行主程序
if (require.main === module) {
    main();
}

module.exports = {
    handleContextMenu,
    getClipboardContent,
    getActiveWindow
};
