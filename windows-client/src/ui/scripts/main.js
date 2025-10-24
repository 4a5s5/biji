// Smart Note Collector - 主JavaScript文件
const { ipcRenderer } = require('electron');

// 将 ipcRenderer 设为全局变量供其他脚本使用
window.ipcRenderer = ipcRenderer;

// ===== 工具函数定义 (必须在所有其他脚本调用前定义) =====

// HTML转义
function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// 更新操作状态
function updateOperationStatus(status) {
    const statusElement = document.getElementById('operationStatus');
    if (statusElement) {
        statusElement.textContent = status;
    }
}

// 显示通知
function showNotification(title, message, type = 'info') {
    const container = document.getElementById('notificationsContainer');
    if (!container) return;

    const notification = document.createElement('div');
    notification.className = `notification ${type}`;

    const icons = {
        success: '✅',
        error: '❌',
        warning: '⚠️',
        info: 'ℹ️'
    };

    notification.innerHTML = `
        <div class="notification-content">
            <div class="notification-icon">${icons[type] || icons.info}</div>
            <div class="notification-text">
                <div class="notification-title">${escapeHtml(title)}</div>
                <div class="notification-message">${escapeHtml(message)}</div>
            </div>
            <button class="notification-close" onclick="this.parentElement.parentElement.remove()">×</button>
        </div>
    `;

    container.appendChild(notification);

    // 3秒后自动移除
    setTimeout(() => {
        if (notification.parentElement) {
            notification.remove();
        }
    }, 3000);
}

// 将工具函数设为全局变量供其他脚本使用
window.updateOperationStatus = updateOperationStatus;
window.showNotification = showNotification;
window.escapeHtml = escapeHtml;

// 声明其他需要共享的函数为全局变量
// 主题选择函数
window.selectTheme = async function(themeId) {
    console.log('切换主题到:', themeId);
    currentThemeFilter = themeId;

    // 更新主题列表UI
    const themeItems = document.querySelectorAll('.theme-item');
    themeItems.forEach(item => {
        if (item.dataset.theme === themeId) {
            item.classList.add('active');
        } else {
            item.classList.remove('active');
        }
    });

    // 重新加载笔记
    currentPage = 1;
    if (window.loadNotes) {
        await window.loadNotes(1, { theme: themeId === 'all' ? undefined : themeId });
    }
};

// 笔记加载函数
window.loadNotes = async function(page = 1, options = {}) {
    console.log('加载笔记:', { page, options });

    try {
        updateOperationStatus('加载笔记中...');

        const queryOptions = {
            page: page,
            limit: 20,
            theme: options.theme || (currentThemeFilter === 'all' ? undefined : currentThemeFilter),
            search: options.search || currentSearchQuery,
            ...options
        };

        const result = await window.ipcRenderer.invoke('get-notes', queryOptions);

        if (result && result.notes) {
            currentNotes = result.notes;
            currentPage = result.page || page;
            totalPages = result.totalPages || 1;

            // 更新笔记列表显示
            if (window.notesManager) {
                window.notesManager.displayNotes(result.notes);
                window.notesManager.updatePagination(result.page, result.totalPages);
            } else {
                // 备用显示方式
                console.log('NotesManager未准备好，加载了', result.notes.length, '条笔记');
                updateNotesList();
                updatePagination();
            }

            // 更新状态栏
            updateNoteCountStatus(result.total || result.notes.length);
        }

        updateOperationStatus('就绪');
        return result;
    } catch (error) {
        console.error('加载笔记失败:', error);
        updateOperationStatus('加载失败');
        showNotification('加载笔记失败', error.message, 'error');
        return null;
    }
};

window.showThemeSelectionDialog = function(noteData) { console.warn('showThemeSelectionDialog not yet loaded'); };

// 全局变量
let appConfig = null;

let lastSelectedThemeId = 'default';
try {
    const storedTheme = window.localStorage ? window.localStorage.getItem('snc:last-theme') : null;
    if (storedTheme) {
        lastSelectedThemeId = storedTheme;
    }
} catch (error) {
    console.warn('无法读取上次主题首选项:', error);
}

function getLastSelectedTheme() {
    return lastSelectedThemeId || 'default';
}

function setLastSelectedTheme(themeId) {
    if (!themeId) return;
    lastSelectedThemeId = themeId;

    try {
        if (window.localStorage) {
            window.localStorage.setItem('snc:last-theme', themeId);
        }
    } catch (error) {
        console.warn('无法保存最后主题设置:', error);
    }

    document.querySelectorAll('#noteTheme').forEach(select => {
        if (Array.from(select.options).some(option => option.value === themeId)) {
            select.value = themeId;
        } else {
            select.dataset.selectedTheme = themeId;
        }
    });
}

window.getLastSelectedTheme = getLastSelectedTheme;
window.setLastSelectedTheme = setLastSelectedTheme;


let currentNotes = [];
let currentThemes = [];
let selectedNoteId = null;
let currentPage = 1;
let totalPages = 1;
let currentThemeFilter = 'all';
let currentSearchQuery = '';

// 应用初始化
document.addEventListener('DOMContentLoaded', async () => {
    console.log('Smart Note Collector UI 初始化中...');
    
    try {
        // 获取应用配置
        appConfig = await window.ipcRenderer.invoke('get-app-config');
        
        // 初始化UI组件
        initializeUI();
        
        // 绑定事件监听器
        bindEventListeners();
        
        // 加载初始数据
        await loadInitialData();
        
        // 启动定时器
        startTimers();
        
        console.log('Smart Note Collector UI 初始化完成');
    } catch (error) {
        console.error('应用初始化失败:', error);
        showNotification('应用初始化失败', error.message, 'error');
    }
});

// 初始化UI组件
function initializeUI() {
    // 设置剪切板监听状态
    const clipboardToggle = document.getElementById('clipboardToggle');
    if (clipboardToggle) {
        clipboardToggle.checked = appConfig.enableClipboardMonitor;
    }
    
    // 初始化时间显示
    updateTimeStatus();
    
    // 设置初始操作状态
    updateOperationStatus('就绪');
    
    console.log('UI组件初始化完成');
}

// 绑定事件监听器
function bindEventListeners() {
    // 工具栏按钮
    document.getElementById('settingsBtn')?.addEventListener('click', () => {
        // 发送IPC消息到主进程打开设置窗口
        console.log('打开设置窗口');
        window.ipcRenderer.send('open-settings-window');
    });
    
    document.getElementById('minimizeBtn')?.addEventListener('click', () => {
        // 通过IPC最小化窗口
        window.ipcRenderer.send('minimize-window');
    });

    document.getElementById('closeBtn')?.addEventListener('click', () => {
        // 通过IPC关闭窗口
        window.ipcRenderer.send('close-window');
    });
    
    // 搜索功能
    const searchInput = document.getElementById('searchInput');
    const searchBtn = document.getElementById('searchBtn');
    
    searchInput?.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            performSearch();
        }
    });
    
    searchBtn?.addEventListener('click', performSearch);
    
    // 快速操作按钮
    document.getElementById('quickNoteBtn')?.addEventListener('click', showQuickNoteDialog);
    document.getElementById('screenshotBtn')?.addEventListener('click', takeScreenshot);
    document.getElementById('crawlPageBtn')?.addEventListener('click', showUrlInputDialog);
    document.getElementById('importBtn')?.addEventListener('click', importFile);
    
    // 剪切板监听切换
    document.getElementById('clipboardToggle')?.addEventListener('change', toggleClipboardMonitoring);
    
    // 刷新和导出按钮
    document.getElementById('refreshBtn')?.addEventListener('click', refreshNotes);
    document.getElementById('exportBtn')?.addEventListener('click', exportNotes);
    
    // 排序选择
    document.getElementById('sortSelect')?.addEventListener('change', handleSortChange);
    
    // 分页按钮
    document.getElementById('prevPage')?.addEventListener('click', () => changePage(currentPage - 1));
    document.getElementById('nextPage')?.addEventListener('click', () => changePage(currentPage + 1));
    
    // 添加主题按钮
    document.getElementById('addThemeBtn')?.addEventListener('click', showAddThemeDialog);
    
    // 主题筛选
    document.addEventListener('click', (e) => {
        if (e.target.closest('.theme-item')) {
            const themeItem = e.target.closest('.theme-item');
            const themeId = themeItem.dataset.theme;
            selectTheme(themeId);
        }
    });
    
    // 笔记项点击
    document.addEventListener('click', (e) => {
        if (e.target.closest('.note-item')) {
            const noteItem = e.target.closest('.note-item');
            const noteId = noteItem.dataset.noteId;
            selectNote(noteId);
        }
    });
    
    // 快捷键
    document.addEventListener('keydown', handleGlobalKeydown);
    
    console.log('事件监听器绑定完成');
}

// 检查服务器连接
async function checkServerConnection() {
    try {
        const serverInfo = await window.ipcRenderer.invoke('check-server-connection');
        return serverInfo;
    } catch (error) {
        console.error('检查服务器连接失败:', error);
        throw error;
    }
}

// 加载初始数据
async function loadInitialData() {
    updateOperationStatus('加载数据中...');

    try {
        // 等待应用完全准备好
        await new Promise(resolve => setTimeout(resolve, 1000));

        // 先测试服务器连接
        updateOperationStatus('检查服务器连接...');
        try {
            await checkServerConnection();
        } catch (error) {
            console.warn('服务器连接检查失败，继续尝试加载数据:', error.message);
        }

        // 顺序加载主题和笔记（避免并发请求导致超时）
        updateOperationStatus('加载主题中...');
        let themes = null;
        try {
            themes = await loadThemes();
        } catch (error) {
            console.warn('主题加载失败，稍后重试:', error.message);
        }

        updateOperationStatus('加载笔记中...');
        let notes = null;
        try {
            notes = await loadNotes();
        } catch (error) {
            console.warn('笔记加载失败，稍后重试:', error.message);
        }

        // 如果主要数据加载失败，尝试重新加载
        if (!themes || !notes) {
            console.log('部分数据加载失败，等待3秒后重试...');
            updateOperationStatus('重试加载数据...');
            await new Promise(resolve => setTimeout(resolve, 3000));

            if (!themes) {
                try {
                    themes = await loadThemes();
                } catch (error) {
                    console.error('主题重试加载仍失败:', error.message);
                }
            }

            if (!notes) {
                try {
                    notes = await loadNotes();
                } catch (error) {
                    console.error('笔记重试加载仍失败:', error.message);
                }
            }
        }

        updateOperationStatus('就绪');
        console.log('初始数据加载完成');

        if (themes && notes) {
            showNotification('初始化成功', '应用已就绪', 'success');
        } else {
            showNotification('部分功能异常', '某些数据加载失败，请检查网络连接', 'warning');
        }

    } catch (error) {
        console.error('加载初始数据失败:', error);
        updateOperationStatus('加载失败');
        showNotification('数据加载失败', error.message, 'error');
    }
}

// 加载主题列表
async function loadThemes() {
    try {
        const themes = await window.ipcRenderer.invoke('get-themes');
        currentThemes = themes || [];
        
        updateThemesList();
        updateThemeSelect();
        
        return themes;
    } catch (error) {
        console.error('加载主题失败:', error);
        currentThemes = [];
        showNotification('加载主题失败', error.message, 'error');
        return [];
    }
}

// 更新主题列表显示
function updateThemesList() {
    const themeList = document.getElementById('themeList');
    if (!themeList) return;
    
    // 保留"全部"项
    const allItem = themeList.querySelector('[data-theme="all"]');
    themeList.innerHTML = '';
    if (allItem) {
        themeList.appendChild(allItem);
    }
    
    // 添加主题项
    currentThemes.forEach(theme => {
        const themeItem = document.createElement('div');
        themeItem.className = 'theme-item';
        themeItem.dataset.theme = theme.id;
        
        themeItem.innerHTML = `
            <span class="theme-name">${theme.name}</span>
            <span class="theme-count">${theme.noteCount || 0}</span>
        `;
        
        themeList.appendChild(themeItem);
    });
    
    // 更新总数
    const totalCount = document.getElementById('totalCount');
    if (totalCount) {
        const total = currentThemes.reduce((sum, theme) => sum + (theme.noteCount || 0), 0);
        totalCount.textContent = total;
    }
}

// 更新主题选择下拉框
function updateThemeSelect() {

    const themeSelects = document.querySelectorAll('#noteTheme');



    themeSelects.forEach(select => {

        const desiredTheme = select.dataset.selectedTheme || getLastSelectedTheme();



        const defaultOption = select.querySelector('option[value="default"]');

        select.innerHTML = '';

        if (defaultOption) {

            select.appendChild(defaultOption);

        } else {

            const fallback = document.createElement('option');

            fallback.value = 'default';

            fallback.textContent = '默认主题';

            select.appendChild(fallback);

        }



        currentThemes.forEach(theme => {

            const option = document.createElement('option');

            option.value = theme.id;

            option.textContent = theme.name;

            select.appendChild(option);

        });



        if (Array.from(select.options).some(option => option.value === desiredTheme)) {

            select.value = desiredTheme;

        } else {

            select.value = 'default';

        }



        delete select.dataset.selectedTheme;

    });

}



// 更新笔记列表显示
function updateNotesList() {
    const notesList = document.getElementById('notesList');
    if (!notesList) return;
    
    if (currentNotes.length === 0) {
        notesList.innerHTML = `
            <div class="empty-placeholder">
                <p>📝 暂无笔记</p>
                <p>点击"新建笔记"开始创建您的第一条笔记</p>
            </div>
        `;
        return;
    }
    
    notesList.innerHTML = '';
    
    currentNotes.forEach(note => {
        const noteItem = createNoteElement(note);
        notesList.appendChild(noteItem);
    });
}

// 创建笔记元素
function createNoteElement(note) {
    const noteItem = document.createElement('div');
    noteItem.className = 'note-item';
    noteItem.dataset.noteId = note.id;
    
    // 格式化时间
    const createdAt = new Date(note.created_at).toLocaleString();
    const updatedAt = new Date(note.updated_at).toLocaleString();
    
    // 获取主题名称
    const theme = currentThemes.find(t => t.id === note.theme) || { name: '默认主题' };
    
    // 处理来源信息
    let sourceText = '手动创建';
    if (note.source) {
        switch (note.source.type) {
            case 'clipboard_text':
            case 'clipboard_image':
                sourceText = '剪切板';
                break;
            case 'windows_screenshot':
                sourceText = '截图';
                break;
            case 'windows_webcrawl':
                sourceText = '网页爬取';
                break;
            case 'chrome_extension':
                sourceText = 'Chrome扩展';
                break;
            default:
                sourceText = note.source.type || '未知';
        }
    }
    
    noteItem.innerHTML = `
        <div class="note-header">
            <div class="note-title">${escapeHtml(note.title)}</div>
            <div class="note-actions">
                <button class="note-action-btn" onclick="editNote('${note.id}')" title="编辑">✏️</button>
                <button class="note-action-btn" onclick="deleteNote('${note.id}')" title="删除">🗑️</button>
            </div>
        </div>
        <div class="note-meta">
            <span class="note-theme">${escapeHtml(theme.name)}</span>
            <span class="note-source">来源: ${sourceText}</span>
            <span class="note-time">${updatedAt}</span>
        </div>
        <div class="note-preview">${escapeHtml(note.content.substring(0, 200))}${note.content.length > 200 ? '...' : ''}</div>
        ${note.tags && note.tags.length > 0 ? `
            <div class="note-tags">
                ${note.tags.map(tag => `<span class="note-tag">${escapeHtml(tag)}</span>`).join('')}
            </div>
        ` : ''}
    `;
    
    return noteItem;
}

// 更新分页显示
function updatePagination() {
    const pagination = document.getElementById('pagination');
    const currentPageSpan = document.getElementById('currentPage');
    const totalPagesSpan = document.getElementById('totalPages');
    const prevBtn = document.getElementById('prevPage');
    const nextBtn = document.getElementById('nextPage');
    
    if (totalPages <= 1) {
        pagination.style.display = 'none';
        return;
    }
    
    pagination.style.display = 'flex';
    currentPageSpan.textContent = currentPage;
    totalPagesSpan.textContent = totalPages;
    
    prevBtn.disabled = currentPage <= 1;
    nextBtn.disabled = currentPage >= totalPages;
}

// 更新笔记数量状态
function updateNoteCountStatus(total) {
    const statusElement = document.getElementById('noteCountStatus');
    if (statusElement) {
        statusElement.textContent = `总计 ${total} 条笔记`;
    }
}

// updateOperationStatus 已在文件开头定义

// 更新时间状态
function updateTimeStatus() {
    const statusElement = document.getElementById('timeStatus');
    if (statusElement) {
        const now = new Date();
        statusElement.textContent = now.toLocaleTimeString();
    }
}

// 启动定时器
function startTimers() {
    // 每秒更新时间
    setInterval(updateTimeStatus, 1000);
    
    // 每30秒检查服务器状态
    setInterval(checkServerStatus, 30000);
    
    // 立即检查一次服务器状态
    checkServerStatus();
}

// 检查服务器状态
async function checkServerStatus() {
    try {
        const serverInfo = await window.ipcRenderer.invoke('get-server-info');
        const statusDot = document.getElementById('statusDot');
        const statusText = document.getElementById('statusText');

        // 修正数据结构的访问
        const isConnected = serverInfo.success && serverInfo.data?.status === 'online';

        if (isConnected) {
            statusDot.className = 'status-dot connected';
            statusText.textContent = '已连接';
        } else {
            statusDot.className = 'status-dot disconnected';
            statusText.textContent = '未连接';
        }
    } catch (error) {
        console.error('检查服务器状态失败:', error);
        const statusDot = document.getElementById('statusDot');
        const statusText = document.getElementById('statusText');
        statusDot.className = 'status-dot disconnected';
        statusText.textContent = '检查失败';
    }
}

// 执行搜索
async function performSearch() {
    const searchInput = document.getElementById('searchInput');
    currentSearchQuery = searchInput.value.trim();
    currentPage = 1;
    
    await loadNotes(1);
}

// 选择主题功能已在前面定义为全局函数

// 选择笔记
function selectNote(noteId) {
    selectedNoteId = noteId;
    
    // 更新UI选中状态
    document.querySelectorAll('.note-item').forEach(item => {
        item.classList.remove('selected');
    });
    
    const selectedItem = document.querySelector(`[data-note-id="${noteId}"]`);
    if (selectedItem) {
        selectedItem.classList.add('selected');
    }
    
    // 显示笔记详情（如果有右侧面板）
    showNoteDetail(noteId);
}

// 显示笔记详情
function showNoteDetail(noteId) {
    const note = currentNotes.find(n => n.id === noteId);
    if (!note) return;
    
    const rightPanel = document.getElementById('rightPanel');
    const noteDetail = document.getElementById('noteDetail');
    
    if (rightPanel && noteDetail) {
        rightPanel.style.display = 'flex';
        
        const theme = currentThemes.find(t => t.id === note.theme) || { name: '默认主题' };
        
        noteDetail.innerHTML = `
            <div class="detail-note-title">
                <h4>${escapeHtml(note.title)}</h4>
            </div>
            <div class="detail-note-meta">
                <div class="meta-item">
                    <strong>主题:</strong> ${escapeHtml(theme.name)}
                </div>
                <div class="meta-item">
                    <strong>创建时间:</strong> ${new Date(note.created_at).toLocaleString()}
                </div>
                <div class="meta-item">
                    <strong>更新时间:</strong> ${new Date(note.updated_at).toLocaleString()}
                </div>
                ${note.tags && note.tags.length > 0 ? `
                    <div class="meta-item">
                        <strong>标签:</strong> ${note.tags.map(tag => `<span class="detail-tag">${escapeHtml(tag)}</span>`).join('')}
                    </div>
                ` : ''}
            </div>
            <div class="detail-note-content">
                <strong>内容:</strong>
                <div class="content-text">${formatNoteContent(note.content)}</div>
            </div>
        `;
    }
}

// 格式化笔记内容
function formatNoteContent(content) {
    if (window.notesManager && typeof window.notesManager.formatNoteContent === 'function') {
        return window.notesManager.formatNoteContent(content);
    }

    if (!content) {
        return '';
    }

    const normalizeUrl = (url, allowDataImage = false) => {
        if (!url) return '';
        const trimmed = url.trim();
        if (allowDataImage && /^data:image\//i.test(trimmed)) {
            return trimmed;
        }
        if (/^(https?:|file:|blob:|mailto:)/i.test(trimmed)) {
            return trimmed;
        }
        if (trimmed.startsWith('//')) {
            return `https:${trimmed}`;
        }
        if (/^data:/i.test(trimmed)) {
            return '';
        }
        const base = (appConfig?.serverUrl || '').replace(/\/$/, '');
        if (!base) {
            return trimmed;
        }
        const normalizedPath = trimmed.startsWith('/') ? trimmed : `/${trimmed}`;
        return `${base}${normalizedPath}`;
    };

    const escaped = escapeHtml(content);
    return escaped
        .replace(/\r?\n/g, '<br>')
        .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
        .replace(/\*(.*?)\*/g, '<em>$1</em>')
        .replace(/`(.*?)`/g, '<code>$1</code>')
        .replace(/!\[(.*?)\]\((.*?)\)/g, (match, alt, url) => {
            const safeUrl = normalizeUrl(url, true);
            if (!safeUrl) {
                return escapeHtml(match);
            }
            return `<img src="${safeUrl}" alt="${escapeHtml(alt)}" style="max-width: 100%; margin: 8px 0;">`;
        })
        .replace(/\[(.*?)\]\((.*?)\)/g, (match, textValue, url) => {
            const safeLink = normalizeUrl(url);
            if (!safeLink) {
                return escapeHtml(textValue);
            }
            return `<a href="${safeLink}" target="_blank" rel="noopener noreferrer">${escapeHtml(textValue)}</a>`;
        });
}

// 切换剪切板监听
async function toggleClipboardMonitoring(event) {
    const enabled = event.target.checked;
    
    try {
        await window.ipcRenderer.invoke('update-app-config', {
            enableClipboardMonitor: enabled
        });
        
        showNotification(
            '剪切板监听',
            enabled ? '已启用剪切板监听' : '已禁用剪切板监听',
            'success'
        );
    } catch (error) {
        console.error('切换剪切板监听失败:', error);
        showNotification('设置失败', error.message, 'error');
        
        // 恢复开关状态
        event.target.checked = !enabled;
    }
}

// 刷新笔记
async function refreshNotes() {
    await loadNotes(currentPage);
    showNotification('刷新完成', '笔记列表已更新', 'success');
}

// 导出笔记
async function exportNotes() {
    try {
        updateOperationStatus('导出中...');
        
        // 这里可以添加导出选项对话框
        const result = await window.ipcRenderer.invoke('export-notes', 'json');
        
        updateOperationStatus('就绪');
        showNotification('导出成功', '笔记已导出到下载文件夹', 'success');
    } catch (error) {
        console.error('导出笔记失败:', error);
        updateOperationStatus('导出失败');
        showNotification('导出失败', error.message, 'error');
    }
}

// 处理排序变化
async function handleSortChange(event) {
    const sortBy = event.target.value;
    currentPage = 1;
    
    await loadNotes(1, { sortBy });
}

// 改变页面
async function changePage(page) {
    if (page < 1 || page > totalPages) return;
    
    await loadNotes(page);
}

// 截图功能
async function takeScreenshot() {
    try {
        updateOperationStatus('截图中...');
        
        const result = await window.ipcRenderer.invoke('take-screenshot');
        
        if (result) {
            updateOperationStatus('就绪');
            showNotification('截图成功', '截图已保存为笔记', 'success');
            await refreshNotes();
        } else {
            updateOperationStatus('就绪');
        }
    } catch (error) {
        console.error('截图失败:', error);
        updateOperationStatus('截图失败');
        showNotification('截图失败', error.message, 'error');
    }
}

// 导入文件
function importFile() {
    // 这里可以实现文件导入功能
    showNotification('功能开发中', '文件导入功能正在开发中', 'info');
}

// 处理全局快捷键
function handleGlobalKeydown(event) {
    // Ctrl+N 新建笔记
    if (event.ctrlKey && event.key === 'n') {
        event.preventDefault();
        showQuickNoteDialog();
    }
    
    // Ctrl+F 搜索
    if (event.ctrlKey && event.key === 'f') {
        event.preventDefault();
        const searchInput = document.getElementById('searchInput');
        searchInput?.focus();
    }
    
    // F5 刷新
    if (event.key === 'F5') {
        event.preventDefault();
        refreshNotes();
    }
    
    // Escape 关闭对话框
    if (event.key === 'Escape') {
        closeAllDialogs();
    }
}

// 关闭所有对话框
function closeAllDialogs() {
    const dialogs = document.querySelectorAll('.quick-note-dialog, .theme-dialog, .url-dialog');
    dialogs.forEach(dialog => {
        dialog.style.display = 'none';
    });
    
    const modalOverlay = document.getElementById('modalOverlay');
    if (modalOverlay) {
        modalOverlay.style.display = 'none';
    }
}

// showNotification 和 escapeHtml 已在文件开头定义

// IPC消息监听
window.ipcRenderer.on('show-text-note-dialog', () => {
    showQuickNoteDialog();
});

window.ipcRenderer.on('show-url-input-dialog', () => {
    showUrlInputDialog();
});

window.ipcRenderer.on('show-theme-selection-dialog', (event, noteData) => {
    if (noteData && !noteData.theme && window.getLastSelectedTheme) {
        noteData.theme = window.getLastSelectedTheme();
    }

    showThemeSelectionDialog(noteData);
});

// 监听应用配置变化
window.ipcRenderer.on('app-config-changed', (event, newConfig) => {
    appConfig = { ...appConfig, ...newConfig };
    
    // 更新UI
    const clipboardToggle = document.getElementById('clipboardToggle');
    if (clipboardToggle) {
        clipboardToggle.checked = appConfig.enableClipboardMonitor;
    }
});

console.log('主JavaScript文件加载完成');