// Smart Note Collector - Popup Script
// 处理弹窗界面的交互逻辑

// 全局变量
let currentServerUrl = 'http://localhost:3000';

document.addEventListener('DOMContentLoaded', async () => {
    // configManager 已通过 config.js 全局可用
    currentServerUrl = await configManager.getServerUrl();
    console.log('Popup loaded');
    
    // 初始化界面
    await initializePopup();
    
    // 绑定事件监听器
    bindEventListeners();
    
    // 检查服务器状态
    await checkServerStatus();
    
    // 加载主题列表
    await loadThemes();
    
    // 加载最近笔记
    await loadRecentNotes();
});

// 初始化弹窗
async function initializePopup() {
    // 获取当前标签页信息
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    
    if (tab) {
        // 自动填充页面标题
        const titleInput = document.getElementById('noteTitle');
        if (!titleInput.value) {
            titleInput.value = `网页摘录 - ${tab.title}`;
        }
        
        // 尝试获取选中的文本
        try {
            const results = await chrome.scripting.executeScript({
                target: { tabId: tab.id },
                function: () => window.getSelection().toString().trim()
            });
            
            const selectedText = results[0].result;
            if (selectedText) {
                document.getElementById('noteContent').value = selectedText;
            }
        } catch (error) {
            console.log('Cannot access tab content:', error);
        }
    }
}

// 绑定事件监听器
function bindEventListeners() {
    // 保存笔记按钮
    document.getElementById('saveNoteBtn').addEventListener('click', saveNote);
    
    // 获取当前页面按钮
    document.getElementById('getCurrentPageBtn').addEventListener('click', getCurrentPage);
    
    // 打开Web应用按钮
    document.getElementById('openWebAppBtn').addEventListener('click', async () => {
        const serverUrl = await configManager.getServerUrl();
        chrome.tabs.create({ url: serverUrl });
        window.close();
    });
    
    // 设置按钮
    document.getElementById('settingsBtn').addEventListener('click', showSettings);
    
    // 截图按钮
    document.getElementById('screenshotBtn').addEventListener('click', async () => {
        try {
            showLoading(true);
            const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
            
            if (!tab) {
                showToast('无法获取当前页面', 'error');
                return;
            }
            
            // 发送消息给background script处理截图
            chrome.runtime.sendMessage({
                action: 'captureScreenshot',
                tab: tab
            }, (response) => {
                showLoading(false);
                if (response && response.success) {
                    showToast('截图已保存到笔记', 'success');
                    loadRecentNotes();
                } else {
                    showToast(response?.error || '截图失败', 'error');
                }
            });
        } catch (error) {
            showLoading(false);
            console.error('Screenshot error:', error);
            showToast('截图失败: ' + error.message, 'error');
        }
    });
    
    // 爬取当前页面按钮
    document.getElementById('crawlPageBtn').addEventListener('click', async () => {
        try {
            showLoading(true);
            const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
            
            if (!tab) {
                showToast('无法获取当前页面', 'error');
                return;
            }
            
            // 发送消息给background script处理爬取
            chrome.runtime.sendMessage({
                action: 'crawlPage',
                url: tab.url,
                tab: tab
            }, (response) => {
                showLoading(false);
                if (response && response.success) {
                    showToast('页面内容已爬取并保存', 'success');
                    loadRecentNotes();
                } else {
                    showToast(response?.error || '爬取失败', 'error');
                }
            });
        } catch (error) {
            showLoading(false);
            console.error('Crawl error:', error);
            showToast('爬取失败: ' + error.message, 'error');
        }
    });
    
    // 爬取链接按钮
    document.getElementById('crawlLinkBtn').addEventListener('click', async () => {
        const url = prompt('请输入要爬取的链接地址:');
        if (!url) return;
        
        try {
            showLoading(true);
            const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
            
            // 发送消息给background script处理爬取
            chrome.runtime.sendMessage({
                action: 'crawlPage',
                url: url,
                tab: tab || { title: '手动输入', url: url }
            }, (response) => {
                showLoading(false);
                if (response && response.success) {
                    showToast('链接内容已爬取并保存', 'success');
                    loadRecentNotes();
                } else {
                    showToast(response?.error || '爬取失败', 'error');
                }
            });
        } catch (error) {
            showLoading(false);
            console.error('Crawl link error:', error);
            showToast('爬取失败: ' + error.message, 'error');
        }
    });
    
    // 表单快捷键
    document.addEventListener('keydown', (e) => {
        if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
            e.preventDefault();
            saveNote();
        }
    });
}

// 检查服务器状态
async function checkServerStatus() {
    const statusDot = document.getElementById('statusDot');
    const statusText = document.getElementById('statusText');
    
    try {
        const serverUrl = await configManager.getServerUrl();
        const response = await fetch(`${serverUrl}/api/health`);
        if (response.ok) {
            statusDot.className = 'status-dot connected';
            statusText.textContent = '已连接';
        } else {
            throw new Error('Server not responding');
        }
    } catch (error) {
        statusDot.className = 'status-dot disconnected';
        statusText.textContent = '未连接';
        console.error('Server connection failed:', error);
    }
}

// 加载主题列表
async function loadThemes() {
    try {
        const serverUrl = await configManager.getServerUrl();
        const response = await fetch(`${serverUrl}/api/themes`);
        if (response.ok) {
            const themes = await response.json();
            const themeSelect = document.getElementById('noteTheme');
            
            // 清空现有选项
            themeSelect.innerHTML = '';
            
            // 添加主题选项
            themes.forEach(theme => {
                const option = document.createElement('option');
                option.value = theme.id;
                option.textContent = theme.name;
                themeSelect.appendChild(option);
            });
        }
    } catch (error) {
        console.error('Failed to load themes:', error);
    }
}

// 加载最近笔记
async function loadRecentNotes() {
    const recentNotesContainer = document.getElementById('recentNotes');
    
    try {
        const serverUrl = await configManager.getServerUrl();
        const response = await fetch(`${serverUrl}/api/notes?limit=5`);
        if (response.ok) {
            const data = await response.json();
            const notes = data.notes || [];
            
            if (notes.length === 0) {
                recentNotesContainer.innerHTML = '<div class="loading">暂无笔记</div>';
                return;
            }
            
            recentNotesContainer.innerHTML = '';
            notes.forEach(note => {
                const noteItem = document.createElement('div');
                noteItem.className = 'recent-note-item';
                noteItem.innerHTML = `
                    <div class="recent-note-title">${truncateText(note.title, 30)}</div>
                    <div class="recent-note-preview">${truncateText(note.content, 50)}</div>
                `;
                
                noteItem.addEventListener('click', () => {
                    // 点击笔记项时填充到表单中
                    document.getElementById('noteTitle').value = note.title;
                    document.getElementById('noteContent').value = note.content;
                    document.getElementById('noteTheme').value = note.theme;
                    if (note.tags) {
                        document.getElementById('noteTags').value = note.tags.join(', ');
                    }
                });
                
                recentNotesContainer.appendChild(noteItem);
            });
        } else {
            throw new Error('Failed to fetch notes');
        }
    } catch (error) {
        console.error('Failed to load recent notes:', error);
        recentNotesContainer.innerHTML = '<div class="loading">加载失败</div>';
    }
}

// 获取当前页面信息
async function getCurrentPage() {
    try {
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        
        if (!tab) {
            showToast('无法获取当前页面信息', 'error');
            return;
        }
        
        // 填充页面信息
        document.getElementById('noteTitle').value = tab.title;
        
        let content = `页面标题: ${tab.title}\n页面地址: ${tab.url}\n`;
        
        // 尝试获取页面描述
        try {
            const results = await chrome.scripting.executeScript({
                target: { tabId: tab.id },
                function: () => {
                    const description = document.querySelector('meta[name="description"]')?.content || '';
                    const selectedText = window.getSelection().toString().trim();
                    return { description, selectedText };
                }
            });
            
            const pageData = results[0].result;
            if (pageData.description) {
                content += `页面描述: ${pageData.description}\n`;
            }
            if (pageData.selectedText) {
                content += `\n选中内容:\n${pageData.selectedText}`;
            }
        } catch (error) {
            console.log('Cannot access page content:', error);
        }
        
        document.getElementById('noteContent').value = content;
        document.getElementById('noteTags').value = '网页收集, 浏览器';
        
        showToast('页面信息获取成功', 'success');
        
    } catch (error) {
        console.error('Failed to get current page:', error);
        showToast('获取页面信息失败', 'error');
    }
}

// 保存笔记
async function saveNote() {
    const title = document.getElementById('noteTitle').value.trim();
    const content = document.getElementById('noteContent').value.trim();
    const theme = document.getElementById('noteTheme').value;
    const tagsInput = document.getElementById('noteTags').value.trim();
    
    // 验证输入
    if (!title) {
        showToast('请输入笔记标题', 'error');
        return;
    }
    
    if (!content) {
        showToast('请输入笔记内容', 'error');
        return;
    }
    
    // 处理标签
    const tags = tagsInput ? tagsInput.split(',').map(tag => tag.trim()).filter(tag => tag) : [];
    
    // 获取当前页面信息作为来源
    let source = null;
    try {
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        if (tab) {
            source = {
                type: 'chrome_extension_popup',
                url: tab.url,
                title: tab.title,
                timestamp: new Date().toISOString()
            };
        }
    } catch (error) {
        console.log('Cannot get tab info:', error);
    }
    
    const noteData = {
        title: title,
        content: content,
        theme: theme,
        tags: tags,
        source: source
    };
    
    // 显示加载状态
    showLoading(true);
    
    try {
        const serverUrl = await configManager.getServerUrl();
        const response = await fetch(`${serverUrl}/api/quick-import`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(noteData)
        });
        
        if (response.ok) {
            const result = await response.json();
            showToast('笔记保存成功！', 'success');
            
            // 清空表单
            document.getElementById('noteTitle').value = '';
            document.getElementById('noteContent').value = '';
            document.getElementById('noteTags').value = '';
            
            // 重新加载最近笔记
            await loadRecentNotes();
            
        } else {
            const errorData = await response.json().catch(() => ({}));
            throw new Error(errorData.error || `HTTP ${response.status}`);
        }
        
    } catch (error) {
        console.error('Failed to save note:', error);
        showToast('保存失败: ' + error.message, 'error');
    } finally {
        showLoading(false);
    }
}

// 显示设置
async function showSettings() {
    try {
        const currentUrl = await configManager.getServerUrl();
        const serverUrl = prompt('请输入服务器地址:', currentUrl);
        
        if (serverUrl && serverUrl !== currentUrl) {
            // 验证URL格式
            if (!configManager.validateServerUrl(serverUrl)) {
                showToast('服务器地址格式不正确', 'error');
                return;
            }
            
            // 直接保存地址，不测试连接
            showToast('正在保存设置...', 'info');
            const saved = await configManager.setServerUrl(serverUrl);
            
            if (saved) {
                currentServerUrl = serverUrl;
                showToast('服务器地址已保存', 'success');
                
                // 重新检查状态和加载数据
                await checkServerStatus();
                await loadThemes();
                await loadRecentNotes();
            } else {
                showToast('保存失败，请重试', 'error');
            }
        }
    } catch (error) {
        console.error('Settings error:', error);
        showToast('设置保存失败: ' + error.message, 'error');
    }
}

// 显示/隐藏加载状态
function showLoading(show) {
    const overlay = document.getElementById('loadingOverlay');
    overlay.style.display = show ? 'flex' : 'none';
}

// 显示Toast消息
function showToast(message, type = 'info') {
    // 创建toast元素
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.textContent = message;
    
    toast.style.cssText = `
        position: fixed;
        top: 10px;
        right: 10px;
        z-index: 2000;
        padding: 8px 12px;
        border-radius: 4px;
        color: white;
        font-size: 12px;
        font-weight: 500;
        max-width: 200px;
        animation: slideIn 0.3s ease;
    `;
    
    // 设置颜色
    if (type === 'success') {
        toast.style.background = '#2ecc71';
    } else if (type === 'error') {
        toast.style.background = '#e74c3c';
    } else {
        toast.style.background = '#3498db';
    }
    
    document.body.appendChild(toast);
    
    // 3秒后移除
    setTimeout(() => {
        if (toast.parentNode) {
            toast.parentNode.removeChild(toast);
        }
    }, 3000);
}

// 截断文本
function truncateText(text, maxLength) {
    if (text.length <= maxLength) {
        return text;
    }
    return text.substring(0, maxLength) + '...';
}
