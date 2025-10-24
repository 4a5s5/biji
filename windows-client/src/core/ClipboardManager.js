// 剪切板管理器 - 监听剪切板变化并触发通知
const { clipboard, nativeImage } = require('electron');
const fs = require('fs');
const path = require('path');
const os = require('os');

class ClipboardManager {
    constructor(options = {}) {
        this.onClipboardChange = options.onClipboardChange || (() => {});
        this.enabledTypes = options.enabledTypes || ['text', 'image'];
        this.checkInterval = options.checkInterval || 1000; // 检查间隔，毫秒
        
        this.isMonitoring = false;
        this.intervalId = null;
        this.lastClipboardContent = null;
        this.lastClipboardType = null;
        this.consecutiveErrors = 0; // 连续错误计数
        
        // 临时文件目录
        this.tempDir = path.join(os.tmpdir(), 'smart-note-collector');
        this.ensureTempDir();
    }
    
    // 确保临时目录存在
    ensureTempDir() {
        if (!fs.existsSync(this.tempDir)) {
            fs.mkdirSync(this.tempDir, { recursive: true });
        }
    }
    
    // 开始监听剪切板
    startMonitoring() {
        if (this.isMonitoring) {
            console.log('剪切板监听已经在运行中');
            return;
        }
        
        console.log('开始监听剪切板变化...');
        this.isMonitoring = true;
        
        // 初始化当前剪切板内容
        this.updateLastClipboardContent();
        
        // 设置定时检查
        this.intervalId = setInterval(() => {
            this.checkClipboardChange();
        }, this.checkInterval);
    }
    
    // 停止监听剪切板
    stopMonitoring() {
        if (!this.isMonitoring) {
            return;
        }
        
        console.log('停止监听剪切板变化...');
        this.isMonitoring = false;
        
        if (this.intervalId) {
            clearInterval(this.intervalId);
            this.intervalId = null;
        }
    }
    
    // 检查剪切板变化
    checkClipboardChange() {
        try {
            const currentContent = this.getCurrentClipboardContent();
            
            if (currentContent && this.hasClipboardChanged(currentContent)) {
                console.log('检测到剪切板内容变化:', currentContent.type);
                
                // 更新最后的剪切板内容
                this.lastClipboardContent = currentContent.content;
                this.lastClipboardType = currentContent.type;
                
                // 如果是图片，现在才保存临时文件
                if (currentContent.type === 'image' && currentContent.image) {
                    const imagePath = this.saveImageToTemp(currentContent.image);
                    currentContent.imagePath = imagePath;
                    delete currentContent.image; // 清理图片对象，避免内存泄漏
                }
                
                // 触发回调（添加异常处理）
                try {
                    this.onClipboardChange(currentContent);
                    this.consecutiveErrors = 0; // 成功后重置错误计数
                } catch (callbackError) {
                    console.error('剪切板变化回调失败:', callbackError);
                    this.consecutiveErrors++;
                    
                    // 如果回调持续失败，暂停一段时间
                    if (this.consecutiveErrors > 3) {
                        console.warn('剪切板回调连续失败次数过多，暂停监听30秒');
                        this.stopMonitoring();
                        setTimeout(() => {
                            console.log('重新启动剪切板监听');
                            this.startMonitoring();
                            this.consecutiveErrors = 0;
                        }, 30000);
                    }
                }
            }
        } catch (error) {
            console.error('检查剪切板变化时出错:', error);
        }
    }
    
    // 获取当前剪切板内容
    getCurrentClipboardContent() {
        try {
            // 优先检查图片
            if (this.enabledTypes.includes('image') && clipboard.availableFormats().includes('image/png')) {
                const image = clipboard.readImage();
                if (!image.isEmpty()) {
                    // 使用图片数据的哈希作为内容标识，而不是文件路径
                    const imageBuffer = image.toPNG();
                    const imageHash = require('crypto').createHash('md5').update(imageBuffer).digest('hex');
                    
                    return {
                        type: 'image',
                        content: imageHash, // 使用哈希值作为内容标识
                        image: image, // 保存图片对象，稍后需要时再保存文件
                        size: image.getSize(),
                        format: 'png'
                    };
                }
            }
            
            // 检查文本
            if (this.enabledTypes.includes('text')) {
                const text = clipboard.readText();
                if (text && text.trim().length > 0) {
                    return {
                        type: 'text',
                        content: text.trim(),
                        length: text.trim().length
                    };
                }
            }
            
            return null;
        } catch (error) {
            console.error('读取剪切板内容时出错:', error);
            return null;
        }
    }
    
    // 检查剪切板是否发生变化
    hasClipboardChanged(currentContent) {
        if (!currentContent) {
            return false;
        }
        
        // 类型不同
        if (currentContent.type !== this.lastClipboardType) {
            return true;
        }
        
        // 内容不同
        if (currentContent.content !== this.lastClipboardContent) {
            return true;
        }
        
        return false;
    }
    
    // 保存图片到临时文件
    saveImageToTemp(image) {
        try {
            const timestamp = Date.now();
            const filename = `clipboard-image-${timestamp}.png`;
            const filePath = path.join(this.tempDir, filename);
            
            const buffer = image.toPNG();
            fs.writeFileSync(filePath, buffer);
            
            console.log('剪切板图片已保存到:', filePath);
            return filePath;
        } catch (error) {
            console.error('保存剪切板图片失败:', error);
            throw error;
        }
    }
    
    // 更新最后的剪切板内容
    updateLastClipboardContent() {
        const currentContent = this.getCurrentClipboardContent();
        if (currentContent) {
            this.lastClipboardContent = currentContent.content;
            this.lastClipboardType = currentContent.type;
        }
    }
    
    // 手动获取当前剪切板内容（用于主动查询）
    getCurrentContent() {
        return this.getCurrentClipboardContent();
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
                        console.log('已清理临时文件:', filePath);
                    }
                });
            }
        } catch (error) {
            console.error('清理临时文件时出错:', error);
        }
    }
    
    // 设置剪切板内容
    setClipboardText(text) {
        try {
            clipboard.writeText(text);
            // 更新内部状态以避免触发自己的变化检测
            this.lastClipboardContent = text;
            this.lastClipboardType = 'text';
        } catch (error) {
            console.error('设置剪切板文本失败:', error);
            throw error;
        }
    }
    
    // 设置剪切板图片
    setClipboardImage(imagePath) {
        try {
            const image = nativeImage.createFromPath(imagePath);
            clipboard.writeImage(image);
            // 更新内部状态
            this.lastClipboardContent = imagePath;
            this.lastClipboardType = 'image';
        } catch (error) {
            console.error('设置剪切板图片失败:', error);
            throw error;
        }
    }
    
    // 获取剪切板格式
    getAvailableFormats() {
        try {
            return clipboard.availableFormats();
        } catch (error) {
            console.error('获取剪切板格式失败:', error);
            return [];
        }
    }
    
    // 销毁管理器
    destroy() {
        this.stopMonitoring();
        this.cleanTempFiles();
    }
}

module.exports = ClipboardManager;