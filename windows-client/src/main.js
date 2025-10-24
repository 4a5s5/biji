// Smart Note Collector Windows Client - 主进程
const { app, BrowserWindow, Tray, Menu, ipcMain, dialog, globalShortcut, screen, shell, nativeImage } = require('electron');
const path = require('path');
const fs = require('fs');
const Store = require('electron-store');
const ClipboardManager = require('./core/ClipboardManager');
const ScreenshotManager = require('./core/ScreenshotManager');
const WebCrawler = require('./core/WebCrawler');
const ApiClient = require('./core/ApiClient');
const NotificationManager = require('./core/NotificationManager');

// 初始化存储
const store = new Store();

// 全局变量
let mainWindow = null;
let settingsWindow = null;
let tray = null;
let clipboardManager = null;
let screenshotManager = null;
let webCrawler = null;
let apiClient = null;
let notificationManager = null;

// 应用配置
const APP_CONFIG = {
    isDev: process.argv.includes('--dev'),
    serverUrl: store.get('serverUrl', 'https://xhbahrcgycil.ap-northeast-1.clawcloudrun.com'),
    enableClipboardMonitor: store.get('enableClipboardMonitor', true),
    enableSystemStartup: store.get('enableSystemStartup', false),
    notificationDuration: store.get('notificationDuration', 15000), // 15秒
    minToTray: store.get('minToTray', true)
};

// =================
// 核心功能函数定义（需要在应用初始化前定义）
// =================

// 显示快速笔记对话框
async function showQuickNoteDialog() {
    try {
        if (!mainWindow) {
            console.warn('主窗口未初始化，无法显示快速笔记对话框');
            return;
        }
        
        const result = await dialog.showMessageBox(mainWindow, {
            type: 'question',
            buttons: ['取消', '添加文字笔记', '截图笔记', '爬取网页'],
            defaultId: 1,
            title: '快速添加笔记',
            message: '请选择要添加的笔记类型:'
        });
        
        switch (result.response) {
            case 1: // 添加文字笔记
                showTextNoteDialog();
                break;
            case 2: // 截图笔记
                if (screenshotManager) {
                    screenshotManager.takeScreenshot();
                }
                break;
            case 3: // 爬取网页
                showUrlInputDialog();
                break;
        }
    } catch (error) {
        console.error('显示快速笔记对话框失败:', error);
    }
}

// 显示文字笔记对话框
function showTextNoteDialog() {
    try {
        // 通过主窗口调用渲染进程的对话框
        if (mainWindow) {
            mainWindow.webContents.send('show-text-note-dialog');
            mainWindow.show();
            mainWindow.focus();
        }
    } catch (error) {
        console.error('显示文字笔记对话框失败:', error);
    }
}

// 显示URL输入对话框
async function showUrlInputDialog() {
    try {
        if (!mainWindow) {
            console.warn('主窗口未初始化，无法显示URL输入对话框');
            return;
        }
        
        // 创建一个简单的输入对话框
        const result = await dialog.showMessageBox(mainWindow, {
            type: 'question',
            buttons: ['取消', '确定'],
            defaultId: 1,
            title: '爬取网页',
            message: '请输入要爬取的网页地址:',
            detail: '将会自动提取网页的标题、描述和主要内容'
        });
        
        if (result.response === 1) {
            // 这里需要一个实际的输入框，暂时使用主窗口的输入功能
            if (mainWindow) {
                mainWindow.webContents.send('show-url-input-dialog');
                mainWindow.show();
                mainWindow.focus();
            }
        }
    } catch (error) {
        console.error('显示URL输入对话框失败:', error);
    }
}

// 确保单例运行
const gotTheLock = app.requestSingleInstanceLock();

if (!gotTheLock) {
    app.quit();
} else {
    app.on('second-instance', (event, commandLine, workingDirectory) => {
        // 当运行第二个实例时，将焦点设置到主窗口
        if (mainWindow) {
            if (mainWindow.isMinimized()) mainWindow.restore();
            mainWindow.focus();
        }
    });
}

// 应用就绪时
app.whenReady().then(() => {
    console.log('Smart Note Collector Windows Client 启动中...');
    
    // 初始化组件
    initializeComponents();
    
    // 创建系统托盘
    createTray();
    
    // 创建主窗口
    createMainWindow();
    
    // 注册全局快捷键
    registerGlobalShortcuts();
    
    // 启动剪切板监听
    if (APP_CONFIG.enableClipboardMonitor) {
        clipboardManager.startMonitoring();
    }
    
    console.log('Smart Note Collector 启动完成！');
});

// 初始化核心组件
function initializeComponents() {
    // 打印当前配置用于调试
    console.log('初始化组件时的配置:');
    console.log('  APP_CONFIG.serverUrl:', APP_CONFIG.serverUrl);
    console.log('  store.get("serverUrl"):', store.get('serverUrl'));

    // API客户端
    apiClient = new ApiClient(APP_CONFIG.serverUrl);
    console.log('API客户端已创建，服务器地址:', apiClient.serverUrl);
    
    // 通知管理器
    notificationManager = new NotificationManager();
    
    // 剪切板管理器
    clipboardManager = new ClipboardManager({
        onClipboardChange: handleClipboardChange,
        enabledTypes: ['text', 'image']
    });
    
    // 截图管理器
    screenshotManager = new ScreenshotManager({
        onScreenshotTaken: handleScreenshotTaken
    });
    
    // 网页爬虫
    webCrawler = new WebCrawler({
        onCrawlComplete: handleCrawlComplete
    });
}

// 创建系统托盘
function createTray() {
    const iconPath = path.join(__dirname, '../assets/tray-icon.png');
    
    // 检查图标文件是否存在，如果不存在则使用默认图标
    let trayIcon;
    if (require('fs').existsSync(iconPath)) {
        trayIcon = iconPath;
    } else {
        // 使用 Electron 内置的默认图标或创建一个简单的图标
        console.warn('托盘图标文件不存在，使用默认图标');
        trayIcon = nativeImage.createEmpty(); // 使用空图标
    }
    
    try {
        tray = new Tray(trayIcon);
    } catch (error) {
        console.warn('创建托盘图标失败，跳过托盘功能:', error.message);
        return;
    }
    
    const contextMenu = Menu.buildFromTemplate([
        {
            label: '显示主窗口',
            click: () => {
                if (mainWindow) {
                    if (mainWindow.isMinimized()) mainWindow.restore();
                    mainWindow.show();
                    mainWindow.focus();
                }
            }
        },
        { type: 'separator' },
        {
            label: '快速截图',
            accelerator: 'Ctrl+Shift+S',
            click: () => screenshotManager.takeScreenshot()
        },
        {
            label: '添加文字笔记',
            accelerator: 'Ctrl+Shift+N',
            click: () => showQuickNoteDialog()
        },
        {
            label: '爬取网页',
            click: () => showUrlInputDialog()
        },
        { type: 'separator' },
        {
            label: '剪切板监听',
            type: 'checkbox',
            checked: APP_CONFIG.enableClipboardMonitor,
            click: (menuItem) => {
                APP_CONFIG.enableClipboardMonitor = menuItem.checked;
                store.set('enableClipboardMonitor', menuItem.checked);
                
                if (menuItem.checked) {
                    clipboardManager.startMonitoring();
                } else {
                    clipboardManager.stopMonitoring();
                }
            }
        },
        {
            label: '设置',
            click: () => createSettingsWindow()
        },
        { type: 'separator' },
        {
            label: '关于',
            click: () => {
                dialog.showMessageBox(mainWindow, {
                    type: 'info',
                    title: '关于 Smart Note Collector',
                    message: 'Smart Note Collector Windows Client',
                    detail: '版本 1.0.0\\n\\n一个智能的笔记收集工具，支持剪切板监听、截图保存、网页爬取等功能。\\n\\n© 2024 Smart Note Collector Team'
                });
            }
        },
        {
            label: '退出',
            accelerator: 'Ctrl+Q',
            click: () => {
                app.isQuiting = true;
                app.quit();
            }
        }
    ]);
    
    tray.setToolTip('Smart Note Collector');
    tray.setContextMenu(contextMenu);
    
    // 双击托盘图标显示主窗口
    tray.on('double-click', () => {
        if (mainWindow) {
            if (mainWindow.isMinimized()) mainWindow.restore();
            mainWindow.show();
            mainWindow.focus();
        }
    });
}

// 创建主窗口
function createMainWindow() {
    const { width, height } = screen.getPrimaryDisplay().workAreaSize;
    
    // 检查应用图标是否存在
    const appIconPath = path.join(__dirname, '../assets/app-icon.png');
    const appIcon = require('fs').existsSync(appIconPath) ? appIconPath : undefined;
    
    mainWindow = new BrowserWindow({
        width: Math.min(1200, width - 100),
        height: Math.min(800, height - 100),
        minWidth: 800,
        minHeight: 600,
        icon: appIcon,
        webPreferences: {
            nodeIntegration: true,
            contextIsolation: false,
            enableRemoteModule: true
        },
        show: false // 初始隐藏，准备好后再显示
    });
    
    // 加载主页面
    const indexPath = path.join(__dirname, './ui/index.html');
    console.log('尝试加载主页面:', indexPath);
    console.log('__dirname:', __dirname);
    
    // 检查文件是否存在
    if (!require('fs').existsSync(indexPath)) {
        console.error('主页面文件不存在:', indexPath);
        console.error('尝试备用路径...');
        
        // 尝试备用路径
        const altPath = path.join(__dirname, '../ui/index.html');
        if (require('fs').existsSync(altPath)) {
            console.log('使用备用路径:', altPath);
            mainWindow.loadFile(altPath);
        } else {
            console.error('所有路径都无效，无法加载主页面');
            return;
        }
    } else {
        mainWindow.loadFile(indexPath);
    }
    
    // 窗口准备就绪时显示
    mainWindow.once('ready-to-show', () => {
        mainWindow.show();
        
        // 总是打开开发者工具方便调试
        mainWindow.webContents.openDevTools();
    });
    
    // 窗口关闭事件
    mainWindow.on('close', (event) => {
        if (!app.isQuiting && APP_CONFIG.minToTray) {
            // 最小化到托盘而不是完全退出
            event.preventDefault();
            mainWindow.hide();
            
            // 首次最小化时显示提示
            if (!store.get('hasShownTrayTip', false)) {
                notificationManager.showNotification({
                    title: 'Smart Note Collector',
                    body: '应用已最小化到系统托盘，点击托盘图标可重新打开',
                    type: 'info',
                    duration: 5000
                });
                store.set('hasShownTrayTip', true);
            }
        }
    });
    
    mainWindow.on('closed', () => {
        mainWindow = null;
    });
}

// 创建设置窗口
function createSettingsWindow() {
    if (settingsWindow) {
        settingsWindow.focus();
        return;
    }
    
    // 检查应用图标是否存在
    const appIconPath = path.join(__dirname, '../assets/app-icon.png');
    const appIcon = require('fs').existsSync(appIconPath) ? appIconPath : undefined;
    
    settingsWindow = new BrowserWindow({
        width: 600,
        height: 500,
        resizable: false,
        parent: mainWindow,
        modal: false, // 改为非模态，避免阻塞主窗口
        icon: appIcon,
        webPreferences: {
            nodeIntegration: true,
            contextIsolation: false
        }
    });
    
    // 尝试多个可能的路径
    const possiblePaths = [
        path.join(__dirname, 'ui', 'settings.html'),
        path.join(__dirname, '..', 'ui', 'settings.html'),
        path.join(__dirname, '..', 'src', 'ui', 'settings.html')
    ];

    console.log('__dirname:', __dirname);
    console.log('尝试的路径:', possiblePaths);

    let validPath = null;
    for (const testPath of possiblePaths) {
        console.log('检查路径:', testPath);
        if (fs.existsSync(testPath)) {
            validPath = testPath;
            console.log('✅ 找到有效路径:', validPath);
            break;
        } else {
            console.log('❌ 路径不存在:', testPath);
        }
    }

    if (validPath) {
        try {
            console.log('加载设置页面:', validPath);
            settingsWindow.loadFile(validPath);
        } catch (loadError) {
            console.error('加载设置页面失败:', loadError);
            dialog.showErrorBox('错误', `加载设置页面失败: ${loadError.message}`);
            settingsWindow.close();
            settingsWindow = null;
            return;
        }
    } else {
        console.error('所有路径都无效，无法找到设置页面');
        dialog.showErrorBox('错误', '设置页面文件不存在，无法打开设置窗口');
        settingsWindow.close();
        settingsWindow = null;
        return;
    }
    
    settingsWindow.on('closed', () => {
        settingsWindow = null;
    });
}

// 注册全局快捷键
function registerGlobalShortcuts() {
    // 快速截图
    globalShortcut.register('Ctrl+Shift+S', () => {
        screenshotManager.takeScreenshot();
    });
    
    // 快速添加文字笔记
    globalShortcut.register('Ctrl+Shift+N', () => {
        showQuickNoteDialog();
    });
    
    // 显示/隐藏主窗口
    globalShortcut.register('Ctrl+Shift+Q', () => {
        if (mainWindow) {
            if (mainWindow.isVisible()) {
                mainWindow.hide();
            } else {
                mainWindow.show();
                mainWindow.focus();
            }
        }
    });
    
    // 打开设置窗口
    globalShortcut.register('Ctrl+Shift+,', () => {
        createSettingsWindow();
    });
}

// 处理剪切板变化
async function handleClipboardChange(clipboardData) {
    console.log('剪切板内容变化:', clipboardData.type);
    
    try {
        // 显示剪切板内容通知，询问是否保存
        const result = await notificationManager.showClipboardNotification({
        title: '检测到剪切板新内容',
        body: clipboardData.type === 'text' ? 
            `文字: ${clipboardData.content.substring(0, 50)}${clipboardData.content.length > 50 ? '...' : ''}` :
            '图片内容',
        data: clipboardData,
        duration: APP_CONFIG.notificationDuration,
        buttons: [
            { text: '保存到笔记', action: 'save' },
            { text: '忽略', action: 'ignore' }
        ]
    });
    
        if (result === 'save') {
            await saveClipboardToNote(clipboardData);
        }
    } catch (error) {
        console.error('处理剪切板变化失败:', error);
        // 即使出错也不影响应用继续运行
    }
}

// 保存剪切板内容到笔记
async function saveClipboardToNote(clipboardData) {
    try {
        let noteData;
        
        if (clipboardData.type === 'text') {
            noteData = {
                title: `剪切板文字 - ${new Date().toLocaleString()}`,
                content: clipboardData.content,
                tags: ['剪切板', '文字'],
                source: {
                    type: 'clipboard_text',
                    timestamp: new Date().toISOString()
                }
            };
        } else if (clipboardData.type === 'image') {
            // 尝试上传图片
            const uploadResult = await apiClient.uploadImage(clipboardData.imagePath);
            
            noteData = {
                title: `剪切板图片 - ${new Date().toLocaleString()}`,
                content: uploadResult.localOnly ? 
                    `![剪切板图片](${clipboardData.imagePath})\\n\\n来源: 系统剪切板\\n注意: 图片仅保存在本地` :
                    `![剪切板图片](${uploadResult.url})\\n\\n来源: 系统剪切板`,
                tags: ['剪切板', '图片'],
                source: {
                    type: 'clipboard_image',
                    timestamp: new Date().toISOString(),
                    imageUrl: uploadResult.url || clipboardData.imagePath,
                    localOnly: uploadResult.localOnly || false
                }
            };
        }
        
        // 通过IPC发送到渲染进程显示主题选择对话框
        if (mainWindow) {
            console.log('📋 发送剪切板笔记主题选择对话框请求到渲染进程');
            mainWindow.webContents.send('show-theme-selection-dialog', noteData);
            mainWindow.show();
            mainWindow.focus();
        } else {
            console.error('主窗口不存在，无法显示主题选择对话框');
        }
        
    } catch (error) {
        console.error('保存剪切板内容失败:', error);
        notificationManager.showNotification({
            title: '保存失败',
            body: error.message,
            type: 'error',
            duration: 5000
        });
    }
}

// 处理截图完成
async function handleScreenshotTaken(screenshotData) {
    try {
        console.log('📷 开始处理截图:', screenshotData.filePath);

        // 再次验证截图文件存在（双重保险）
        if (!fs.existsSync(screenshotData.filePath)) {
            throw new Error(`截图文件已丢失: ${screenshotData.filePath}`);
        }

        // 上传截图
        console.log('📤 开始上传截图到服务器...');
        const uploadResult = await apiClient.uploadImage(screenshotData.filePath);

        const imageUrl = uploadResult.url || `file://${screenshotData.filePath}`;
        const noteTimestamp = new Date().toLocaleString();

        if (uploadResult.localOnly) {
            if (uploadResult.error) {
                console.warn('服务器截图上传失败，改用本地文件:', uploadResult.error);
                notificationManager.showNotification({
                    title: '图片上传失败，已改为本地保存',
                    body: uploadResult.error,
                    type: 'warning',
                    duration: 5000
                });
            }
        } else {
            try {
                await fs.promises.unlink(screenshotData.filePath);
                console.log('截图临时文件已删除:', screenshotData.filePath);
            } catch (cleanupError) {
                console.warn('删除截图临时文件失败:', cleanupError.message || cleanupError);
            }
        }

        const noteContent = uploadResult.localOnly
            ? `![截图](${imageUrl})\n\n截图时间: ${noteTimestamp}\n注：图片保存在本地`
            : `![截图](${imageUrl})\n\n截图时间: ${noteTimestamp}`;

        const noteData = {
            title: `截图 - ${noteTimestamp}`,
            content: noteContent,
            tags: ['截图', 'Windows客户端'],
            source: {
                type: 'windows_screenshot',
                timestamp: new Date().toISOString(),
                imageUrl: imageUrl,
                localOnly: uploadResult.localOnly || false
            }
        };
        // 通过IPC发送到渲染进程显示主题选择对话框
        if (mainWindow) {
            console.log('📋 发送主题选择对话框请求到渲染进程');
            mainWindow.webContents.send('show-theme-selection-dialog', noteData);
            mainWindow.show();
            mainWindow.focus();
        } else {
            console.error('主窗口不存在，无法显示主题选择对话框');
        }
        
    } catch (error) {
        console.error('处理截图失败:', error);
        notificationManager.showNotification({
            title: '截图保存失败',
            body: error.message,
            type: 'error',
            duration: 5000
        });
    }
}

// 处理网页爬取完成
async function handleCrawlComplete(crawlData) {
    try {
        let content = `# 网页内容爬取\\n\\n`;
        content += `**原始链接**: ${crawlData.url}\\n`;
        content += `**爬取时间**: ${new Date().toLocaleString()}\\n\\n`;
        
        if (crawlData.title) {
            content += `## 页面标题\\n${crawlData.title}\\n\\n`;
        }
        
        if (crawlData.description) {
            content += `## 页面描述\\n${crawlData.description}\\n\\n`;
        }
        
        if (crawlData.content) {
            content += `## 主要内容\\n${crawlData.content}\\n\\n`;
        }
        
        const noteData = {
            title: `网页爬取 - ${crawlData.title || crawlData.url}`,
            content: content,
            tags: ['网页爬取', 'Windows客户端'],
            source: {
                type: 'windows_webcrawl',
                url: crawlData.url,
                timestamp: new Date().toISOString()
            }
        };
        
        // 通过IPC发送到渲染进程显示主题选择对话框
        if (mainWindow) {
            console.log('📋 发送网页爬取笔记主题选择对话框请求到渲染进程');
            mainWindow.webContents.send('show-theme-selection-dialog', noteData);
            mainWindow.show();
            mainWindow.focus();
        } else {
            console.error('主窗口不存在，无法显示主题选择对话框');
        }
        
    } catch (error) {
        console.error('处理网页爬取失败:', error);
        notificationManager.showNotification({
            title: '网页爬取失败',
            body: error.message,
            type: 'error',
            duration: 5000
        });
    }
}


// IPC 消息处理
ipcMain.handle('get-app-config', () => {
    return APP_CONFIG;
});

ipcMain.handle('update-app-config', (event, newConfig) => {
    Object.assign(APP_CONFIG, newConfig);
    
    // 保存到持久化存储
    Object.keys(newConfig).forEach(key => {
        store.set(key, newConfig[key]);
    });
    
    // 应用配置变化
    if (newConfig.hasOwnProperty('enableClipboardMonitor')) {
        if (newConfig.enableClipboardMonitor) {
            clipboardManager.startMonitoring();
        } else {
            clipboardManager.stopMonitoring();
        }
    }
    
    if (newConfig.hasOwnProperty('serverUrl')) {
        apiClient.updateServerUrl(newConfig.serverUrl);
    }
    
    return true;
});

ipcMain.handle('take-screenshot', async () => {
    try {
        console.log('📷 收到截图请求');
        const result = await screenshotManager.takeScreenshot();

        if (result) {
            console.log('✅ 截图完成:', {
                filePath: result.filePath,
                filename: result.filename,
                size: result.size,
                fileSize: result.fileSize || '未知',
                timestamp: result.timestamp
            });
        } else {
            console.log('⚠️ 截图被用户取消');
        }

        return result;
    } catch (error) {
        console.error('❌ 截图失败:', error.message);
        console.error('❌ 错误详情:', error);
        throw error;
    }
});

// 添加图片上传处理器
ipcMain.handle('upload-image', async (event, imagePath) => {
    try {
        console.log('📷 收到图片上传请求:', imagePath);
        const result = await apiClient.uploadImage(imagePath);
        console.log('✅ 图片上传完成:', result);
        return result;
    } catch (error) {
        console.error('❌ 图片上传失败:', error);
        throw error;
    }
});

ipcMain.handle('crawl-webpage', async (event, url) => {
    try {
        console.log('🕷️ 收到网页爬取请求:', url);
        const result = await webCrawler.crawl(url);
        console.log('✅ 网页爬取完成:', result?.title || '无标题');
        return result;
    } catch (error) {
        console.error('❌ 网页爬取失败:', error);
        throw error;
    }
});

ipcMain.handle('save-note', async (event, noteData) => {
    try {
        console.log('💾 收到保存笔记请求:', noteData.title);
        const result = await apiClient.saveNote(noteData);
        console.log('✅ 笔记保存成功:', result);
        return result;
    } catch (error) {
        console.error('❌ 笔记保存失败:', error);
        throw error;
    }
});

ipcMain.handle('get-themes', async () => {
    try {
        console.log('收到get-themes请求');
        const result = await apiClient.getThemes();
        console.log('get-themes响应:', result);
        return result;
    } catch (error) {
        console.error('get-themes处理失败:', error);
        throw error;
    }
});

ipcMain.handle('get-notes', async (event, options = {}) => {
    try {
        console.log('收到get-notes请求:', options);
        const result = await apiClient.getNotes(options);
        console.log('get-notes响应:', result);
        return result;
    } catch (error) {
        console.error('get-notes处理失败:', error);
        throw error;
    }
});

ipcMain.handle('show-notification', async (event, options) => {
    return notificationManager.showNotification(options);
});

// 添加缺失的剪切板统计IPC处理器
ipcMain.handle('get-clipboard-stats', async () => {
    try {
        // 返回基本的剪切板统计信息
        return {
            success: true,
            data: {
                todayCount: 0,
                totalCount: 0,
                lastUpdate: new Date().toISOString()
            }
        };
    } catch (error) {
        console.error('获取剪切板统计失败:', error);
        return {
            success: false,
            error: error.message,
            data: {
                todayCount: 0,
                totalCount: 0,
                lastUpdate: null
            }
        };
    }
});

// 处理打开设置窗口的请求
ipcMain.on('open-settings-window', () => {
    console.log('收到打开设置窗口请求');
    try {
        createSettingsWindow();
    } catch (error) {
        console.error('创建设置窗口失败:', error);
    }
});

// 窗口控制
ipcMain.on('minimize-window', (event) => {
    const window = BrowserWindow.fromWebContents(event.sender);
    if (window) {
        window.minimize();
    }
});

ipcMain.on('close-window', (event) => {
    const window = BrowserWindow.fromWebContents(event.sender);
    if (window) {
        window.close();
    }
});

// 处理服务器连接测试
ipcMain.handle('test-server-connection', async (event, serverUrl) => {
    try {
        if (!serverUrl) {
            serverUrl = APP_CONFIG.serverUrl;
        }
        
        console.log('测试服务器连接:', serverUrl);
        
        // 使用 ApiClient 测试连接
        const testClient = new (require('./core/ApiClient'))(serverUrl);
        const result = await testClient.testConnection();
        
        console.log('连接测试结果:', result);
        return { connected: true, message: '连接成功', data: result };
    } catch (error) {
        console.error('连接测试失败:', error);
        return { connected: false, error: error.message || '连接失败' };
    }
});

// 处理获取服务器信息
ipcMain.handle('check-server-connection', async () => {
    try {
        console.log('收到检查服务器连接请求');
        const result = await apiClient.testConnection();

        if (!result.connected) {
            const errorMessage = result.error || '服务器连接失败，请检查网络或服务器状态';
            const error = new Error(errorMessage);
            error.data = {
                status: 'offline',
                version: result.data?.version || 'unknown',
                timestamp: new Date().toISOString()
            };
            throw error;
        }

        return {
            success: true,
            data: {
                status: 'online',
                version: result.data?.version || 'unknown',
                timestamp: result.data?.timestamp || new Date().toISOString()
            }
        };
    } catch (error) {
        console.error('检查服务器连接失败:', error);
        throw error;
    }
});

ipcMain.handle('get-server-info', async (event) => {
    try {
        const result = await apiClient.testConnection();
        return {
            success: true,
            data: {
                status: result.connected ? 'online' : 'offline',
                version: result.data?.version || 'unknown',
                timestamp: result.data?.timestamp || new Date().toISOString()
            }
        };
    } catch (error) {
        console.error('获取服务器信息失败:', error);
        return {
            success: false,
            error: error.message,
            data: {
                status: 'offline',
                version: 'unknown',
                timestamp: new Date().toISOString()
            }
        };
    }
});

// 处理获取统计信息
ipcMain.handle('get-statistics', async (event) => {
    try {
        // 返回基本统计信息
        return {
            success: true,
            data: {
                totalNotes: 0,
                todayAdded: 0,
                totalThemes: 1,
                lastSync: new Date().toISOString()
            }
        };
    } catch (error) {
        console.error('获取统计信息失败:', error);
        return {
            success: false,
            error: error.message,
            data: {
                totalNotes: 0,
                todayAdded: 0,
                totalThemes: 0,
                lastSync: null
            }
        };
    }
});

// 处理配置更新
ipcMain.handle('update-settings', async (event, newSettings) => {
    try {
        console.log('更新设置:', newSettings);
        
        // 更新应用配置
        if (newSettings.serverUrl && newSettings.serverUrl !== APP_CONFIG.serverUrl) {
            APP_CONFIG.serverUrl = newSettings.serverUrl;
            store.set('serverUrl', newSettings.serverUrl);
            
            // 更新 API 客户端
            if (apiClient) {
                apiClient.updateServerUrl(newSettings.serverUrl);
            }
            
            console.log('服务器地址已更新为:', newSettings.serverUrl);
        }
        
        // 更新其他配置
        Object.keys(newSettings).forEach(key => {
            if (key !== 'serverUrl') {
                APP_CONFIG[key] = newSettings[key];
                store.set(key, newSettings[key]);
            }
        });
        
        return { success: true, message: '设置已保存' };
    } catch (error) {
        console.error('更新设置失败:', error);
        return { success: false, error: error.message };
    }
});

// 应用退出前清理
app.on('before-quit', () => {
    app.isQuiting = true;
    
    // 停止剪切板监听
    if (clipboardManager) {
        clipboardManager.stopMonitoring();
    }
    
    // 注销全局快捷键
    globalShortcut.unregisterAll();
});

app.on('window-all-closed', () => {
    // 在 macOS 上，应用通常会保持活动状态，即使没有打开的窗口
    if (process.platform !== 'darwin') {
        app.quit();
    }
});

app.on('activate', () => {
    // 在 macOS 上，当应用图标被点击并且没有其他窗口打开时，重新创建窗口
    if (BrowserWindow.getAllWindows().length === 0) {
        createMainWindow();
    }
});

module.exports = {
    mainWindow,
    settingsWindow,
    APP_CONFIG,
    clipboardManager,
    screenshotManager,
    webCrawler,
    apiClient,
    notificationManager
};