// 剪贴板管理器
// 提供跨平台的剪贴板操作功能

const { spawn } = require('child_process');
const os = require('os');

class ClipboardManager {
    constructor() {
        this.platform = os.platform();
        this.lastContent = '';
        this.listeners = [];
    }

    // 读取剪贴板内容
    async readText() {
        try {
            switch (this.platform) {
                case 'win32':
                    return await this.readTextWindows();
                case 'darwin':
                    return await this.readTextMacOS();
                case 'linux':
                    return await this.readTextLinux();
                default:
                    throw new Error(`Unsupported platform: ${this.platform}`);
            }
        } catch (error) {
            console.error('Failed to read clipboard:', error);
            return '';
        }
    }

    // 写入剪贴板内容
    async writeText(text) {
        try {
            switch (this.platform) {
                case 'win32':
                    return await this.writeTextWindows(text);
                case 'darwin':
                    return await this.writeTextMacOS(text);
                case 'linux':
                    return await this.writeTextLinux(text);
                default:
                    throw new Error(`Unsupported platform: ${this.platform}`);
            }
        } catch (error) {
            console.error('Failed to write clipboard:', error);
            return false;
        }
    }

    // Windows 剪贴板读取
    readTextWindows() {
        return new Promise((resolve, reject) => {
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
                    resolve(output.replace(/\r\n$/, '').replace(/\n$/, ''));
                } else {
                    reject(new Error(`PowerShell error: ${error}`));
                }
            });

            setTimeout(() => {
                powershell.kill();
                reject(new Error('Clipboard read timeout'));
            }, 5000);
        });
    }

    // Windows 剪贴板写入
    writeTextWindows(text) {
        return new Promise((resolve, reject) => {
            const powershell = spawn('powershell', [
                '-Command',
                `Set-Clipboard -Value "${text.replace(/"/g, '""')}"`
            ], {
                windowsHide: true
            });

            powershell.on('close', (code) => {
                if (code === 0) {
                    resolve(true);
                } else {
                    reject(new Error('Failed to write to clipboard'));
                }
            });

            setTimeout(() => {
                powershell.kill();
                reject(new Error('Clipboard write timeout'));
            }, 5000);
        });
    }

    // macOS 剪贴板读取
    readTextMacOS() {
        return new Promise((resolve, reject) => {
            const pbpaste = spawn('pbpaste');
            let output = '';

            pbpaste.stdout.on('data', (data) => {
                output += data.toString();
            });

            pbpaste.on('close', (code) => {
                if (code === 0) {
                    resolve(output);
                } else {
                    reject(new Error('Failed to read clipboard'));
                }
            });
        });
    }

    // macOS 剪贴板写入
    writeTextMacOS(text) {
        return new Promise((resolve, reject) => {
            const pbcopy = spawn('pbcopy');
            
            pbcopy.stdin.write(text);
            pbcopy.stdin.end();

            pbcopy.on('close', (code) => {
                if (code === 0) {
                    resolve(true);
                } else {
                    reject(new Error('Failed to write to clipboard'));
                }
            });
        });
    }

    // Linux 剪贴板读取
    readTextLinux() {
        return new Promise((resolve, reject) => {
            // 尝试使用 xclip
            const xclip = spawn('xclip', ['-selection', 'clipboard', '-o']);
            let output = '';

            xclip.stdout.on('data', (data) => {
                output += data.toString();
            });

            xclip.on('close', (code) => {
                if (code === 0) {
                    resolve(output);
                } else {
                    // 如果 xclip 失败，尝试 xsel
                    const xsel = spawn('xsel', ['--clipboard', '--output']);
                    let xselOutput = '';

                    xsel.stdout.on('data', (data) => {
                        xselOutput += data.toString();
                    });

                    xsel.on('close', (xselCode) => {
                        if (xselCode === 0) {
                            resolve(xselOutput);
                        } else {
                            reject(new Error('Failed to read clipboard (xclip and xsel not available)'));
                        }
                    });
                }
            });
        });
    }

    // Linux 剪贴板写入
    writeTextLinux(text) {
        return new Promise((resolve, reject) => {
            // 尝试使用 xclip
            const xclip = spawn('xclip', ['-selection', 'clipboard']);
            
            xclip.stdin.write(text);
            xclip.stdin.end();

            xclip.on('close', (code) => {
                if (code === 0) {
                    resolve(true);
                } else {
                    // 如果 xclip 失败，尝试 xsel
                    const xsel = spawn('xsel', ['--clipboard', '--input']);
                    
                    xsel.stdin.write(text);
                    xsel.stdin.end();

                    xsel.on('close', (xselCode) => {
                        if (xselCode === 0) {
                            resolve(true);
                        } else {
                            reject(new Error('Failed to write to clipboard (xclip and xsel not available)'));
                        }
                    });
                }
            });
        });
    }

    // 监听剪贴板变化
    async startMonitoring(interval = 1000) {
        this.lastContent = await this.readText();
        
        this.monitorInterval = setInterval(async () => {
            try {
                const currentContent = await this.readText();
                if (currentContent !== this.lastContent) {
                    this.lastContent = currentContent;
                    this.notifyListeners(currentContent);
                }
            } catch (error) {
                console.error('Clipboard monitoring error:', error);
            }
        }, interval);
    }

    // 停止监听剪贴板变化
    stopMonitoring() {
        if (this.monitorInterval) {
            clearInterval(this.monitorInterval);
            this.monitorInterval = null;
        }
    }

    // 添加剪贴板变化监听器
    addListener(callback) {
        this.listeners.push(callback);
    }

    // 移除剪贴板变化监听器
    removeListener(callback) {
        const index = this.listeners.indexOf(callback);
        if (index > -1) {
            this.listeners.splice(index, 1);
        }
    }

    // 通知所有监听器
    notifyListeners(content) {
        this.listeners.forEach(callback => {
            try {
                callback(content);
            } catch (error) {
                console.error('Clipboard listener error:', error);
            }
        });
    }

    // 获取剪贴板历史（简单实现）
    getHistory() {
        return this.history || [];
    }

    // 清空剪贴板
    async clear() {
        return await this.writeText('');
    }
}

module.exports = ClipboardManager;
