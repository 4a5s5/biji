// 截图管理器 - 处理屏幕截图功能
const { screen, desktopCapturer, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const fs = require('fs');
const os = require('os');

class ScreenshotManager {
    constructor(options = {}) {
        this.onScreenshotTaken = options.onScreenshotTaken || (() => {});
        this.tempDir = path.join(os.tmpdir(), 'smart-note-collector', 'screenshots');
        this.backupTempDir = path.join(__dirname, '..', '..', 'temp', 'screenshots'); // 备用目录
        this.selectorWindow = null;

        // 确保截图目录存在
        this.ensureTempDir();

        // 绑定IPC处理器
        this.bindIpcHandlers();
    }
    
    // 确保临时目录存在
    ensureTempDir() {
        try {
            if (!fs.existsSync(this.tempDir)) {
                fs.mkdirSync(this.tempDir, { recursive: true });
            }
            console.log('截图目录已就绪:', this.tempDir);
        } catch (error) {
            console.warn('创建主临时目录失败，尝试备用目录:', error.message);
            try {
                if (!fs.existsSync(this.backupTempDir)) {
                    fs.mkdirSync(this.backupTempDir, { recursive: true });
                }
                this.tempDir = this.backupTempDir;
                console.log('截图备用目录已就绪:', this.tempDir);
            } catch (backupError) {
                console.error('创建备用临时目录也失败:', backupError);
                throw new Error('无法创建截图保存目录');
            }
        }
    }
    
    // 绑定IPC处理器
    bindIpcHandlers() {
        ipcMain.handle('start-area-selection', () => {
            return this.startAreaSelection();
        });
        
        ipcMain.handle('complete-area-selection', (event, area) => {
            return this.completeAreaSelection(area);
        });
        
        ipcMain.handle('cancel-area-selection', () => {
            return this.cancelAreaSelection();
        });
    }
    
    // 开始截图
    async takeScreenshot() {
        try {
            console.log('开始截图...');
            
            // 显示区域选择器
            const selectedArea = await this.showAreaSelector();
            
            if (!selectedArea) {
                console.log('用户取消了截图');
                return null;
            }
            
            // 捕获指定区域的截图
            const screenshotData = await this.captureArea(selectedArea);
            
            // 触发回调
            this.onScreenshotTaken(screenshotData);
            
            return screenshotData;
            
        } catch (error) {
            console.error('截图失败:', error);
            throw error;
        }
    }
    
    // 显示区域选择器
    async showAreaSelector() {
        return new Promise((resolve) => {
            const primaryDisplay = screen.getPrimaryDisplay();

            this.selectorWindow = new BrowserWindow({
                x: primaryDisplay.bounds.x,
                y: primaryDisplay.bounds.y,
                width: primaryDisplay.bounds.width,
                height: primaryDisplay.bounds.height,
                frame: false,
                transparent: true,
                alwaysOnTop: true,
                skipTaskbar: true,
                resizable: false,
                movable: false,
                minimizable: false,
                maximizable: false,
                focusable: true,
                fullscreen: true,
                webPreferences: {
                    nodeIntegration: true,
                    contextIsolation: false
                }
            });

            this.selectorWindow.loadFile(path.join(__dirname, '../ui/screenshot-selector.html'));
            this.selectorWindow.setMenuBarVisibility(false);

            this.selectorWindow.once('ready-to-show', () => {
                this.selectorWindow.show();
                this.selectorWindow.focus();
            });

            let selectionResult = null;
            let resolved = false;

            const cleanup = () => {
                ipcMain.removeListener('screenshot-area-selected', handleSelectionComplete);
                ipcMain.removeListener('screenshot-cancelled', handleSelectionCancelled);
            };

            const finalize = (result) => {
                selectionResult = result;
                cleanup();

                if (this.selectorWindow && !this.selectorWindow.isDestroyed()) {
                    this.selectorWindow.hide();
                    this.selectorWindow.close();
                } else if (!resolved) {
                    resolved = true;
                    resolve(selectionResult);
                }
            };

            const handleSelectionComplete = (event, area) => {
                console.log('截图区域选择完成:', area);
                finalize(area);
            };

            const handleSelectionCancelled = () => {
                console.log('用户取消了截图选择');
                finalize(null);
            };

            ipcMain.on('screenshot-area-selected', handleSelectionComplete);
            ipcMain.on('screenshot-cancelled', handleSelectionCancelled);

            this.selectorWindow.on('closed', () => {
                cleanup();
                this.selectorWindow = null;

                if (!resolved) {
                    resolved = true;
                    resolve(selectionResult);
                }
            });
        });
    }

    // 捕获指定区域
    async captureArea(area) {
        try {
            // 等待一小段时间，确保选择器窗口已经完全关闭
            await new Promise(resolve => setTimeout(resolve, 200));

            // 使用desktopCapturer捕获屏幕
            const primaryDisplay = screen.getPrimaryDisplay();
            const scaleFactor = primaryDisplay && typeof primaryDisplay.scaleFactor === 'number' ? primaryDisplay.scaleFactor : 1;
            const displaySize = primaryDisplay && primaryDisplay.size ? primaryDisplay.size : { width: 1920, height: 1080 };
            const captureWidth = Math.max(1, Math.round(displaySize.width * scaleFactor));
            const captureHeight = Math.max(1, Math.round(displaySize.height * scaleFactor));

            const sources = await desktopCapturer.getSources({
                types: ['screen'],
                thumbnailSize: { width: captureWidth, height: captureHeight }
            });

            if (sources.length === 0) {
                throw new Error('无法获取屏幕源');
            }

            const displayId = primaryDisplay && primaryDisplay.id !== undefined ? String(primaryDisplay.id) : null;
            const primarySource = sources.find(source => {
                if (!displayId) return false;
                if (source.display_id === displayId || source.id === displayId) {
                    return true;
                }
                return source.display_id && source.display_id.toString().endsWith(displayId);
            }) || sources.find(source => source.name === 'Entire Screen') || sources[0];
            const screenshot = primarySource.thumbnail;

            let finalImage = screenshot;
            if (area && (area.width > 0 && area.height > 0)) {
                const scaledArea = {
                    x: Math.round(area.x * scaleFactor),
                    y: Math.round(area.y * scaleFactor),
                    width: Math.max(1, Math.round(area.width * scaleFactor)),
                    height: Math.max(1, Math.round(area.height * scaleFactor))
                };
                finalImage = this.cropImage(screenshot, scaledArea);
            }

            const timestamp = Date.now();
            const filename = `screenshot-${timestamp}.png`;
            const filePath = path.join(this.tempDir, filename);

            try {
                const buffer = finalImage.toPNG();

                // 尝试保存截图，如果失败则使用备用路径
                let actualFilePath = filePath;
                let saveAttempts = 0;
                const maxAttempts = 3;

                while (saveAttempts < maxAttempts) {
                    try {
                        fs.writeFileSync(actualFilePath, buffer);

                        // 等待一小段时间确保文件完全写入
                        await new Promise(resolve => setTimeout(resolve, 100));

                        // 验证文件是否写入成功
                        if (!fs.existsSync(actualFilePath)) {
                            throw new Error('截图文件写入失败');
                        }

                        // 验证文件大小
                        const stats = fs.statSync(actualFilePath);
                        if (stats.size === 0) {
                            throw new Error('截图文件为空');
                        }

                        console.log('✅ 截图保存成功:', actualFilePath, '文件大小:', stats.size, 'bytes');

                        const screenshotData = {
                            filePath: actualFilePath,
                            filename: filename,
                            size: finalImage.getSize(),
                            area: area,
                            timestamp: timestamp,
                            fileSize: stats.size
                        };

                        return screenshotData;

                    } catch (attemptError) {
                        saveAttempts++;
                        console.warn(`截图保存尝试 ${saveAttempts} 失败:`, attemptError.message);

                        if (saveAttempts < maxAttempts) {
                            // 如果是第一次失败，尝试使用备用目录
                            if (saveAttempts === 1) {
                                actualFilePath = path.join(this.backupTempDir, filename);
                                console.log('尝试使用备用路径保存截图:', actualFilePath);
                            }
                            // 等待一段时间后重试
                            await new Promise(resolve => setTimeout(resolve, 200));
                        } else {
                            throw attemptError;
                        }
                    }
                }

            } catch (writeError) {
                console.error('❌ 截图文件写入完全失败:', writeError);
                throw new Error(`截图保存失败: ${writeError.message}`);
            }
            
        } catch (error) {
            console.error('捕获截图失败:', error);
            throw error;
        }
    }
    
    // 裁剪图片
    cropImage(image, area) {
        try {
            const { x, y, width, height } = area;
            const imageSize = image.getSize();
            
            // 确保裁剪区域在图片范围内
            const cropX = Math.max(0, Math.min(x, imageSize.width));
            const cropY = Math.max(0, Math.min(y, imageSize.height));
            const cropWidth = Math.min(width, imageSize.width - cropX);
            const cropHeight = Math.min(height, imageSize.height - cropY);
            
            if (cropWidth <= 0 || cropHeight <= 0) {
                return image; // 无效的裁剪区域，返回原图
            }
            
            const rect = {
                x: cropX,
                y: cropY,
                width: cropWidth,
                height: cropHeight
            };
            
            return image.crop(rect);
        } catch (error) {
            console.error('裁剪图片失败:', error);
            return image; // 裁剪失败时返回原图
        }
    }
    
    // 全屏截图（不需要选择区域）
    async takeFullScreenshot() {
        try {
            console.log('开始全屏截图...');
            
            const screenshotData = await this.captureArea(null);
            this.onScreenshotTaken(screenshotData);
            
            return screenshotData;
        } catch (error) {
            console.error('全屏截图失败:', error);
            throw error;
        }
    }
    
    // 开始区域选择（IPC处理器）
    async startAreaSelection() {
        // 这个方法主要是为了IPC调用
        return this.showAreaSelector();
    }
    
    // 完成区域选择（IPC处理器）
    async completeAreaSelection(area) {
        if (this.selectorWindow && !this.selectorWindow.isDestroyed()) {
            this.selectorWindow.close();
            this.selectorWindow = null;
        }
        
        if (area) {
            return this.captureArea(area);
        }
        
        return null;
    }
    
    // 取消区域选择（IPC处理器）
    async cancelAreaSelection() {
        if (this.selectorWindow && !this.selectorWindow.isDestroyed()) {
            this.selectorWindow.close();
            this.selectorWindow = null;
        }
        
        return null;
    }
    
    // 清理临时文件
    cleanTempFiles() {
        try {
            if (fs.existsSync(this.tempDir)) {
                const files = fs.readdirSync(this.tempDir);
                const now = Date.now();
                
                files.forEach(file => {
                    const filePath = path.join(this.tempDir, file);
                    const stats = fs.statSync(filePath);
                    
                    // 删除超过1小时的临时文件
                    if (now - stats.mtime.getTime() > 60 * 60 * 1000) {
                        fs.unlinkSync(filePath);
                        console.log('已清理截图临时文件:', filePath);
                    }
                });
            }
        } catch (error) {
            console.error('清理截图临时文件时出错:', error);
        }
    }
    
    // 获取可用的屏幕源
    async getAvailableScreens() {
        try {
            const sources = await desktopCapturer.getSources({
                types: ['screen'],
                thumbnailSize: { width: 300, height: 200 }
            });
            
            return sources.map(source => ({
                id: source.id,
                name: source.name,
                thumbnail: source.thumbnail.toDataURL()
            }));
        } catch (error) {
            console.error('获取屏幕源失败:', error);
            return [];
        }
    }
    
    // 销毁截图管理器
    destroy() {
        if (this.selectorWindow && !this.selectorWindow.isDestroyed()) {
            this.selectorWindow.close();
            this.selectorWindow = null;
        }
        
        this.cleanTempFiles();
        
        // 移除IPC处理器
        ipcMain.removeHandler('start-area-selection');
        ipcMain.removeHandler('complete-area-selection');
        ipcMain.removeHandler('cancel-area-selection');
    }
}

module.exports = ScreenshotManager;