// 通知管理器 - 处理剪切板通知和其他系统通知
const { BrowserWindow, screen, ipcMain, Notification } = require('electron');
const path = require('path');

class NotificationManager {
    constructor() {
        this.notificationWindows = new Map(); // 存储通知窗口
        this.nextNotificationId = 1;
        this.maxNotifications = 2; // 最大同时显示的通知数量（减少到2个）
        this.notificationSpacing = 10; // 通知之间的间距
        this.notificationWidth = 350;
        this.notificationHeight = 120;
        
        // 绑定IPC处理器
        this.bindIpcHandlers();
    }
    
    // 绑定IPC处理器
    bindIpcHandlers() {
        ipcMain.handle('notification-action', (event, notificationId, action) => {
            return this.handleNotificationAction(notificationId, action);
        });
        
        ipcMain.handle('close-notification', (event, notificationId) => {
            return this.closeNotification(notificationId);
        });
    }
    
    // 显示剪切板通知（类似弹窗广告的形式）
    async showClipboardNotification(options) {
        // 限制同时显示的通知数量
        if (this.notificationWindows.size >= this.maxNotifications) {
            console.log('通知数量已达上限，忽略新通知');
            return 'ignore';
        }
        
        return new Promise((resolve) => {
            const notificationId = this.nextNotificationId++;
            const primaryDisplay = screen.getPrimaryDisplay();
            const { width: screenWidth, height: screenHeight } = primaryDisplay.workAreaSize;
            
            // 计算通知位置（右下角堆叠）
            const position = this.calculateNotificationPosition();
            
            // 创建通知窗口
            const notificationWindow = new BrowserWindow({
                width: this.notificationWidth,
                height: this.notificationHeight,
                x: position.x,
                y: position.y,
                frame: false,
                alwaysOnTop: true,
                skipTaskbar: true,
                resizable: false,
                movable: false,
                minimizable: false,
                maximizable: false,
                closable: false,
                focusable: false,
                show: false,
                webPreferences: {
                    nodeIntegration: true,
                    contextIsolation: false
                }
            });
            
            // 加载通知页面
            notificationWindow.loadFile(path.join(__dirname, '../ui/notification.html'));
            
            // 窗口准备就绪时显示
            notificationWindow.once('ready-to-show', () => {
                // 发送通知数据到渲染进程
                notificationWindow.webContents.send('init-notification', {
                    id: notificationId,
                    title: options.title,
                    body: options.body,
                    data: options.data,
                    buttons: options.buttons || [
                        { text: '保存', action: 'save' },
                        { text: '忽略', action: 'ignore' }
                    ],
                    duration: options.duration || 15000
                });
                
                // 显示窗口并添加动画效果
                notificationWindow.show();
                this.animateNotificationIn(notificationWindow);
            });
            
            // 存储通知窗口和回调
            this.notificationWindows.set(notificationId, {
                window: notificationWindow,
                resolve: resolve,
                startTime: Date.now(),
                duration: options.duration || 15000
            });
            
            // 设置自动关闭定时器
            setTimeout(() => {
                if (this.notificationWindows.has(notificationId)) {
                    this.closeNotification(notificationId);
                    resolve('timeout'); // 超时返回
                }
            }, options.duration || 15000);
            
            // 监听窗口关闭事件
            notificationWindow.on('closed', () => {
                this.notificationWindows.delete(notificationId);
                this.rearrangeNotifications();
            });
        });
    }
    
    // 显示普通系统通知
    showNotification(options) {
        const { title, body, type = 'info', duration = 3000 } = options;
        
        // 使用Electron的原生通知API
        if (Notification.isSupported()) {
            const notification = new Notification({
                title: title,
                body: body,
                icon: path.join(__dirname, '../assets/app-icon.png'),
                silent: false
            });
            
            notification.show();
            
            // 自动关闭
            if (duration > 0) {
                setTimeout(() => {
                    notification.close();
                }, duration);
            }
            
            return notification;
        } else {
            // 降级到控制台输出
            console.log(`Notification: ${title} - ${body}`);
        }
    }
    
    // 计算通知位置
    calculateNotificationPosition() {
        const primaryDisplay = screen.getPrimaryDisplay();
        const { width: screenWidth, height: screenHeight } = primaryDisplay.workAreaSize;
        
        // 从右下角开始堆叠
        const baseX = screenWidth - this.notificationWidth - 20;
        const baseY = screenHeight - this.notificationHeight - 20;
        
        // 计算当前有多少个通知
        const existingNotifications = this.notificationWindows.size;
        
        return {
            x: baseX,
            y: baseY - (existingNotifications * (this.notificationHeight + this.notificationSpacing))
        };
    }
    
    // 处理通知操作
    handleNotificationAction(notificationId, action) {
        const notificationData = this.notificationWindows.get(notificationId);
        if (notificationData) {
            const { resolve } = notificationData;
            this.closeNotification(notificationId);
            resolve(action);
            return true;
        }
        return false;
    }
    
    // 关闭通知
    closeNotification(notificationId) {
        const notificationData = this.notificationWindows.get(notificationId);
        if (notificationData) {
            const { window } = notificationData;
            
            // 添加关闭动画
            this.animateNotificationOut(window, () => {
                if (!window.isDestroyed()) {
                    window.close();
                }
            });
            
            this.notificationWindows.delete(notificationId);
            return true;
        }
        return false;
    }
    
    // 重新排列通知位置
    rearrangeNotifications() {
        const notifications = Array.from(this.notificationWindows.values());
        
        notifications.forEach((notificationData, index) => {
            const { window } = notificationData;
            if (!window.isDestroyed()) {
                const position = this.calculateNotificationPositionForIndex(index);
                window.setPosition(position.x, position.y, true);
            }
        });
    }
    
    // 为指定索引计算通知位置
    calculateNotificationPositionForIndex(index) {
        const primaryDisplay = screen.getPrimaryDisplay();
        const { width: screenWidth, height: screenHeight } = primaryDisplay.workAreaSize;
        
        const baseX = screenWidth - this.notificationWidth - 20;
        const baseY = screenHeight - this.notificationHeight - 20;
        
        return {
            x: baseX,
            y: baseY - (index * (this.notificationHeight + this.notificationSpacing))
        };
    }
    
    // 通知进入动画
    animateNotificationIn(window) {
        if (window.isDestroyed()) return;
        
        const startOpacity = 0;
        const endOpacity = 0.95;
        const duration = 300; // 毫秒
        const steps = 20;
        const stepDuration = duration / steps;
        const opacityStep = (endOpacity - startOpacity) / steps;
        
        let currentStep = 0;
        window.setOpacity(startOpacity);
        
        const animate = () => {
            if (window.isDestroyed()) return;
            
            currentStep++;
            const newOpacity = startOpacity + (opacityStep * currentStep);
            window.setOpacity(Math.min(newOpacity, endOpacity));
            
            if (currentStep < steps) {
                setTimeout(animate, stepDuration);
            }
        };
        
        animate();
    }
    
    // 通知退出动画
    animateNotificationOut(window, callback) {
        if (window.isDestroyed()) {
            callback && callback();
            return;
        }
        
        const startOpacity = window.getOpacity();
        const endOpacity = 0;
        const duration = 200; // 毫秒
        const steps = 15;
        const stepDuration = duration / steps;
        const opacityStep = (startOpacity - endOpacity) / steps;
        
        let currentStep = 0;
        
        const animate = () => {
            if (window.isDestroyed()) {
                callback && callback();
                return;
            }
            
            currentStep++;
            const newOpacity = startOpacity - (opacityStep * currentStep);
            window.setOpacity(Math.max(newOpacity, endOpacity));
            
            if (currentStep >= steps) {
                callback && callback();
            } else {
                setTimeout(animate, stepDuration);
            }
        };
        
        animate();
    }
    
    // 关闭所有通知
    closeAllNotifications() {
        const notificationIds = Array.from(this.notificationWindows.keys());
        notificationIds.forEach(id => this.closeNotification(id));
    }
    
    // 获取当前通知数量
    getNotificationCount() {
        return this.notificationWindows.size;
    }
    
    // 检查是否达到最大通知数量
    isAtMaxCapacity() {
        return this.notificationWindows.size >= this.maxNotifications;
    }
    
    // 清理过期通知
    cleanupExpiredNotifications() {
        const now = Date.now();
        const expiredNotifications = [];
        
        this.notificationWindows.forEach((notificationData, id) => {
            const { startTime, duration } = notificationData;
            if (now - startTime >= duration) {
                expiredNotifications.push(id);
            }
        });
        
        expiredNotifications.forEach(id => {
            this.closeNotification(id);
        });
    }
    
    // 销毁通知管理器
    destroy() {
        this.closeAllNotifications();
        
        // 移除IPC处理器
        ipcMain.removeHandler('notification-action');
        ipcMain.removeHandler('close-notification');
    }
}

module.exports = NotificationManager;