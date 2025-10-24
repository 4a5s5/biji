// Smart Note Collector - 笔记管理模块
// window.ipcRenderer 已在 dialogs.js 中声明

// 笔记相关功能
class NotesManager {
    constructor() {
        this.notes = [];
        this.selectedNoteId = null;
        this.currentPage = 1;
        this.totalPages = 1;
        this.pageSize = 20;
    }

    // 初始化
    init() {
        this.bindEvents();
        this.loadNotes();
    }

    // 绑定事件
    bindEvents() {
        // 右侧面板关闭按钮
        const closeDetailBtn = document.getElementById('closeDetailBtn');
        if (closeDetailBtn) {
            closeDetailBtn.addEventListener('click', () => {
                this.hideNoteDetail();
            });
        }
    }

    // 加载笔记列表
    async loadNotes(page = 1, options = {}) {
        try {
            updateOperationStatus('加载笔记中...');

            const requestOptions = {
                page: page,
                limit: this.pageSize,
                theme: currentThemeFilter !== 'all' ? currentThemeFilter : undefined,
                search: currentSearchQuery || undefined,
                ...options
            };

            const response = await window.ipcRenderer.invoke('get-notes', requestOptions);

            if (response && response.notes) {
                const pageValue = response.page ?? response.currentPage ?? 1;
                const totalPages = response.totalPages ?? response.pageCount ?? 1;

                this.displayNotes(response.notes, { page: pageValue, totalPages });
                this.updatePagination(pageValue, totalPages);
                this.updateNoteCountStatus(response.total ?? response.notes.length ?? 0);
            }

            updateOperationStatus('就绪');
            return response;
        } catch (error) {
            console.error('加载笔记失败:', error);
            updateOperationStatus('加载失败');
            showNotification('加载笔记失败', error.message, 'error');
            return null;
        }
    }

    // 渲染笔记列表
    renderNotesList() {
        const notesList = document.getElementById('notesList');
        if (!notesList) return;

        if (this.notes.length === 0) {
            notesList.innerHTML = `
                <div class="empty-placeholder">
                    <div style="text-align: center; padding: 40px; color: #6c757d;">
                        <div style="font-size: 48px; margin-bottom: 16px;">📝</div>
                        <h3 style="margin-bottom: 8px;">暂无笔记</h3>
                        <p>点击"新建笔记"开始创建您的第一条笔记</p>
                    </div>
                </div>
            `;
            return;
        }

        notesList.innerHTML = '';

        this.notes.forEach(note => {
            const noteElement = this.createNoteElement(note);
            notesList.appendChild(noteElement);
        });
    }
    // 适配全局脚本的数据渲染入口
    displayNotes(notesArray = [], options = {}) {
        if (Array.isArray(notesArray)) {
            this.notes = notesArray;
        } else if (notesArray && Array.isArray(notesArray.notes)) {
            this.notes = notesArray.notes;
            const pageValue = notesArray.page ?? notesArray.currentPage;
            if (typeof pageValue === 'number') {
                this.currentPage = pageValue;
            }
            if (typeof notesArray.totalPages === 'number') {
                this.totalPages = notesArray.totalPages;
            }
        }

        if (typeof options.page === 'number') {
            this.currentPage = options.page;
        }
        if (typeof options.totalPages === 'number') {
            this.totalPages = options.totalPages;
        }

        this.renderNotesList();
    }


    // 创建笔记元素
    createNoteElement(note) {
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
        let sourceIcon = '✏️';
        if (note.source) {
            switch (note.source.type) {
                case 'clipboard_text':
                    sourceText = '剪切板文字';
                    sourceIcon = '📋';
                    break;
                case 'clipboard_image':
                    sourceText = '剪切板图片';
                    sourceIcon = '🖼️';
                    break;
                case 'windows_screenshot':
                    sourceText = '截图';
                    sourceIcon = '📷';
                    break;
                case 'windows_webcrawl':
                    sourceText = '网页爬取';
                    sourceIcon = '🕷️';
                    break;
                case 'chrome_extension':
                    sourceText = 'Chrome扩展';
                    sourceIcon = '🌐';
                    break;
                case 'windows_manual':
                    sourceText = '手动创建';
                    sourceIcon = '✏️';
                    break;
                default:
                    sourceText = note.source.type || '未知';
                    sourceIcon = '❓';
            }
        }

        // 内容预览
        let contentPreview = note.content.substring(0, 200);
        if (note.content.length > 200) {
            contentPreview += '...';
        }

        noteItem.innerHTML = `
            <div class="note-header">
                <div class="note-title">${escapeHtml(note.title)}</div>
                <div class="note-actions">
                    <button class="note-action-btn" onclick="notesManager.editNote('${note.id}')" title="编辑">✏️</button>
                    <button class="note-action-btn" onclick="notesManager.deleteNote('${note.id}')" title="删除">🗑️</button>
                </div>
            </div>
            <div class="note-meta">
                <span class="note-theme">${escapeHtml(theme.name)}</span>
                <span class="note-source">${sourceIcon} ${sourceText}</span>
                <span class="note-time">${updatedAt}</span>
            </div>
            <div class="note-preview">${escapeHtml(contentPreview)}</div>
            ${note.tags && note.tags.length > 0 ? `
                <div class="note-tags">
                    ${note.tags.map(tag => `<span class="note-tag">${escapeHtml(tag)}</span>`).join('')}
                </div>
            ` : ''}
        `;

        // 添加点击事件
        noteItem.addEventListener('click', (e) => {
            if (!e.target.closest('.note-actions')) {
                this.selectNote(note.id);
            }
        });

        return noteItem;
    }

    // 选择笔记
    selectNote(noteId) {
        this.selectedNoteId = noteId;

        // 更新UI选中状态
        document.querySelectorAll('.note-item').forEach(item => {
            item.classList.remove('selected');
        });

        const selectedItem = document.querySelector(`[data-note-id="${noteId}"]`);
        if (selectedItem) {
            selectedItem.classList.add('selected');
        }

        // 显示笔记详情
        this.showNoteDetail(noteId);
    }

    // 显示笔记详情
    showNoteDetail(noteId) {
        const note = this.notes.find(n => n.id === noteId);
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
                            <strong>标签:</strong>
                            <div style="margin-top: 4px;">
                                ${note.tags.map(tag => `<span class="detail-tag">${escapeHtml(tag)}</span>`).join('')}
                            </div>
                        </div>
                    ` : ''}
                    ${note.source ? `
                        <div class="meta-item">
                            <strong>来源:</strong> ${this.getSourceDescription(note.source)}
                        </div>
                    ` : ''}
                </div>
                <div class="detail-note-content">
                    <strong>内容:</strong>
                    <div class="content-text">${this.formatNoteContent(note.content)}</div>
                </div>
                <div class="detail-actions">
                    <button class="btn-secondary" onclick="notesManager.editNote('${note.id}')">编辑</button>
                    <button class="btn-secondary" onclick="notesManager.duplicateNote('${note.id}')">复制</button>
                    <button class="btn-secondary danger" onclick="notesManager.deleteNote('${note.id}')">删除</button>
                </div>
            `;
        }
    }

    // 隐藏笔记详情
    hideNoteDetail() {
        const rightPanel = document.getElementById('rightPanel');
        if (rightPanel) {
            rightPanel.style.display = 'none';
        }

        // 清除选中状态
        document.querySelectorAll('.note-item').forEach(item => {
            item.classList.remove('selected');
        });

        this.selectedNoteId = null;
    }

    // 获取来源描述
    getSourceDescription(source) {
        if (!source) return '未知';

        const descriptions = {
            'clipboard_text': '剪切板文字',
            'clipboard_image': '剪切板图片',
            'windows_screenshot': 'Windows截图',
            'windows_webcrawl': 'Windows网页爬取',
            'windows_manual': 'Windows手动创建',
            'chrome_extension': 'Chrome扩展',
            'chrome_extension_selection': 'Chrome扩展选择',
            'chrome_extension_screenshot': 'Chrome扩展截图',
            'chrome_extension_crawl': 'Chrome扩展爬取'
        };

        return descriptions[source.type] || source.type || '未知';
    }

    // 格式化笔记内容
    formatNoteContent(content) {
        if (!content) {
            return '';
        }

        try {
            const trimmed = content.trim();
            const looksLikeHtml = /<([a-z][^>]*?)>/i.test(trimmed);
            if (looksLikeHtml) {
                return this.renderHtmlContent(trimmed);
            }
            return this.renderMarkdownContent(trimmed);
        } catch (error) {
            console.error('渲染笔记内容失败:', error);
            return this.renderMarkdownContent(content || '');
        }
    }

    renderMarkdownContent(content) {
        return escapeHtml(content)
            .replace(/\r?\n/g, '<br>')
            .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
            .replace(/\*(.*?)\*/g, '<em>$1</em>')
            .replace(/`(.*?)`/g, '<code>$1</code>')
            .replace(/!\[(.*?)\]\((.*?)\)/g, (match, alt, url) => {
                const safeUrl = this.ensureAbsoluteUrl(url, true);
                return `<img src="${safeUrl}" alt="${escapeHtml(alt)}" style="max-width: 100%; margin: 8px 0;">`;
            })
            .replace(/\[(.*?)\]\((.*?)\)/g, (match, textValue, link) => {
                const safeLink = this.ensureSafeLink(link);
                if (!safeLink) {
                    return escapeHtml(textValue);
                }
                return `<a href="${safeLink}" target="_blank" rel="noopener noreferrer">${escapeHtml(textValue)}</a>`;
            });
    }

    renderHtmlContent(html) {
        try {
            const parser = new DOMParser();
            const doc = parser.parseFromString(html, 'text/html');
            const allowedTags = new Set(['A', 'ABBR', 'B', 'BLOCKQUOTE', 'BR', 'CODE', 'DIV', 'EM', 'H1', 'H2', 'H3', 'H4', 'H5', 'H6', 'HR', 'IMG', 'LI', 'OL', 'P', 'PRE', 'SPAN', 'STRONG', 'SUB', 'SUP', 'TABLE', 'TBODY', 'THEAD', 'TFOOT', 'TD', 'TH', 'TR', 'UL']);
            const globalAllowedAttrs = new Set(['class', 'title']);
            const additionalAttr = {
                A: ['href', 'target', 'rel'],
                IMG: ['src', 'alt', 'title', 'width', 'height'],
                TD: ['colspan', 'rowspan'],
                TH: ['colspan', 'rowspan'],
                TABLE: ['border', 'cellpadding', 'cellspacing']
            };

            const elements = Array.from(doc.body.querySelectorAll('*'));
            elements.forEach(node => {
                if (!allowedTags.has(node.tagName)) {
                    const fragment = doc.createDocumentFragment();
                    while (node.firstChild) {
                        fragment.appendChild(node.firstChild);
                    }
                    node.replaceWith(fragment);
                    return;
                }

                Array.from(node.attributes).forEach(attr => {
                    const attrName = attr.name.toLowerCase();
                    const isAllowedGeneric = globalAllowedAttrs.has(attrName);
                    const allowedForTag = additionalAttr[node.tagName];
                    const isAllowedSpecific = allowedForTag && allowedForTag.includes(attr.name);
                    const isDataAttr = attrName.startsWith('data-');

                    if (attrName.startsWith('on')) {
                        node.removeAttribute(attr.name);
                        return;
                    }

                    if (!isAllowedGeneric && !isAllowedSpecific && !isDataAttr) {
                        node.removeAttribute(attr.name);
                        return;
                    }

                    if (node.tagName === 'A' && attrName === 'href') {
                        const safeHref = this.ensureSafeLink(attr.value);
                        if (safeHref) {
                            node.setAttribute('href', safeHref);
                            node.setAttribute('target', '_blank');
                            node.setAttribute('rel', 'noopener noreferrer');
                        } else {
                            node.removeAttribute('href');
                        }
                    }

                    if (node.tagName === 'IMG' && attrName === 'src') {
                        const safeSrc = this.ensureAbsoluteUrl(attr.value, true);
                        if (safeSrc) {
                            node.setAttribute('src', safeSrc);
                            node.setAttribute('loading', 'lazy');
                        } else {
                            node.remove();
                        }
                    }

                    if (attrName === 'style') {
                        node.removeAttribute('style');
                    }
                });
            });

            return doc.body.innerHTML;
        } catch (error) {
            console.error('解析 HTML 内容失败:', error);
            return this.renderMarkdownContent(html);
        }
    }

    ensureSafeLink(url) {
        const normalized = (url || '').trim();
        if (!normalized) {
            return '';
        }
        if (/^javascript:/i.test(normalized) || /^vbscript:/i.test(normalized)) {
            return '';
        }
        if (/^data:/i.test(normalized)) {
            return '';
        }
        return this.ensureAbsoluteUrl(normalized);
    }

    ensureAbsoluteUrl(url, allowDataImage = false) {
        if (!url) {
            return '';
        }

        const trimmedUrl = url.trim();

        if (allowDataImage && /^data:image\//i.test(trimmedUrl)) {
            return trimmedUrl;
        }

        if (/^(https?:|file:|blob:|mailto:)/i.test(trimmedUrl)) {
            return trimmedUrl;
        }

        if (/^data:/i.test(trimmedUrl)) {
            return '';
        }

        if (trimmedUrl.startsWith('//')) {
            return `https:${trimmedUrl}`;
        }

        const base = (appConfig && appConfig.serverUrl ? appConfig.serverUrl : '').replace(/\/$/, '');
        if (!base) {
            return trimmedUrl;
        }

        const normalizedPath = trimmedUrl.startsWith('/') ? trimmedUrl : `/${trimmedUrl}`;
        return `${base}${normalizedPath}`;
    }

    // 编辑笔记
    editNote(noteId) {
        if (typeof showEditNoteDialog === 'function') {
            showEditNoteDialog(noteId);
        } else {
            console.error('showEditNoteDialog function not found');
        }
    }

    // 删除笔记
    async deleteNote(noteId) {
        const note = this.notes.find(n => n.id === noteId);
        if (!note) return;

        const confirmed = confirm(`确定要删除笔记"${note.title}"吗？\n\n此操作不可撤销。`);
        if (!confirmed) return;

        try {
            updateOperationStatus('删除笔记中...');

            const result = await window.ipcRenderer.invoke('delete-note', noteId);

            if (result) {
                updateOperationStatus('就绪');
                showNotification('删除成功', '笔记已删除', 'success');

                // 刷新笔记列表
                await this.loadNotes(this.currentPage);

                // 如果正在显示该笔记的详情，关闭详情面板
                if (this.selectedNoteId === noteId) {
                    this.hideNoteDetail();
                }
            }
        } catch (error) {
            console.error('删除笔记失败:', error);
            updateOperationStatus('删除失败');
            showNotification('删除失败', error.message, 'error');
        }
    }

    // 复制笔记
    async duplicateNote(noteId) {
        const note = this.notes.find(n => n.id === noteId);
        if (!note) return;

        try {
            const duplicatedNote = {
                title: note.title + ' - 副本',
                content: note.content,
                theme: note.theme,
                tags: note.tags ? [...note.tags] : [],
                source: {
                    type: 'windows_manual',
                    timestamp: new Date().toISOString(),
                    duplicatedFrom: note.id
                }
            };

            updateOperationStatus('复制笔记中...');
            const result = await window.ipcRenderer.invoke('save-note', duplicatedNote);

            if (result) {
                updateOperationStatus('就绪');
                showNotification('复制成功', '笔记已复制', 'success');
                await this.loadNotes(this.currentPage);
            }
        } catch (error) {
            console.error('复制笔记失败:', error);
            updateOperationStatus('复制失败');
            showNotification('复制失败', error.message, 'error');
        }
    }

    // 更新分页显示
    updatePagination(currentPage = this.currentPage, totalPages = this.totalPages) {
        if (typeof currentPage === 'number') {
            this.currentPage = currentPage;
        }
        if (typeof totalPages === 'number') {
            this.totalPages = totalPages;
        }

        const pagination = document.getElementById('pagination');
        const currentPageSpan = document.getElementById('currentPage');
        const totalPagesSpan = document.getElementById('totalPages');
        const prevBtn = document.getElementById('prevPage');
        const nextBtn = document.getElementById('nextPage');

        if (!pagination) return;

        if (!this.totalPages || this.totalPages <= 1) {
            pagination.style.display = 'none';
            return;
        }

        pagination.style.display = 'flex';
        if (currentPageSpan) currentPageSpan.textContent = this.currentPage;
        if (totalPagesSpan) totalPagesSpan.textContent = this.totalPages;

        if (prevBtn) {
            prevBtn.disabled = this.currentPage <= 1;
        }
        if (nextBtn) {
            nextBtn.disabled = this.currentPage >= this.totalPages;
        }
    }

    // 更新笔记数量状态
    updateNoteCountStatus(total) {
        const statusElement = document.getElementById('noteCountStatus');
        if (statusElement) {
            statusElement.textContent = `总计 ${total} 条笔记`;
        }
    }

    // 切换到指定页面
    async changePage(page) {
        if (page < 1 || page > this.totalPages) return;
        await this.loadNotes(page);
    }

    // 刷新笔记列表
    async refresh() {
        await this.loadNotes(this.currentPage);
    }

    // 搜索笔记
    async search(query) {
        currentSearchQuery = query;
        await this.loadNotes(1);
    }

    // 按主题筛选
    async filterByTheme(themeId) {
        currentThemeFilter = themeId;
        await this.loadNotes(1);
    }
}

// 创建全局笔记管理器实例
const notesManager = new NotesManager();

// 设置为全局变量
window.notesManager = notesManager;

// 页面加载完成后初始化
document.addEventListener('DOMContentLoaded', () => {
    notesManager.init();
});

console.log('笔记管理模块加载完成');