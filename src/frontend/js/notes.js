// 笔记管理模块
class NoteManager {
    constructor() {
        this.notes = [];
        this.themes = []; // 初始化主题数组
        this.currentPage = 1;
        this.totalPages = 1;
        this.itemsPerPage = 20;
        this.currentSearch = '';
        this.currentEditingNote = null;
        this.viewMode = 'list'; // list 或 grid
        this.isEditMode = false;
        this.selectedNotes = new Set();
        this.currentTagFilter = []; // 当前标签筛选
        this.currentThemeId = 'all'; // 当前选中的主题ID

        // 确保DOM元素存在
        this.notesList = document.getElementById('notesList');
        this.noteModal = document.getElementById('noteModal');
        this.noteForm = document.getElementById('noteForm');
        this.emptyState = document.getElementById('emptyState');
        this.pagination = document.getElementById('pagination');
        this.noteViewer = document.getElementById('noteViewer');
        this.currentViewingNote = null;
        
        if (!this.notesList || !this.emptyState) {
            console.error('关键DOM元素未找到，延迟初始化');
            setTimeout(() => this.retryInitialization(), 100);
            return;
        }
        
        this.initializeEventListeners();
        this.loadNotes();
    }

    // 重试初始化
    retryInitialization() {
        this.notesList = document.getElementById('notesList');
        this.emptyState = document.getElementById('emptyState');
        this.pagination = document.getElementById('pagination');
        
        if (this.notesList && this.emptyState) {
            this.initializeEventListeners();
            this.loadNotes();
        } else {
            console.error('DOM元素仍未找到，笔记管理器初始化失败');
        }
    }

    // 初始化事件监听器
    initializeEventListeners() {
        // 新建笔记按钮
        document.getElementById('newNoteBtn').addEventListener('click', () => {
            this.showNoteModal();
        });

        // 搜索功能
        const searchInput = document.getElementById('searchInput');
        searchInput.addEventListener('input', ui.debounce((e) => {
            this.currentSearch = e.target.value.trim();
            this.currentPage = 1;
            this.loadNotes();
        }, 300));

        // 每页显示数量变化
        document.getElementById('itemsPerPageSelect').addEventListener('change', (e) => {
            this.itemsPerPage = parseInt(e.target.value);
            this.currentPage = 1;
            this.loadNotes();
        });

        // 编辑模式切换
        const editModeBtn = document.getElementById('editModeBtn');
        if (editModeBtn) {
            editModeBtn.addEventListener('click', () => {
                this.toggleEditMode();
            });
        }

        // 笔记阅览器事件
        const editNoteBtn = document.getElementById('editNoteBtn');
        const closeViewerBtn = document.getElementById('closeViewerBtn');
        
        if (editNoteBtn) {
            editNoteBtn.addEventListener('click', () => {
                if (this.currentViewingNote) {
                    this.editNote(this.currentViewingNote.id);
                }
            });
        }
        
        if (closeViewerBtn) {
            closeViewerBtn.addEventListener('click', () => {
                this.closeNoteViewer();
            });
        }

        // 视图切换
        document.getElementById('listViewBtn').addEventListener('click', () => {
            this.setViewMode('list');
        });
        document.getElementById('gridViewBtn').addEventListener('click', () => {
            this.setViewMode('grid');
        });

        // 笔记模态框事件
        document.getElementById('closeNoteModal').addEventListener('click', () => {
            ui.hideModal('noteModal');
        });
        document.getElementById('cancelNoteBtn').addEventListener('click', () => {
            ui.hideModal('noteModal');
        });
        document.getElementById('saveNoteBtn').addEventListener('click', () => {
            this.saveNote();
        });

        // 图片上传预览
        const imageInput = document.getElementById('noteImage');
        const imagePreview = document.getElementById('imagePreview');
        const previewImg = document.getElementById('previewImg');
        const removeImageBtn = document.getElementById('removeImageBtn');

        imageInput.addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (file) {
                ui.previewImage(file, previewImg);
            }
        });

        removeImageBtn.addEventListener('click', () => {
            imageInput.value = '';
            ui.clearImagePreview(previewImg);
        });

        // 表单提交
        this.noteForm.addEventListener('submit', (e) => {
            e.preventDefault();
            this.saveNote();
        });

        // 批量操作事件监听器
        this.initializeBatchOperations();

        // 每页显示数量选择
        const itemsPerPageSelect = document.getElementById('itemsPerPageSelect');
        if (itemsPerPageSelect) {
            itemsPerPageSelect.addEventListener('change', (e) => {
                this.itemsPerPage = parseInt(e.target.value);
                this.currentPage = 1;
                this.loadNotes();
            });
        }
    }

    // 加载主题数据
    async loadThemes() {
        try {
            if (this.themes.length === 0) {
                this.themes = await api.themes.getAll(); // 直接使用返回的数组
                console.log('加载的主题数据:', this.themes); // 调试日志
            }
        } catch (error) {
            console.error('加载主题失败:', error);
            this.themes = []; // 确保themes是数组
        }
    }

    // 加载笔记列表
    async loadNotes() {
        try {
            ui.showLoading();

            // 先加载主题数据
            await this.loadThemes();

            const params = {
                page: this.currentPage,
                limit: this.itemsPerPage,
                search: this.currentSearch
            };

            // 添加主题筛选
            if (this.currentThemeId && this.currentThemeId !== 'all') {
                params.theme_id = this.currentThemeId;
            }

            // 添加标签筛选
            if (window.tagFilterManager && window.tagFilterManager.hasFilter()) {
                this.currentTagFilter = window.tagFilterManager.getSelectedTags();
                params.tags = this.currentTagFilter.join(',');
            } else {
                this.currentTagFilter = [];
            }

            const response = await api.notes.getAll(params);
            this.notes = response.notes;
            this.totalPages = response.totalPages;
            this.renderNotes();
            this.renderPagination();
            this.updateNoteCount(response.total);

        } catch (error) {
            console.error('加载笔记失败:', error);
            ui.showToast('加载笔记失败: ' + error.message, 'error');
        } finally {
            ui.hideLoading();
        }
    }

    // 渲染笔记列表
    renderNotes() {
        if (!this.notesList || !this.emptyState) {
            console.error('笔记列表或空状态元素未找到');
            return;
        }

        // 清空之前的内容
        this.notesList.innerHTML = '';

        if (this.notes.length === 0) {
            this.notesList.style.display = 'none';
            this.emptyState.style.display = 'flex';
            return;
        }

        this.notesList.style.display = 'flex';
        this.emptyState.style.display = 'none';

        // 设置视图模式的CSS类
        this.notesList.className = `notes-list ${this.viewMode}-view`;

        // 创建并添加笔记卡片
        this.notes.forEach(note => {
            const card = this.renderNoteCard(note);
            this.notesList.appendChild(card);
        });
    }

    // 渲染笔记卡片
    renderNoteCard(note) {
        const noteCard = document.createElement('div');
        noteCard.className = 'note-card';
        noteCard.dataset.noteId = note.id;

        // 添加选择状态
        if (this.isEditMode && this.selectedNotes.has(note.id)) {
            noteCard.classList.add('selected');
        }

        // 处理标题
        const title = note.title || '无标题';
        const truncatedTitle = title.length > 50 ? title.substring(0, 50) + '...' : title;

        // 处理内容预览
        let contentPreview = '';
        if (note.content) {
            // 移除HTML标签并截取前100个字符
            const textContent = note.content.replace(/<[^>]*>/g, '').trim();
            contentPreview = textContent.length > 100 ? textContent.substring(0, 100) + '...' : textContent;
        }

        // 处理标签
        const tagsHtml = note.tags && note.tags.length > 0 
            ? note.tags.map(tag => `<span class="tag">${tag}</span>`).join('')
            : '';

        // 处理图片
        const imageHtml = note.image_url 
            ? `<div class="note-image"><img src="${note.image_url}" alt="笔记图片" loading="lazy"></div>`
            : '';

        // 处理主题信息
        let theme = { name: '默认主题', color: '#007bff' };
        const themeIdentifier = note.theme_id || note.theme; // 兼容两种字段名
        if (this.themes && this.themes.length > 0 && themeIdentifier) {
            const foundTheme = this.themes.find(t => t.id == themeIdentifier || t.name == themeIdentifier);
            if (foundTheme) {
                theme = foundTheme;
            }
        }

        noteCard.innerHTML = `
            ${this.isEditMode ? '<div class="note-select-checkbox"><input type="checkbox" ' + (this.selectedNotes.has(note.id) ? 'checked' : '') + '></div>' : ''}
            <div class="note-header">
                <h3 class="note-title">${truncatedTitle}</h3>
                <div class="note-meta">
                    <span class="note-theme" style="color: ${theme.color}">${theme.name}</span>
                    <span class="note-date">${ui.formatDate(note.created_at)}</span>
                    ${note.source ? `<span class="note-source">${note.source}</span>` : ''}
                </div>
            </div>
            ${imageHtml}
            ${contentPreview ? `<div class="note-content">${contentPreview}</div>` : ''}
            ${tagsHtml ? `<div class="note-tags">${tagsHtml}</div>` : ''}
            <div class="note-actions">
                <button class="btn-icon edit-btn" title="编辑" onclick="noteManager.editNote('${note.id}')">
                    <i class="fas fa-edit"></i>
                </button>
                <button class="btn-icon delete-btn" title="删除" onclick="noteManager.deleteNote('${note.id}')">
                    <i class="fas fa-trash"></i>
                </button>
            </div>
        `;

        // 添加点击事件
        if (!this.isEditMode) {
            noteCard.addEventListener('click', (e) => {
                // 如果点击的是按钮，不触发卡片点击事件
                if (e.target.closest('.note-actions')) return;
                this.viewNote(note.id); // 改为查看笔记而不是编辑
            });
        } else {
            // 编辑模式下的选择逻辑
            const checkbox = noteCard.querySelector('input[type="checkbox"]');
            const selectArea = noteCard.querySelector('.note-select-checkbox');
            
            [noteCard, checkbox, selectArea].forEach(element => {
                if (element) {
                    element.addEventListener('click', (e) => {
                        if (e.target.closest('.note-actions')) return;
                        e.stopPropagation();
                        this.toggleNoteSelection(note.id);
                    });
                }
            });
        }

        return noteCard;
    }

    // 格式化笔记来源
    formatNoteSource(note) {
        if (!note.source) {
            return '<span class="note-source">来自: 手动创建</span>';
        }

        let sourceText = '未知';

        if (note.source.type) {
            switch (note.source.type) {
                case 'chrome_extension':
                    sourceText = 'Chrome插件';
                    break;
                case 'web_import':
                    sourceText = 'Web导入';
                    break;
                case 'file_import':
                    sourceText = '文件导入';
                    break;
                case 'url_import':
                    sourceText = 'URL导入';
                    break;
                case 'quick_import':
                    sourceText = '快速导入';
                    break;
                case 'batch_import':
                    sourceText = '批量导入';
                    break;
                case 'manual':
                    sourceText = '手动创建';
                    break;
                default:
                    sourceText = note.source.app || note.source.type || '未知';
            }
        } else if (note.source.app) {
            sourceText = note.source.app;
        } else if (note.source.url) {
            try {
                const url = new URL(note.source.url);
                sourceText = url.hostname;
            } catch (error) {
                sourceText = '网页';
            }
        }

        return `<span class="note-source">来自: ${sourceText}</span>`;
    }

    // 格式化笔记内容
    formatNoteContent(content) {
        // 高亮搜索关键词
        let formattedContent = this.currentSearch ? 
            ui.highlightText(content, this.currentSearch) : content;
        
        // 截断长文本
        formattedContent = ui.truncateText(formattedContent, 200);
        
        // 转换换行符为HTML
        return formattedContent.replace(/\n/g, '<br>');
    }

    // 渲染分页
    renderPagination() {
        if (!this.pagination || this.totalPages <= 1) {
            this.pagination.style.display = 'none';
            return;
        }

        this.pagination.style.display = 'flex';

        const buttons = [];
        
        // 上一页按钮
        buttons.push(`
            <button class="pagination-btn" ${this.currentPage === 1 ? 'disabled' : ''} 
                    onclick="noteManager.goToPage(${this.currentPage - 1})">
                <i class="fas fa-chevron-left"></i>
            </button>
        `);

        // 页码按钮
        const startPage = Math.max(1, this.currentPage - 2);
        const endPage = Math.min(this.totalPages, this.currentPage + 2);

        if (startPage > 1) {
            buttons.push(`<button class="pagination-btn" onclick="noteManager.goToPage(1)">1</button>`);
            if (startPage > 2) {
                buttons.push(`<span class="pagination-ellipsis">...</span>`);
            }
        }

        for (let i = startPage; i <= endPage; i++) {
            buttons.push(`
                <button class="pagination-btn ${i === this.currentPage ? 'active' : ''}" 
                        onclick="noteManager.goToPage(${i})">${i}</button>
            `);
        }

        if (endPage < this.totalPages) {
            if (endPage < this.totalPages - 1) {
                buttons.push(`<span class="pagination-ellipsis">...</span>`);
            }
            buttons.push(`<button class="pagination-btn" onclick="noteManager.goToPage(${this.totalPages})">${this.totalPages}</button>`);
        }

        // 下一页按钮
        buttons.push(`
            <button class="pagination-btn" ${this.currentPage === this.totalPages ? 'disabled' : ''} 
                    onclick="noteManager.goToPage(${this.currentPage + 1})">
                <i class="fas fa-chevron-right"></i>
            </button>
        `);

        this.pagination.innerHTML = `
            ${buttons.join('')}
            <div class="pagination-info">
                第 ${this.currentPage} 页，共 ${this.totalPages} 页
            </div>
        `;
    }

    // 跳转到指定页面
    goToPage(page) {
        if (page >= 1 && page <= this.totalPages && page !== this.currentPage) {
            this.currentPage = page;
            this.loadNotes();
        }
    }

    // 设置当前主题ID
    setCurrentTheme(themeId) {
        this.currentThemeId = themeId;
        this.currentPage = 1; // 重置到第一页
    }

    // 获取当前主题ID
    getCurrentTheme() {
        return this.currentThemeId;
    }

    // 更新笔记数量显示
    updateNoteCount(total) {
        const noteCountElement = document.getElementById('noteCount');
        if (noteCountElement) {
            noteCountElement.textContent = `${total} 条笔记`;
        }
    }

    // 设置视图模式
    setViewMode(mode) {
        this.viewMode = mode;
        
        // 更新按钮状态
        document.getElementById('listViewBtn').classList.toggle('active', mode === 'list');
        document.getElementById('gridViewBtn').classList.toggle('active', mode === 'grid');
        
        // 重新渲染笔记列表
        this.renderNotes();
    }

    // 显示笔记模态框
    showNoteModal(note = null) {
        this.currentEditingNote = note;
        
        if (note) {
            // 编辑模式
            document.getElementById('noteModalTitle').textContent = '编辑笔记';
            document.getElementById('noteTitle').value = note.title;
            document.getElementById('noteContent').value = note.content;
            document.getElementById('noteTheme').value = note.theme;
            document.getElementById('noteTags').value = note.tags ? note.tags.join(', ') : '';
            
            // 显示现有图片
            if (note.image_path) {
                const previewImg = document.getElementById('previewImg');
                previewImg.src = `/${note.image_path}`;
                document.getElementById('imagePreview').style.display = 'block';
            }
        } else {
            // 新建模式
            document.getElementById('noteModalTitle').textContent = '新建笔记';
            this.noteForm.reset();
            ui.clearImagePreview(document.getElementById('previewImg'));
            
            // 设置默认主题
            if (window.themeManager && window.themeManager.getCurrentTheme() !== 'all') {
                document.getElementById('noteTheme').value = window.themeManager.getCurrentTheme();
            }
        }
        
        ui.showModal('noteModal');
    }

    // 保存笔记
    async saveNote() {
        try {
            // 获取表单数据
            const formData = new FormData(this.noteForm);

            // 验证必填字段
            const title = formData.get('title').trim();
            const content = formData.get('content').trim();

            if (!title) {
                ui.showToast('请输入笔记标题', 'warning');
                return;
            }

            if (!content) {
                ui.showToast('请输入笔记内容', 'warning');
                return;
            }

            // 处理标签
            const tagsInput = formData.get('tags').trim();
            let tags = [];
            if (tagsInput) {
                tags = tagsInput.split(',').map(tag => tag.trim()).filter(tag => tag);
            }

            // 构建JSON数据对象
            const noteData = {
                title: title,
                content: content,
                theme: formData.get('theme') || 'default',
                tags: tags
            };

            ui.showLoading(this.currentEditingNote ? '更新笔记中...' : '创建笔记中...');

            let result;
            if (this.currentEditingNote) {
                // 更新笔记
                result = await api.notes.update(this.currentEditingNote.id, noteData);
                ui.showToast('笔记更新成功', 'success');
            } else {
                // 创建笔记
                result = await api.notes.create(noteData);
                ui.showToast('笔记创建成功', 'success');
            }

            ui.hideModal('noteModal');
            await this.loadNotes();

            // 刷新主题列表（更新笔记计数）
            if (window.themeManager) {
                await window.themeManager.loadThemes();
            }

        } catch (error) {
            console.error('保存笔记失败:', error);
            ui.showToast('保存笔记失败: ' + error.message, 'error');
        } finally {
            ui.hideLoading();
        }
    }

    // 编辑笔记
    editNote(noteId) {
        const note = this.notes.find(n => n.id === noteId);
        if (note) {
            this.showNoteModal(note);
        }
    }

    // 查看笔记详情
    viewNote(noteId) {
        const note = this.notes.find(n => n.id === noteId);
        if (note) {
            this.showNoteViewer(note);
        }
    }

    // 显示笔记阅览器
    showNoteViewer(note) {
        if (!this.noteViewer) return;
        
        this.currentViewingNote = note;
        
        // 获取主题信息
        let theme = { name: '默认主题', color: '#007bff' };
        const themeIdentifier = note.theme_id || note.theme; // 兼容两种字段名
        if (this.themes && this.themes.length > 0 && themeIdentifier) {
            const foundTheme = this.themes.find(t => t.id == themeIdentifier || t.name == themeIdentifier);
            if (foundTheme) {
                theme = foundTheme;
            }
        }
        
        // 更新标题
        document.getElementById('viewerNoteTitle').textContent = note.title || '无标题';
        
        // 更新主题信息
        const themeBadge = document.getElementById('viewerThemeBadge');
        const themeColor = document.getElementById('viewerThemeColor');
        const themeName = document.getElementById('viewerThemeName');
        
        if (themeColor) themeColor.style.backgroundColor = theme.color;
        if (themeName) themeName.textContent = theme.name;
        
        // 更新日期
        const dateElement = document.getElementById('viewerDate');
        if (dateElement) dateElement.textContent = ui.formatDate(note.created_at);
        
        // 更新来源
        const sourceElement = document.getElementById('viewerSource');
        if (sourceElement) {
            if (note.source) {
                sourceElement.textContent = note.source;
                sourceElement.style.display = 'inline';
            } else {
                sourceElement.style.display = 'none';
            }
        }
        
        // 更新标签
        const tagsContainer = document.getElementById('viewerTags');
        if (note.tags && note.tags.length > 0) {
            tagsContainer.innerHTML = note.tags.map(tag => `<span class="tag">${tag}</span>`).join('');
            tagsContainer.style.display = 'block';
        } else {
            tagsContainer.style.display = 'none';
        }
        
        // 更新图片
        const imageContainer = document.getElementById('viewerImage');
        const imageElement = document.getElementById('viewerImageElement');
        if (note.image_url) {
            imageElement.src = note.image_url;
            imageContainer.style.display = 'block';
        } else {
            imageContainer.style.display = 'none';
        }
        
        // 更新内容
        const contentElement = document.getElementById('viewerContentText');
        if (note.content) {
            // 使用Markdown渲染器处理内容
            if (window.markdownRenderer) {
                // 使用Markdown渲染器来正确显示图片和其他Markdown元素
                contentElement.innerHTML = window.markdownRenderer.render(note.content);
            } else if (note.content.includes('<')) {
                // 如果没有Markdown渲染器，且内容包含HTML标签，直接显示
                contentElement.innerHTML = note.content;
            } else {
                // 简单转换换行符
                contentElement.innerHTML = note.content.replace(/\n/g, '<br>');
            }
        } else {
            contentElement.innerHTML = '<p style="color: #999; font-style: italic;">暂无内容</p>';
        }
        
        // 显示阅览器
        this.noteViewer.style.display = 'flex';
    }
    
    // 关闭笔记阅览器
    closeNoteViewer() {
        if (this.noteViewer) {
            this.noteViewer.style.display = 'none';
            this.currentViewingNote = null;
        }
    }

    // 复制笔记内容
    async copyNote(noteId) {
        const note = this.notes.find(n => n.id === noteId);
        if (note) {
            const content = `${note.title}\n\n${note.content}`;
            await ui.copyToClipboard(content);
        }
    }

    // 删除笔记
    async deleteNote(noteId) {
        const note = this.notes.find(n => n.id === noteId);
        if (!note) return;

        const confirmed = await ui.showConfirm(
            `确定要删除笔记"${note.title}"吗？\n此操作不可撤销。`,
            '删除笔记'
        );

        if (!confirmed) return;

        try {
            ui.showLoading('删除笔记中...');
            await api.notes.delete(noteId);
            
            ui.showToast('笔记删除成功', 'success');
            await this.loadNotes();
            
            // 刷新主题列表（更新笔记计数）
            if (window.themeManager) {
                await window.themeManager.loadThemes();
            }

        } catch (error) {
            console.error('删除笔记失败:', error);
            ui.showToast('删除笔记失败: ' + error.message, 'error');
        } finally {
            ui.hideLoading();
        }
    }

    // 导出笔记
    exportNotes(format = 'markdown') {
        if (this.notes.length === 0) {
            ui.showToast('没有笔记可以导出', 'warning');
            return;
        }

        let content = '';
        const timestamp = new Date().toISOString().split('T')[0];

        if (format === 'markdown') {
            content = `# 笔记导出 - ${timestamp}\n\n`;
            this.notes.forEach(note => {
                content += `## ${note.title}\n\n`;
                content += `**主题**: ${window.themeManager ? window.themeManager.getThemeName(note.theme) : note.theme}\n`;
                content += `**创建时间**: ${new Date(note.created_at).toLocaleString('zh-CN')}\n`;
                if (note.tags && note.tags.length > 0) {
                    content += `**标签**: ${note.tags.join(', ')}\n`;
                }
                content += `\n${note.content}\n\n---\n\n`;
            });
            
            ui.downloadFile(content, `notes-${timestamp}.md`, 'text/markdown');
        } else if (format === 'json') {
            content = JSON.stringify(this.notes, null, 2);
            ui.downloadFile(content, `notes-${timestamp}.json`, 'application/json');
        }

        ui.showToast('笔记导出成功', 'success');
    }

    // 更新笔记数量显示
    updateNoteCount(count) {
        const noteCountElement = document.getElementById('noteCount');
        if (noteCountElement) {
            noteCountElement.textContent = `${count || 0} 条笔记`;
        }
    }

    // 初始化批量操作
    initializeBatchOperations() {
        const editModeBtn = document.getElementById('editModeBtn');
        const batchActions = document.getElementById('batchActions');
        const selectAllBtn = document.getElementById('selectAllBtn');
        const batchDeleteBtn = document.getElementById('batchDeleteBtn');
        const batchExportBtn = document.getElementById('batchExportBtn');
        const cancelBatchBtn = document.getElementById('cancelBatchBtn');

        // 编辑模式切换已在initializeEventListeners中处理

        // 全选
        if (selectAllBtn) {
            selectAllBtn.addEventListener('click', () => {
                this.selectAllNotes();
            });
        }

        // 批量删除
        if (batchDeleteBtn) {
            batchDeleteBtn.addEventListener('click', () => {
                this.batchDeleteNotes();
            });
        }

        // 批量导出
        if (batchExportBtn) {
            batchExportBtn.addEventListener('click', (e) => {
                console.log('Batch export button clicked, selected notes:', this.selectedNotes.size);
                e.preventDefault();
                e.stopPropagation();
                this.showBatchExportModal();
            });
        } else {
            console.error('Batch export button not found');
        }

        // 取消批量操作
        if (cancelBatchBtn) {
            cancelBatchBtn.addEventListener('click', () => {
                this.exitEditMode();
            });
        }

        // 批量导出模态框事件
        this.initializeBatchExportModal();
    }

    // 切换编辑模式
    toggleEditMode() {
        this.isEditMode = !this.isEditMode;
        this.selectedNotes.clear();
        this.updateEditModeUI();
        this.renderNotes();
    }

    // 退出编辑模式
    exitEditMode() {
        this.isEditMode = false;
        this.selectedNotes.clear();
        this.updateEditModeUI();
        this.renderNotes();
    }

    // 更新编辑模式UI
    updateEditModeUI() {
        const editModeBtn = document.getElementById('editModeBtn');
        const batchActions = document.getElementById('batchActions');
        const newNoteBtn = document.getElementById('newNoteBtn');

        if (this.isEditMode) {
            editModeBtn.innerHTML = '<i class="fas fa-times"></i> 退出编辑';
            editModeBtn.classList.add('active');
            batchActions.style.display = 'flex';
            newNoteBtn.style.display = 'none';
        } else {
            editModeBtn.innerHTML = '<i class="fas fa-edit"></i> 编辑模式';
            editModeBtn.classList.remove('active');
            batchActions.style.display = 'none';
            newNoteBtn.style.display = 'inline-flex';
        }

        this.updateBatchActionsState();
    }

    // 更新批量操作按钮状态
    updateBatchActionsState() {
        const selectAllBtn = document.getElementById('selectAllBtn');
        const batchDeleteBtn = document.getElementById('batchDeleteBtn');
        const batchExportBtn = document.getElementById('batchExportBtn');

        const selectedCount = this.selectedNotes.size;
        const totalCount = this.notes.length;

        if (selectAllBtn) {
            if (selectedCount === totalCount && totalCount > 0) {
                selectAllBtn.innerHTML = '<i class="fas fa-square"></i> 取消全选';
            } else {
                selectAllBtn.innerHTML = '<i class="fas fa-check-square"></i> 全选';
            }
        }

        if (batchDeleteBtn) {
            batchDeleteBtn.disabled = selectedCount === 0;
        }

        if (batchExportBtn) {
            batchExportBtn.disabled = selectedCount === 0;
        }
    }

    // 全选/取消全选
    selectAllNotes() {
        if (this.selectedNotes.size === this.notes.length) {
            // 取消全选
            this.selectedNotes.clear();
        } else {
            // 全选
            this.notes.forEach(note => {
                this.selectedNotes.add(note.id);
            });
        }
        this.updateBatchActionsState();
        this.renderNotes();
    }

    // 切换笔记选择状态
    toggleNoteSelection(noteId) {
        if (this.selectedNotes.has(noteId)) {
            this.selectedNotes.delete(noteId);
        } else {
            this.selectedNotes.add(noteId);
        }
        this.updateBatchActionsState();
        this.renderNotes();
    }

    // 批量删除笔记
    async batchDeleteNotes() {
        if (this.selectedNotes.size === 0) return;

        const selectedCount = this.selectedNotes.size;
        const confirmed = await ui.showConfirm(
            '确认删除',
            `确定要删除选中的 ${selectedCount} 条笔记吗？此操作不可撤销。`
        );

        if (!confirmed) return;

        try {
            ui.showLoading('删除笔记中...');

            const selectedNoteIds = Array.from(this.selectedNotes);
            console.log('Deleting notes:', selectedNoteIds);

            // 逐个删除笔记，避免并发问题
            let successCount = 0;
            let failedCount = 0;
            const errors = [];

            for (const noteId of selectedNoteIds) {
                try {
                    await api.notes.delete(noteId);
                    successCount++;
                    console.log(`Successfully deleted note: ${noteId}`);
                } catch (error) {
                    failedCount++;
                    errors.push({ noteId, error: error.message });
                    console.error(`Failed to delete note ${noteId}:`, error);
                }
            }

            // 显示结果
            if (successCount > 0) {
                ui.showToast(`成功删除 ${successCount} 条笔记${failedCount > 0 ? `，${failedCount} 条失败` : ''}`,
                    failedCount > 0 ? 'warning' : 'success');
            } else {
                ui.showToast('删除失败', 'error');
            }

            // 如果有错误，显示详细信息
            if (errors.length > 0) {
                console.error('Batch delete errors:', errors);
            }

            this.selectedNotes.clear();
            this.exitEditMode();
            this.loadNotes();

        } catch (error) {
            console.error('Batch delete error:', error);
            ui.showToast('批量删除失败: ' + error.message, 'error');
        } finally {
            ui.hideLoading();
        }
    }

    // 显示批量导出模态框
    showBatchExportModal() {
        if (this.selectedNotes.size === 0) {
            ui.showToast('请先选择要导出的笔记', 'warning');
            return;
        }

        console.log('Showing batch export modal for', this.selectedNotes.size, 'notes');

        const modal = document.getElementById('batchExportModal');
        const selectedCountSpan = document.getElementById('selectedNotesCount');

        if (!modal) {
            console.error('Batch export modal not found');
            ui.showToast('导出功能初始化失败', 'error');
            return;
        }

        if (selectedCountSpan) {
            selectedCountSpan.textContent = this.selectedNotes.size;
        }

        ui.showModal('batchExportModal');
    }

    // 初始化批量导出模态框
    initializeBatchExportModal() {
        const modal = document.getElementById('batchExportModal');
        const closeBtn = document.getElementById('closeBatchExportModal');
        const cancelBtn = document.getElementById('cancelBatchExportBtn');
        const confirmBtn = document.getElementById('confirmBatchExportBtn');

        if (closeBtn) {
            closeBtn.addEventListener('click', () => {
                ui.hideModal('batchExportModal');
            });
        }

        if (cancelBtn) {
            cancelBtn.addEventListener('click', () => {
                ui.hideModal('batchExportModal');
            });
        }

        if (confirmBtn) {
            confirmBtn.addEventListener('click', () => {
                this.executeBatchExport();
            });
        }
    }

    // 执行批量导出
    async executeBatchExport() {
        const selectedFormat = document.querySelector('input[name="exportFormat"]:checked')?.value;
        if (!selectedFormat) {
            ui.showToast('请选择导出格式', 'warning');
            return;
        }

        if (this.selectedNotes.size === 0) {
            ui.showToast('请选择要导出的笔记', 'warning');
            return;
        }

        try {
            ui.showLoading('导出笔记中...');

            const selectedNoteIds = Array.from(this.selectedNotes);
            console.log('Exporting notes:', selectedNoteIds, 'Format:', selectedFormat);

            // 使用正确的API路径
            const response = await fetch(`/api/export/custom/${selectedFormat}`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    noteIds: selectedNoteIds,
                    title: `批量导出_${selectedNoteIds.length}条笔记`
                })
            });

            if (!response.ok) {
                let errorMessage = `HTTP ${response.status}`;
                try {
                    const errorData = await response.json();
                    errorMessage = errorData.error || errorMessage;
                } catch (e) {
                    const errorText = await response.text();
                    errorMessage = errorText || errorMessage;
                }
                throw new Error(errorMessage);
            }

            // 获取响应内容
            const exportContent = await response.text();

            if (!exportContent) {
                throw new Error('导出内容为空');
            }

            // 创建下载链接
            const blob = new Blob([exportContent], {
                type: selectedFormat === 'json' ? 'application/json' : 'text/plain; charset=utf-8'
            });
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `batch_export_${selectedNoteIds.length}_notes_${new Date().toISOString().split('T')[0]}.${selectedFormat}`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            window.URL.revokeObjectURL(url);

            ui.showToast(`成功导出 ${selectedNoteIds.length} 条笔记`, 'success');
            ui.hideModal('batchExportModal');

        } catch (error) {
            console.error('Batch export error:', error);
            ui.showToast('批量导出失败: ' + error.message, 'error');
        } finally {
            ui.hideLoading();
        }
    }
}

// 创建全局笔记管理器实例
window.noteManager = new NoteManager();

// 导出NoteManager类（如果使用模块系统）
if (typeof module !== 'undefined' && module.exports) {
    module.exports = NoteManager;
}
