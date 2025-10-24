// 应用程序检测模块
// 检测当前活动的应用程序，获取窗口信息

const { spawn } = require('child_process');
const os = require('os');

class AppDetector {
    constructor() {
        this.platform = os.platform();
        this.cache = new Map();
        this.cacheTimeout = 5000; // 缓存5秒
    }

    // 获取当前活动窗口信息
    async getActiveWindow() {
        const cacheKey = 'activeWindow';
        const cached = this.cache.get(cacheKey);
        
        if (cached && Date.now() - cached.timestamp < this.cacheTimeout) {
            return cached.data;
        }

        try {
            let windowInfo;
            
            switch (this.platform) {
                case 'win32':
                    windowInfo = await this.getActiveWindowWindows();
                    break;
                case 'darwin':
                    windowInfo = await this.getActiveWindowMacOS();
                    break;
                case 'linux':
                    windowInfo = await this.getActiveWindowLinux();
                    break;
                default:
                    windowInfo = this.getDefaultWindowInfo();
            }

            // 缓存结果
            this.cache.set(cacheKey, {
                data: windowInfo,
                timestamp: Date.now()
            });

            return windowInfo;
        } catch (error) {
            console.error('Failed to get active window:', error);
            return this.getDefaultWindowInfo();
        }
    }

    // Windows 活动窗口检测
    getActiveWindowWindows() {
        return new Promise((resolve, reject) => {
            const powershell = spawn('powershell', [
                '-Command',
                `
                Add-Type @"
                    using System;
                    using System.Runtime.InteropServices;
                    using System.Text;
                    public class Win32 {
                        [DllImport("user32.dll")]
                        public static extern IntPtr GetForegroundWindow();
                        [DllImport("user32.dll")]
                        public static extern int GetWindowText(IntPtr hWnd, StringBuilder text, int count);
                        [DllImport("user32.dll", SetLastError=true)]
                        public static extern uint GetWindowThreadProcessId(IntPtr hWnd, out uint lpdwProcessId);
                        [DllImport("user32.dll")]
                        public static extern bool GetWindowRect(IntPtr hWnd, out RECT lpRect);
                        [StructLayout(LayoutKind.Sequential)]
                        public struct RECT {
                            public int Left, Top, Right, Bottom;
                        }
                    }
"@
                $hwnd = [Win32]::GetForegroundWindow()
                $title = New-Object System.Text.StringBuilder 256
                [Win32]::GetWindowText($hwnd, $title, $title.Capacity) | Out-Null
                $processId = 0
                [Win32]::GetWindowThreadProcessId($hwnd, [ref]$processId) | Out-Null
                
                $process = Get-Process -Id $processId -ErrorAction SilentlyContinue
                $rect = New-Object Win32+RECT
                [Win32]::GetWindowRect($hwnd, [ref]$rect) | Out-Null
                
                $result = @{
                    Title = $title.ToString()
                    ProcessName = if ($process) { $process.ProcessName } else { "Unknown" }
                    ProcessPath = if ($process) { $process.Path } else { "Unknown" }
                    ProcessId = $processId
                    WindowHandle = $hwnd.ToInt64()
                    WindowRect = @{
                        Left = $rect.Left
                        Top = $rect.Top
                        Right = $rect.Right
                        Bottom = $rect.Bottom
                        Width = $rect.Right - $rect.Left
                        Height = $rect.Bottom - $rect.Top
                    }
                    Timestamp = (Get-Date).ToString("yyyy-MM-ddTHH:mm:ss.fffZ")
                }
                $result | ConvertTo-Json -Depth 3
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
                        resolve(this.normalizeWindowInfo(windowInfo));
                    } catch (e) {
                        resolve(this.getDefaultWindowInfo());
                    }
                } else {
                    reject(new Error(`PowerShell error: ${error}`));
                }
            });

            setTimeout(() => {
                powershell.kill();
                reject(new Error('Window detection timeout'));
            }, 5000);
        });
    }

    // macOS 活动窗口检测
    getActiveWindowMacOS() {
        return new Promise((resolve, reject) => {
            const osascript = spawn('osascript', [
                '-e',
                `
                tell application "System Events"
                    set frontApp to first application process whose frontmost is true
                    set appName to name of frontApp
                    set appPath to POSIX path of (file of frontApp as alias)
                    try
                        set windowTitle to title of first window of frontApp
                    on error
                        set windowTitle to ""
                    end try
                    return "{" & ¬
                        "\\"ProcessName\\": \\"" & appName & "\\", " & ¬
                        "\\"ProcessPath\\": \\"" & appPath & "\\", " & ¬
                        "\\"Title\\": \\"" & windowTitle & "\\", " & ¬
                        "\\"Timestamp\\": \\"" & (current date as string) & "\\"" & ¬
                        "}"
                end tell
                `
            ]);

            let output = '';
            let error = '';

            osascript.stdout.on('data', (data) => {
                output += data.toString();
            });

            osascript.stderr.on('data', (data) => {
                error += data.toString();
            });

            osascript.on('close', (code) => {
                if (code === 0) {
                    try {
                        const windowInfo = JSON.parse(output.trim());
                        resolve(this.normalizeWindowInfo(windowInfo));
                    } catch (e) {
                        resolve(this.getDefaultWindowInfo());
                    }
                } else {
                    reject(new Error(`osascript error: ${error}`));
                }
            });

            setTimeout(() => {
                osascript.kill();
                reject(new Error('Window detection timeout'));
            }, 5000);
        });
    }

    // Linux 活动窗口检测
    getActiveWindowLinux() {
        return new Promise((resolve, reject) => {
            // 尝试使用 xdotool
            const xdotool = spawn('xdotool', ['getactivewindow', 'getwindowname', 'getactivewindow']);
            let output = '';

            xdotool.stdout.on('data', (data) => {
                output += data.toString();
            });

            xdotool.on('close', (code) => {
                if (code === 0) {
                    const lines = output.trim().split('\n');
                    const windowInfo = {
                        Title: lines[0] || 'Unknown',
                        ProcessName: 'Unknown',
                        ProcessPath: 'Unknown',
                        Timestamp: new Date().toISOString()
                    };
                    resolve(this.normalizeWindowInfo(windowInfo));
                } else {
                    // 如果 xdotool 失败，尝试其他方法
                    resolve(this.getDefaultWindowInfo());
                }
            });

            setTimeout(() => {
                xdotool.kill();
                resolve(this.getDefaultWindowInfo());
            }, 3000);
        });
    }

    // 标准化窗口信息
    normalizeWindowInfo(rawInfo) {
        return {
            title: rawInfo.Title || rawInfo.title || 'Unknown',
            processName: rawInfo.ProcessName || rawInfo.processName || 'Unknown',
            processPath: rawInfo.ProcessPath || rawInfo.processPath || 'Unknown',
            processId: rawInfo.ProcessId || rawInfo.processId || null,
            windowHandle: rawInfo.WindowHandle || rawInfo.windowHandle || null,
            windowRect: rawInfo.WindowRect || rawInfo.windowRect || null,
            timestamp: rawInfo.Timestamp || rawInfo.timestamp || new Date().toISOString(),
            platform: this.platform
        };
    }

    // 默认窗口信息
    getDefaultWindowInfo() {
        return {
            title: 'Unknown',
            processName: 'Unknown',
            processPath: 'Unknown',
            processId: null,
            windowHandle: null,
            windowRect: null,
            timestamp: new Date().toISOString(),
            platform: this.platform
        };
    }

    // 获取所有窗口列表
    async getAllWindows() {
        try {
            switch (this.platform) {
                case 'win32':
                    return await this.getAllWindowsWindows();
                case 'darwin':
                    return await this.getAllWindowsMacOS();
                case 'linux':
                    return await this.getAllWindowsLinux();
                default:
                    return [];
            }
        } catch (error) {
            console.error('Failed to get all windows:', error);
            return [];
        }
    }

    // Windows 所有窗口
    getAllWindowsWindows() {
        return new Promise((resolve, reject) => {
            const powershell = spawn('powershell', [
                '-Command',
                'Get-Process | Where-Object {$_.MainWindowTitle -ne ""} | Select-Object ProcessName, MainWindowTitle, Id, Path | ConvertTo-Json'
            ], {
                windowsHide: true
            });

            let output = '';
            powershell.stdout.on('data', (data) => {
                output += data.toString();
            });

            powershell.on('close', (code) => {
                if (code === 0) {
                    try {
                        const windows = JSON.parse(output.trim());
                        resolve(Array.isArray(windows) ? windows : [windows]);
                    } catch (e) {
                        resolve([]);
                    }
                } else {
                    resolve([]);
                }
            });

            setTimeout(() => {
                powershell.kill();
                resolve([]);
            }, 5000);
        });
    }

    // macOS 所有窗口
    getAllWindowsMacOS() {
        // macOS 实现较复杂，暂时返回空数组
        return Promise.resolve([]);
    }

    // Linux 所有窗口
    getAllWindowsLinux() {
        // Linux 实现较复杂，暂时返回空数组
        return Promise.resolve([]);
    }

    // 清除缓存
    clearCache() {
        this.cache.clear();
    }

    // 检测特定应用程序是否运行
    async isAppRunning(appName) {
        try {
            const windows = await this.getAllWindows();
            return windows.some(window => 
                window.ProcessName && 
                window.ProcessName.toLowerCase().includes(appName.toLowerCase())
            );
        } catch (error) {
            console.error('Failed to check if app is running:', error);
            return false;
        }
    }
}

module.exports = AppDetector;
