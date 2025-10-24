// Smart Note Collector - 对话框管理
// ipcRenderer 已在 main.js 中声明为全局变量

// 全局变量
let currentDialogResolve = null;
let currentNoteData = null; // 存储当前需要保存的笔记数据

// URL输入对话框
function showUrlInputDialog() {
    const dialog = document.getElementById('urlInputDialog');
    if (!dialog) {
        // 如果对话框不存在，显示简单提示
        showNotification('功能开发中', 'URL爬取功能正在开发中', 'info');
        return;
    }
    
    // 显示对话框逻辑
    dialog.style.display = 'block';
}

// 截图功能（重命名以避免冲突）
function dialogTakeScreenshot() {
    // 发送截图请求到主进程
    window.ipcRenderer.send('take-screenshot');
    showNotification('截图中...', '正在准备截图工具', 'info');
}

// 显示快速笔记对话框
function showQuickNoteDialog() {
    const dialog = document.getElementById('quickNoteDialog');
    if (!dialog) return;

    const form = document.getElementById('quickNoteForm');
    if (form) {
        form.reset();
    }

    dialog.style.display = 'block';

    const themeSelect = document.getElementById('noteTheme');
    if (themeSelect && window.getLastSelectedTheme) {
        const preferredTheme = window.getLastSelectedTheme();
        themeSelect.dataset.selectedTheme = preferredTheme;
        themeSelect.value = preferredTheme;
    }

    const titleInput = document.getElementById('noteTitle');
    if (titleInput) {
        setTimeout(() => titleInput.focus(), 100);
    }

    bindQuickNoteEvents();
}


// 绑定快速笔记事件
function bindQuickNoteEvents() {
    const form = document.getElementById('quickNoteForm');
    if (!form) {
        return;
    }

    const closeBtn = document.getElementById('closeQuickNoteBtn');
    const cancelBtn = document.getElementById('cancelQuickNoteBtn');

    const newForm = form.cloneNode(true);
    form.parentNode.replaceChild(newForm, form);

    const themeSelect = newForm.querySelector('#noteTheme');
    if (themeSelect) {
        themeSelect.addEventListener('change', (event) => {
            if (window.setLastSelectedTheme) {
                window.setLastSelectedTheme(event.target.value);
            }
        });
    }

    newForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        await handleQuickNoteSubmit(newForm);
    });

    if (closeBtn) {
        const newCloseBtn = closeBtn.cloneNode(true);
        closeBtn.parentNode.replaceChild(newCloseBtn, closeBtn);
        newCloseBtn.addEventListener('click', () => {
            hideQuickNoteDialog();
        });
    }

    if (cancelBtn) {
        const newCancelBtn = cancelBtn.cloneNode(true);
        cancelBtn.parentNode.replaceChild(newCancelBtn, cancelBtn);
        newCancelBtn.addEventListener('click', () => {
            hideQuickNoteDialog();
        });
    }

    const handleKeydown = (e) => {
        if (e.key === 'Escape') {
            hideQuickNoteDialog();
            document.removeEventListener('keydown', handleKeydown);
        }
    };
    document.addEventListener('keydown', handleKeydown);
}




// 处理快速笔记提交
async function handleQuickNoteSubmit(form) {
    try {
        const formData = new FormData(form);
        const noteData = {
            title: formData.get('title').trim(),
            content: formData.get('content').trim(),
            theme: formData.get('theme') || (window.getLastSelectedTheme ? window.getLastSelectedTheme() : 'default'),
            tags: formData.get('tags') ? formData.get('tags').split(',').map(tag => tag.trim()).filter(tag => tag) : [],
            source: {
                type: 'windows_manual',
                timestamp: new Date().toISOString()
            }
        };
        
        // 验证必填字段
        if (!noteData.title) {
            showNotification('验证失败', '请输入笔记标题', 'warning');
            return;
        }
        
        if (!noteData.content) {
            showNotification('验证失败', '请输入笔记内容', 'warning');
            return;
        }
        
        // 保存笔记
        updateOperationStatus('保存笔记中...');
        const result = await window.ipcRenderer.invoke('save-note', noteData);
        
        if (result) {
            if (window.setLastSelectedTheme) {
                window.setLastSelectedTheme(noteData.theme || 'default');
            }

            hideQuickNoteDialog();
            updateOperationStatus('就绪');
            showNotification('保存成功', '笔记已成功保存', 'success');
            
            // 刷新笔记列表
            if (typeof refreshNotes === 'function') {
                await refreshNotes();
            }
        }
    } catch (error) {
        console.error('保存笔记失败:', error);
        updateOperationStatus('保存失败');
        showNotification('保存失败', error.message, 'error');
    }
}

// 隐藏快速笔记对话框
function hideQuickNoteDialog() {
    const dialog = document.getElementById('quickNoteDialog');
    if (dialog) {
        dialog.style.display = 'none';
    }
}

// 显示URL输入对话框
function showUrlInputDialog() {
    const dialog = document.getElementById('urlDialog');
    if (!dialog) return;
    
    // 重置表单
    const form = document.getElementById('urlForm');
    if (form) {
        form.reset();
    }
    
    // 显示对话框
    dialog.style.display = 'block';
    
    // 聚焦到URL输入框
    const urlInput = document.getElementById('urlInput');
    if (urlInput) {
        setTimeout(() => urlInput.focus(), 100);
    }
    
    // 绑定事件
    bindUrlDialogEvents();
}

// 绑定URL对话框事件
function bindUrlDialogEvents() {
    const form = document.getElementById('urlForm');
    
    // 移除之前的事件监听器
    const newForm = form.cloneNode(true);
    form.parentNode.replaceChild(newForm, form);
    
    // 提交表单
    newForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        await handleUrlSubmit(newForm);
    });
    
    // 关闭按钮
    document.getElementById('closeUrlDialogBtn').addEventListener('click', () => {
        hideUrlDialog();
    });
    
    document.getElementById('cancelUrlBtn').addEventListener('click', () => {
        hideUrlDialog();
    });
}

// 处理URL提交
async function handleUrlSubmit(form) {
    try {
        const formData = new FormData(form);
        const url = formData.get('url').trim();
        
        if (!url) {
            showNotification('验证失败', '请输入有效的网页地址', 'warning');
            return;
        }
        
        // 验证URL格式
        try {
            new URL(url);
        } catch (error) {
            showNotification('验证失败', '请输入有效的网页地址', 'warning');
            return;
        }
        
        hideUrlDialog();
        updateOperationStatus('爬取网页中...');
        
        // 调用爬取功能
        const result = await window.ipcRenderer.invoke('crawl-webpage', url);
        
        if (result) {
            updateOperationStatus('就绪');
            showNotification('爬取成功', '网页内容已保存为笔记', 'success');
            
            // 刷新笔记列表
            if (typeof refreshNotes === 'function') {
                await refreshNotes();
            }
        }
    } catch (error) {
        console.error('爬取网页失败:', error);
        updateOperationStatus('爬取失败');
        showNotification('爬取失败', error.message, 'error');
    }
}

// 隐藏URL对话框
function hideUrlDialog() {
    const dialog = document.getElementById('urlDialog');
    if (dialog) {
        dialog.style.display = 'none';
    }
}

// 显示主题选择对话框
function showThemeSelectionDialog(noteData) {
    // 存储当前的笔记数据，供确认时使用
    if (noteData && !noteData.theme && window.getLastSelectedTheme) {
        noteData.theme = window.getLastSelectedTheme();
    }
    currentNoteData = noteData;

    const dialog = document.getElementById('themeDialog');
    if (!dialog) {
        console.error('主题选择对话框元素不存在');
        return;
    }

    // 填充表单数据
    populateNoteEditForm(noteData);

    // 加载主题列表
    loadThemeSelectionOptions(noteData);

    // 显示对话框
    dialog.style.display = 'block';

    // 绑定事件
    bindThemeDialogEvents();
}

// 填充笔记编辑表单
function populateNoteEditForm(noteData) {
    // 填充标题
    const titleInput = document.getElementById('noteEditTitle');
    if (titleInput) {
        titleInput.value = noteData.title || '';
    }

    // 填充内容
    const contentTextarea = document.getElementById('noteEditContent');
    if (contentTextarea) {
        contentTextarea.value = noteData.content || '';
    }

    // 填充标签
    const tagsInput = document.getElementById('noteEditTags');
    if (tagsInput) {
        let tagsText = '';
        if (noteData.tags) {
            if (Array.isArray(noteData.tags)) {
                tagsText = noteData.tags.join(', ');
            } else if (typeof noteData.tags === 'string') {
                tagsText = noteData.tags;
            }
        }
        tagsInput.value = tagsText;
    }
}

// 将showThemeSelectionDialog设为全局变量
window.showThemeSelectionDialog = showThemeSelectionDialog;

// 加载主题选择选项
async function loadThemeSelectionOptions(noteData) {
    const container = document.getElementById('themeSelection');
    if (!container) return;

    try {
        const themes = currentThemes || await window.ipcRenderer.invoke('get-themes');
        container.innerHTML = '';

        const preferredTheme = (noteData && noteData.theme) || (window.getLastSelectedTheme ? window.getLastSelectedTheme() : 'default');
        if (noteData) {
            noteData.theme = preferredTheme;
        }

        const defaultOption = createThemeOption('default', '默认主题', '系统默认存储主题');
        container.appendChild(defaultOption);

        themes.forEach(theme => {
            const option = createThemeOption(theme.id, theme.name, `${theme.noteCount || 0} 条笔记`);
            container.appendChild(option);
        });

        const targetOption = container.querySelector(`[data-theme-id="${preferredTheme}"]`);
        if (targetOption) {
            targetOption.classList.add('selected');
        } else {
            const firstOption = container.querySelector('.theme-option');
            if (firstOption) {
                firstOption.classList.add('selected');
            }
        }

    } catch (error) {
        console.error('加载主题选项失败:', error);
        container.innerHTML = '<p>加载主题失败</p>';
    }
}


// 创建主题选项元素
function createThemeOption(id, name, description) {
    const option = document.createElement('div');
    option.className = 'theme-option';
    option.dataset.themeId = id;
    
    option.innerHTML = `
        <div class="theme-option-info">
            <div class="theme-option-name">${escapeHtml(name)}</div>
            <div class="theme-option-desc">${escapeHtml(description)}</div>
        </div>
        <div class="theme-option-radio"></div>
    `;
    
    // 点击选择
    option.addEventListener('click', () => {
        // 移除其他选中状态
        document.querySelectorAll('.theme-option').forEach(opt => {
            opt.classList.remove('selected');
        });
        
        // 选中当前选项
        option.classList.add('selected');
    });
    
    return option;
}

// 绑定主题对话框事件
function bindThemeDialogEvents() {
    // 移除之前的事件监听器，避免重复绑定
    const closeBtn = document.getElementById('closeThemeDialogBtn');
    const cancelBtn = document.getElementById('cancelThemeBtn');
    const confirmBtn = document.getElementById('confirmThemeBtn');

    // 关闭按钮
    if (closeBtn) {
        const newCloseBtn = closeBtn.cloneNode(true);
        closeBtn.parentNode.replaceChild(newCloseBtn, closeBtn);
        newCloseBtn.addEventListener('click', () => {
            hideThemeDialog();
            // 通知主进程取消了主题选择
            window.ipcRenderer.send('theme-selection-result', { success: false, theme: null });
        });
    }

    // 取消按钮
    if (cancelBtn) {
        const newCancelBtn = cancelBtn.cloneNode(true);
        cancelBtn.parentNode.replaceChild(newCancelBtn, cancelBtn);
        newCancelBtn.addEventListener('click', () => {
            hideThemeDialog();
            // 通知主进程取消了主题选择
            window.ipcRenderer.send('theme-selection-result', { success: false, theme: null });
        });
    }

    // 确定按钮
    if (confirmBtn) {
        const newConfirmBtn = confirmBtn.cloneNode(true);
        confirmBtn.parentNode.replaceChild(newConfirmBtn, confirmBtn);
        newConfirmBtn.addEventListener('click', async () => {
            const selectedOption = document.querySelector('.theme-option.selected');
            const selectedTheme = selectedOption ? selectedOption.dataset.themeId : 'default';

            const titleInput = document.getElementById('noteEditTitle');
            const contentTextarea = document.getElementById('noteEditContent');
            const tagsInput = document.getElementById('noteEditTags');

            const editedTitle = titleInput ? titleInput.value.trim() : '';
            const editedContent = contentTextarea ? contentTextarea.value.trim() : '';
            const editedTags = tagsInput ? tagsInput.value.trim() : '';

            if (!editedTitle) {
                showNotification('保存失败', '请输入标题', 'warning');
                return;
            }

            if (!editedContent) {
                showNotification('保存失败', '请输入内容', 'warning');
                return;
            }

            hideThemeDialog();

            if (currentNoteData) {
                currentNoteData.title = editedTitle;
                currentNoteData.content = editedContent;
                currentNoteData.theme = selectedTheme;

                if (editedTags) {
                    currentNoteData.tags = editedTags.split(',').map(tag => tag.trim()).filter(tag => tag.length > 0);
                } else {
                    currentNoteData.tags = currentNoteData.tags || [];
                }

                try {
                    const result = await window.ipcRenderer.invoke('save-note', currentNoteData);

                    if (result) {
                        showNotification('保存成功', `笔记已保存到主题: ${selectedTheme}`, 'success');
                        if (typeof refreshNotes === 'function') {
                            await refreshNotes();
                        }
                    }

                    if (window.setLastSelectedTheme) {
                        window.setLastSelectedTheme(selectedTheme);
                    }
                    window.ipcRenderer.send('theme-selection-result', { success: true, theme: selectedTheme });
                } catch (error) {
                    console.error('保存笔记失败:', error);

                    if (error.message.includes('超时') || error.message.includes('timeout') || error.message.includes('ETIMEDOUT')) {
                        const shouldRetry = confirm('与服务器通信超时，笔记保存失败。是否重试？\n\n选择“确定”重试，选择“取消”放弃。');

                        if (shouldRetry) {
                            currentNoteData.theme = selectedTheme;
                            currentNoteData.title = editedTitle;
                            currentNoteData.content = editedContent;
                            currentNoteData.tags = editedTags ? editedTags.split(',').map(tag => tag.trim()).filter(tag => tag.length > 0) : [];

                            showThemeSelectionDialog(currentNoteData);
                            return;
                        }
                    }

                    showNotification('保存失败', error.message, 'error');
                    window.ipcRenderer.send('theme-selection-result', { success: false, theme: selectedTheme, error: error.message });
                }

                currentNoteData = null;
            } else {
                if (window.setLastSelectedTheme) {
                    window.setLastSelectedTheme(selectedTheme);
                }
                window.ipcRenderer.send('theme-selection-result', { success: true, theme: selectedTheme });
            }
        });
);
    }
}

// 隐藏主题对话框
function hideThemeDialog() {
    const dialog = document.getElementById('themeDialog');
    if (dialog) {
        dialog.style.display = 'none';
    }
}

// 显示添加主题对话框
function showAddThemeDialog() {
    const themeName = prompt('请输入新主题名称:');
    if (!themeName || !themeName.trim()) {
        return;
    }
    
    addNewTheme(themeName.trim());
}

// 添加新主题
async function addNewTheme(themeName) {
    try {
        updateOperationStatus('创建主题中...');
        
        const themeData = {
            name: themeName,
            description: `用户创建的主题: ${themeName}`
        };
        
        const result = await window.ipcRenderer.invoke('create-theme', themeData);
        
        if (result) {
            updateOperationStatus('就绪');
            showNotification('创建成功', `主题"${themeName}"已创建`, 'success');
            
            // 重新加载主题列表
            if (typeof loadThemes === 'function') {
                await loadThemes();
            }
        }
    } catch (error) {
        console.error('创建主题失败:', error);
        updateOperationStatus('创建失败');
        showNotification('创建失败', error.message, 'error');
    }
}

// 显示笔记编辑对话框
function showEditNoteDialog(noteId) {
    const note = currentNotes.find(n => n.id === noteId);
    if (!note) {
        showNotification('错误', '找不到指定的笔记', 'error');
        return;
    }
    
    // 填充编辑表单
    const dialog = document.getElementById('quickNoteDialog');
    if (!dialog) return;
    
    // 设置表单值
    document.getElementById('noteTitle').value = note.title;
    document.getElementById('noteContent').value = note.content;
    document.getElementById('noteTheme').value = note.theme || 'default';
    document.getElementById('noteTags').value = note.tags ? note.tags.join(', ') : '';
    
    // 显示对话框
    dialog.style.display = 'block';
    
    // 修改提交逻辑为更新而不是创建
    const form = document.getElementById('quickNoteForm');
    form.dataset.editingNoteId = noteId;
    
    // 修改提交按钮文本
    const submitBtn = form.querySelector('button[type="submit"]');
    if (submitBtn) {
        submitBtn.textContent = '更新笔记';
    }
    
    bindQuickNoteEvents();
}

// 删除笔记
async function deleteNote(noteId) {
    const note = currentNotes.find(n => n.id === noteId);
    if (!note) return;
    
    const confirmed = confirm(`确定要删除笔记"${note.title}"吗？\\n\\n此操作不可撤销。`);
    if (!confirmed) return;
    
    try {
        updateOperationStatus('删除笔记中...');
        
        const result = await window.ipcRenderer.invoke('delete-note', noteId);
        
        if (result) {
            updateOperationStatus('就绪');
            showNotification('删除成功', '笔记已删除', 'success');
            
            // 刷新笔记列表
            if (typeof refreshNotes === 'function') {
                await refreshNotes();
            }
            
            // 如果正在显示该笔记的详情，关闭详情面板
            if (selectedNoteId === noteId) {
                const rightPanel = document.getElementById('rightPanel');
                if (rightPanel) {
                    rightPanel.style.display = 'none';
                }
                selectedNoteId = null;
            }
        }
    } catch (error) {
        console.error('删除笔记失败:', error);
        updateOperationStatus('删除失败');
        showNotification('删除失败', error.message, 'error');
    }
}

// 编辑笔记
function editNote(noteId) {
    showEditNoteDialog(noteId);
}

// 显示确认对话框
function showConfirmDialog(title, message, onConfirm, onCancel) {
    const overlay = document.getElementById('modalOverlay');
    const content = document.getElementById('modalContent');
    
    if (!overlay || !content) return;
    
    content.innerHTML = `
        <div class="confirm-dialog">
            <h3>${escapeHtml(title)}</h3>
            <p>${escapeHtml(message)}</p>
            <div class="confirm-actions">
                <button id="confirmCancel" class="btn-secondary">取消</button>
                <button id="confirmOk" class="btn-primary">确定</button>
            </div>
        </div>
    `;
    
    overlay.style.display = 'flex';
    
    // 绑定事件
    document.getElementById('confirmCancel').addEventListener('click', () => {
        overlay.style.display = 'none';
        if (onCancel) onCancel();
    });
    
    document.getElementById('confirmOk').addEventListener('click', () => {
        overlay.style.display = 'none';
        if (onConfirm) onConfirm();
    });
    
    // ESC键取消
    const handleKeydown = (e) => {
        if (e.key === 'Escape') {
            overlay.style.display = 'none';
            if (onCancel) onCancel();
            document.removeEventListener('keydown', handleKeydown);
        }
    };
    document.addEventListener('keydown', handleKeydown);
}

console.log('对话框管理模块加载完成');

// 等待DOM加载完成后设置IPC监听器
document.addEventListener('DOMContentLoaded', () => {
    // 确保window.ipcRenderer可用后再设置监听器
    if (window.ipcRenderer) {
        // IPC监听器 - 显示主题选择对话框
        window.ipcRenderer.on('show-theme-selection-dialog', (event, noteData) => {
            console.log('收到显示主题选择对话框请求:', noteData?.title);
            showThemeSelectionDialog(noteData);
        });

        // IPC监听器 - 主题选择结果（保留旧的监听器以防兼容性问题）
        window.ipcRenderer.on('theme-selection-result', (event, result) => {
            // 这个事件由主进程发送，用于响应主进程的主题选择请求
            if (currentDialogResolve) {
                currentDialogResolve(result);
                currentDialogResolve = null;
            }
        });
    }
});