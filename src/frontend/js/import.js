// Smart Note Collector - Import Functionality
// 导入功能的JavaScript实现

class ImportManager {
    constructor() {
        this.selectedFiles = [];
        this.currentMethod = 'file';
        this.importResults = [];
        
        this.init();
    }
    
    init() {
        console.log('Initializing Import Manager...');

        this.setupEventListeners();
        this.loadThemes();
        this.setupDragAndDrop();
        this.initializeNewThemeHandlers();
    }
    
    setupEventListeners() {
        // 导入方式切换
        document.querySelectorAll('.import-method').forEach(method => {
            method.addEventListener('click', (e) => {
                this.switchImportMethod(e.currentTarget.dataset.method);
            });
        });
        
        // 文件选择
        document.getElementById('fileInput').addEventListener('change', (e) => {
            this.handleFileSelection(e.target.files);
        });
        
        // 开始导入按钮
        document.getElementById('startImport').addEventListener('click', () => {
            this.startFileImport();
        });
        
        // 文本导入按钮
        document.getElementById('importText').addEventListener('click', () => {
            this.importTextNote();
        });
        
        // URL导入按钮
        document.getElementById('importUrl').addEventListener('click', () => {
            this.importFromUrl();
        });
        
        // 创建新主题复选框
        document.getElementById('createNewTheme').addEventListener('change', (e) => {
            this.updateThemeSelectState();
        });
        
        // 使用原始主题复选框
        document.getElementById('useOriginalTheme').addEventListener('change', (e) => {
            this.updateThemeSelectState();
        });
        
        // 启用更改主题选项复选框
        document.getElementById('enableThemeChange').addEventListener('change', (e) => {
            this.updateThemeSelectState();
        });
    }
    
    setupDragAndDrop() {
        const dropZone = document.querySelector('.file-drop-zone');
        
        dropZone.addEventListener('dragover', (e) => {
            e.preventDefault();
            dropZone.classList.add('dragover');
        });
        
        dropZone.addEventListener('dragleave', (e) => {
            e.preventDefault();
            dropZone.classList.remove('dragover');
        });
        
        dropZone.addEventListener('drop', (e) => {
            e.preventDefault();
            dropZone.classList.remove('dragover');
            
            const files = Array.from(e.dataTransfer.files);
            this.handleFileSelection(files);
        });
    }

    // 创建新主题
    async createNewTheme(name, color, description = '') {
        try {
            if (!name || !name.trim()) {
                throw new Error('主题名称不能为空');
            }

            const themeData = {
                name: name.trim(),
                description: description,
                color: color || '#3498db'
            };

            console.log('Creating new theme:', themeData);
            const newTheme = await api.themes.create(themeData);

            // 重新加载主题列表
            await this.loadThemes();

            ui.showToast(`主题"${newTheme.name}"创建成功`, 'success');
            return newTheme;

        } catch (error) {
            console.error('Failed to create theme:', error);
            ui.showToast('创建主题失败: ' + error.message, 'error');
            throw error;
        }
    }

    // 获取或创建主题
    async getOrCreateTheme(selectId, newThemeGroupId) {
        const select = document.getElementById(selectId);
        if (!select) return null;

        const selectedValue = select.value;

        if (selectedValue === '__new__') {
            // 创建新主题
            const group = document.getElementById(newThemeGroupId);
            if (!group) return null;

            const nameInput = group.querySelector('input[type="text"]');
            const colorInput = group.querySelector('input[type="color"]');

            if (!nameInput || !nameInput.value.trim()) {
                ui.showToast('请输入新主题名称', 'warning');
                nameInput?.focus();
                return null;
            }

            const newTheme = await this.createNewTheme(
                nameInput.value.trim(),
                colorInput?.value || '#3498db'
            );

            // 选择新创建的主题
            select.value = newTheme.id;
            group.style.display = 'none';

            return newTheme.id;
        } else if (selectedValue) {
            return selectedValue;
        } else {
            ui.showToast('请选择主题', 'warning');
            return null;
        }
    }

    switchImportMethod(method) {
        // 更新方法选择器
        document.querySelectorAll('.import-method').forEach(m => {
            m.classList.remove('active');
        });
        document.querySelector(`[data-method="${method}"]`).classList.add('active');
        
        // 显示对应的导入区域
        document.querySelectorAll('.import-section').forEach(section => {
            section.style.display = 'none';
        });
        document.getElementById(`${method}-import`).style.display = 'block';
        
        this.currentMethod = method;
    }

    // 初始化新建主题处理器
    initializeNewThemeHandlers() {
        // 文件导入主题选择
        const importThemeSelect = document.getElementById('importTheme');
        if (importThemeSelect) {
            importThemeSelect.addEventListener('change', (e) => {
                this.toggleNewThemeGroup('newThemeGroup', e.target.value === '__new__');
            });
        }

        // 文本导入主题选择
        const textThemeSelect = document.getElementById('textTheme');
        if (textThemeSelect) {
            textThemeSelect.addEventListener('change', (e) => {
                this.toggleNewThemeGroup('textNewThemeGroup', e.target.value === '__new__');
            });
        }

        // URL导入主题选择
        const urlThemeSelect = document.getElementById('urlTheme');
        if (urlThemeSelect) {
            urlThemeSelect.addEventListener('change', (e) => {
                this.toggleNewThemeGroup('urlNewThemeGroup', e.target.value === '__new__');
            });
        }

        // 颜色预设点击事件
        document.querySelectorAll('.color-preset').forEach(preset => {
            preset.addEventListener('click', (e) => {
                const color = e.target.dataset.color;
                const colorInput = e.target.closest('.color-picker-group').querySelector('input[type="color"]');
                if (colorInput) {
                    colorInput.value = color;
                }

                // 更新选中状态
                e.target.closest('.color-presets').querySelectorAll('.color-preset').forEach(p => {
                    p.classList.remove('active');
                });
                e.target.classList.add('active');
            });
        });
    }

    // 切换新建主题输入组的显示
    toggleNewThemeGroup(groupId, show) {
        const group = document.getElementById(groupId);
        if (group) {
            group.style.display = show ? 'block' : 'none';

            // 如果显示，聚焦到名称输入框
            if (show) {
                const nameInput = group.querySelector('input[type="text"]');
                if (nameInput) {
                    setTimeout(() => nameInput.focus(), 100);
                }
            }
        }
    }

    async loadThemes() {
        try {
            const themes = await api.themes.getAll();
            const selects = ['importTheme', 'textTheme', 'urlTheme'];
            
            selects.forEach(selectId => {
                const select = document.getElementById(selectId);
                if (select) {
                    select.innerHTML = '<option value="">选择主题...</option>';

                    themes.forEach(theme => {
                        const option = document.createElement('option');
                        option.value = theme.id;
                        option.textContent = theme.name;
                        select.appendChild(option);
                    });

                    // 添加新建主题选项
                    const newOption = document.createElement('option');
                    newOption.value = '__new__';
                    newOption.textContent = '+ 新建主题';
                    select.appendChild(newOption);
                }
            });
        } catch (error) {
            console.error('Failed to load themes:', error);
            ui.showToast('加载主题失败', 'error');
        }
    }
    
    handleFileSelection(files) {
        this.selectedFiles = Array.from(files).filter(file => {
            const validTypes = ['.txt', '.md', '.json'];
            const extension = '.' + file.name.split('.').pop().toLowerCase();
            return validTypes.includes(extension) && file.size <= 10 * 1024 * 1024; // 10MB limit
        });
        
        this.displaySelectedFiles();
        this.updateImportButton();
    }
    
    displaySelectedFiles() {
        const container = document.getElementById('selectedFiles');
        
        if (this.selectedFiles.length === 0) {
            container.innerHTML = '';
            return;
        }
        
        container.innerHTML = `
            <h4 style="margin: 20px 0 16px 0;">已选择的文件 (${this.selectedFiles.length})</h4>
            <div class="selected-files-list">
                ${this.selectedFiles.map((file, index) => `
                    <div class="selected-file-item">
                        <div class="file-info">
                            <div class="file-name">
                                <i class="fas fa-file-alt"></i>
                                ${file.name}
                            </div>
                            <div class="file-size">${this.formatFileSize(file.size)}</div>
                        </div>
                        <button class="remove-file-btn" onclick="importManager.removeFile(${index})">
                            <i class="fas fa-times"></i>
                        </button>
                    </div>
                `).join('')}
            </div>
        `;
    }
    
    removeFile(index) {
        this.selectedFiles.splice(index, 1);
        this.displaySelectedFiles();
        this.updateImportButton();
    }
    
    updateImportButton() {
        const button = document.getElementById('startImport');
        button.disabled = this.selectedFiles.length === 0;
    }
    
    formatFileSize(bytes) {
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    }
    
    async startFileImport() {
        if (this.selectedFiles.length === 0) return;
        
        const createNewTheme = document.getElementById('createNewTheme').checked;
        const useOriginalTheme = document.getElementById('useOriginalTheme').checked;
        const enableThemeChange = document.getElementById('enableThemeChange').checked;
        let selectedTheme = null;

        // 获取或创建主题
        if (!createNewTheme && !useOriginalTheme && enableThemeChange) {
            selectedTheme = await this.getOrCreateTheme('importTheme', 'newThemeGroup');
            if (!selectedTheme) {
                return; // 用户取消或输入无效
            }
        }
        
        this.showProgress();
        this.importResults = [];
        
        for (let i = 0; i < this.selectedFiles.length; i++) {
            const file = this.selectedFiles[i];
            const progress = ((i + 1) / this.selectedFiles.length) * 100;
            
            this.updateProgress(progress, `正在导入: ${file.name}`);
            
            try {
                const result = await this.importFile(file, createNewTheme, useOriginalTheme, enableThemeChange, selectedTheme);
                this.importResults.push({
                    type: 'success',
                    message: `${file.name} 导入成功`,
                    details: result
                });
            } catch (error) {
                console.error('Import failed for file:', file.name, error);
                this.importResults.push({
                    type: 'error',
                    message: `${file.name} 导入失败: ${error.message}`,
                    details: error
                });
            }
            
            // 添加小延迟以显示进度
            await new Promise(resolve => setTimeout(resolve, 200));
        }
        
        this.showResults();
    }
    
    async importFile(file, createNewTheme, useOriginalTheme, enableThemeChange, selectedTheme) {
        const content = await this.readFileContent(file);
        const extension = '.' + file.name.split('.').pop().toLowerCase();
        
        let noteData;
        
        switch (extension) {
            case '.txt':
                noteData = this.parseTxtFile(file.name, content);
                break;
            case '.md':
                noteData = this.parseMarkdownFile(file.name, content);
                break;
            case '.json':
                noteData = this.parseJsonFile(content);
                break;
            default:
                throw new Error('不支持的文件格式');
        }
        
        // 确定主题
        let themeId = selectedTheme;
        if (createNewTheme) {
            const themeName = file.name.replace(/\.[^/.]+$/, ""); // 移除扩展名
            const newTheme = await api.themes.create({ name: themeName });
            themeId = newTheme.id;
        } else if (useOriginalTheme) {
            // 使用原文件主题分类导入，会在resolveTheme中处理
            themeId = null; // 设为null，让resolveTheme方法处理
        } else if (!enableThemeChange) {
            // 如果没有启用更改主题选项，使用默认主题
            themeId = 'default';
        }
        
        // 创建笔记
        if (Array.isArray(noteData)) {
            // 批量导入
            const results = [];
            for (const note of noteData) {
                // 智能处理主题
                let finalThemeId = await this.resolveTheme(note.theme, themeId, createNewTheme, useOriginalTheme);

                const result = await api.notes.create({
                    ...note,
                    theme: finalThemeId,
                    tags: [...(note.tags || []), '导入']
                });
                results.push(result);
            }
            return results;
        } else {
            // 单个笔记
            let finalThemeId = await this.resolveTheme(noteData.theme, themeId, createNewTheme, useOriginalTheme);

            return await api.notes.create({
                ...noteData,
                theme: finalThemeId,
                tags: [...(noteData.tags || []), '导入']
            });
        }
    }

    // 智能解析主题
    async resolveTheme(originalTheme, selectedTheme, createNewTheme, useOriginalTheme) {
        // 如果用户选择了创建新主题，使用选中的主题
        if (createNewTheme) {
            return selectedTheme;
        }

        // 如果启用了按原文件主题分类导入
        if (useOriginalTheme && originalTheme && originalTheme !== 'default') {
            try {
                const themes = await api.themes.getAll();
                
                // 优先按名称查找主题
                let matchingTheme = themes.find(theme => theme.name === originalTheme);
                
                // 如果按名称找不到，再按ID查找（兼容旧格式）
                if (!matchingTheme) {
                    matchingTheme = themes.find(theme => theme.id === originalTheme);
                }

                if (matchingTheme) {
                    console.log(`找到匹配主题: ${matchingTheme.name} (${matchingTheme.id})`);
                    return matchingTheme.id;
                } else {
                    // 如果找不到匹配的主题，自动创建新主题
                    // 检查originalTheme是否是UUID格式，如果是则不创建
                    const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(originalTheme);
                    
                    if (isUUID) {
                        console.log(`原始主题"${originalTheme}"是UUID格式，使用默认主题`);
                        return selectedTheme || 'default';
                    } else {
                        console.log(`未找到主题"${originalTheme}"，自动创建新主题`);
                        const newTheme = await api.themes.create({ 
                            name: originalTheme,
                            color: '#3498db' // 默认颜色
                        });
                        return newTheme.id;
                    }
                }
            } catch (error) {
                console.error('解析主题时出错:', error);
                return selectedTheme || 'default';
            }
        }

        // 如果没有原始主题信息，使用选中的主题
        if (!originalTheme || originalTheme === 'default') {
            return selectedTheme || 'default';
        }

        // 默认情况下使用选中的主题
        return selectedTheme || 'default';
    }

    readFileContent(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = (e) => resolve(e.target.result);
            reader.onerror = (e) => reject(new Error('文件读取失败'));
            reader.readAsText(file, 'UTF-8');
        });
    }
    
    parseTxtFile(filename, content) {
        // 检查是否是导出格式的TXT
        if (this.isExportedTxtFormat(content)) {
            return this.parseExportedTxtFile(content);
        }

        // 普通TXT文件
        const title = filename.replace(/\.[^/.]+$/, ""); // 移除扩展名
        return {
            title: title,
            content: content.trim(),
            tags: ['TXT导入']
        };
    }

    // 检查是否是导出格式的TXT
    isExportedTxtFormat(content) {
        const lines = content.split('\n');
        // 检查是否包含导出格式的特征
        return lines.some(line =>
            line.includes('导出时间:') ||
            line.includes('笔记数量:') ||
            line.match(/^\d+\.\s+.+/) // 数字编号的标题
        );
    }

    // 解析导出格式的TXT文件
    parseExportedTxtFile(content) {
        const lines = content.split('\n');
        const notes = [];
        let currentNote = null;
        let isReadingContent = false;

        console.log('检测到导出格式TXT文件，开始解析...');

        for (let i = 0; i < lines.length; i++) {
            const line = lines[i].trim();

            // 检测笔记标题（格式：1. 标题）
            const titleMatch = line.match(/^(\d+)\.\s+(.+)$/);
            if (titleMatch) {
                // 保存上一个笔记
                if (currentNote) {
                    notes.push(currentNote);
                }

                // 开始新笔记
                currentNote = {
                    title: titleMatch[2],
                    content: '',
                    theme: 'default',
                    tags: ['TXT导入'],
                    createdAt: null
                };
                isReadingContent = false;
                continue;
            }

            // 解析创建时间
            if (line.startsWith('创建时间:') && currentNote) {
                currentNote.createdAt = line.replace('创建时间:', '').trim();
                continue;
            }

            // 解析主题
            if (line.startsWith('主题:') && currentNote) {
                currentNote.theme = line.replace('主题:', '').trim();
                continue;
            }

            // 解析标签
            if (line.startsWith('标签:') && currentNote) {
                const tagsStr = line.replace('标签:', '').trim();
                currentNote.tags = [...tagsStr.split(',').map(t => t.trim()), 'TXT导入'];
                continue;
            }

            // 检测内容开始（在"内容:"之后或分隔线之后）
            if (line.startsWith('内容:') || line.match(/^-{10,}$/)) {
                isReadingContent = true;
                continue;
            }

            // 检测笔记结束（分隔线）
            if (line.match(/^={10,}$/) && currentNote) {
                isReadingContent = false;
                continue;
            }

            // 读取内容
            if (isReadingContent && currentNote && line) {
                currentNote.content += (currentNote.content ? '\n' : '') + line;
            }
        }

        // 保存最后一个笔记
        if (currentNote) {
            notes.push(currentNote);
        }

        console.log(`解析完成，共找到${notes.length}条笔记`);
        return notes.length > 0 ? notes : [{
            title: 'TXT导入',
            content: content.trim(),
            tags: ['TXT导入']
        }];
    }

    parseMarkdownFile(filename, content) {
        // 检查是否是导出格式的Markdown
        if (this.isExportedMarkdownFormat(content)) {
            return this.parseExportedMarkdownFile(content);
        }

        // 普通Markdown文件
        const lines = content.split('\n');
        let title = filename.replace(/\.[^/.]+$/, "");
        let actualContent = content;

        // 尝试从第一行提取标题
        if (lines[0] && lines[0].startsWith('# ')) {
            title = lines[0].substring(2).trim();
            actualContent = lines.slice(1).join('\n').trim();
        }

        return {
            title: title,
            content: actualContent,
            tags: ['Markdown导入']
        };
    }

    // 检查是否是导出格式的Markdown
    isExportedMarkdownFormat(content) {
        return content.includes('**导出时间**') ||
               content.includes('**笔记数量**') ||
               content.match(/^## \d+\.\s+.+/m); // 二级标题编号
    }

    // 解析导出格式的Markdown文件
    parseExportedMarkdownFile(content) {
        const lines = content.split('\n');
        const notes = [];
        let currentNote = null;
        let isReadingContent = false;

        console.log('检测到导出格式Markdown文件，开始解析...');

        for (let i = 0; i < lines.length; i++) {
            const line = lines[i].trim();

            // 检测笔记标题（格式：## 1. 标题）
            const titleMatch = line.match(/^## (\d+)\.\s+(.+)$/);
            if (titleMatch) {
                // 保存上一个笔记
                if (currentNote) {
                    notes.push(currentNote);
                }

                // 开始新笔记
                currentNote = {
                    title: titleMatch[2],
                    content: '',
                    theme: 'default',
                    tags: ['Markdown导入'],
                    createdAt: null
                };
                isReadingContent = false;
                continue;
            }

            // 解析创建时间
            if (line.startsWith('**创建时间**:') && currentNote) {
                currentNote.createdAt = line.replace('**创建时间**:', '').trim();
                continue;
            }

            // 解析主题
            if (line.startsWith('**主题**:') && currentNote) {
                currentNote.theme = line.replace('**主题**:', '').trim();
                continue;
            }

            // 解析标签
            if (line.startsWith('**标签**:') && currentNote) {
                const tagsStr = line.replace('**标签**:', '').trim();
                // 移除Markdown格式的反引号
                const cleanTags = tagsStr.replace(/`/g, '').split(',').map(t => t.trim());
                currentNote.tags = [...cleanTags, 'Markdown导入'];
                continue;
            }

            // 检测内容开始
            if (line === '**内容**:' || (line === '' && currentNote && !isReadingContent)) {
                isReadingContent = true;
                continue;
            }

            // 检测笔记结束（分隔线）
            if (line === '---' && currentNote) {
                isReadingContent = false;
                continue;
            }

            // 读取内容
            if (isReadingContent && currentNote) {
                if (line || currentNote.content) { // 保留空行
                    currentNote.content += (currentNote.content ? '\n' : '') + line;
                }
            }
        }

        // 保存最后一个笔记
        if (currentNote) {
            notes.push(currentNote);
        }

        console.log(`解析完成，共找到${notes.length}条笔记`);
        return notes.length > 0 ? notes : [{
            title: 'Markdown导入',
            content: content.trim(),
            tags: ['Markdown导入']
        }];
    }
    
    parseJsonFile(content) {
        try {
            const data = JSON.parse(content);

            // 检查是否是完整的备份文件格式（包含themes和notes）
            if (data.themes && data.notes && Array.isArray(data.themes) && Array.isArray(data.notes)) {
                console.log(`检测到完整备份文件，包含${data.themes.length}个主题和${data.notes.length}条笔记`);
                
                // 创建主题名称映射
                const themeIdToName = new Map();
                data.themes.forEach(theme => {
                    themeIdToName.set(theme.id, theme.name);
                });
                
                return data.notes.map(note => ({
                    title: note.title || '未命名笔记',
                    content: note.content || '',
                    theme: themeIdToName.get(note.theme_id) || themeIdToName.get(note.theme) || 'default', // 使用主题名称而不是ID
                    tags: [...(note.tags || []), 'JSON导入'],
                    originalId: note.id,
                    createdAt: note.created_at || note.createdAt,
                    source: note.source
                }));
            } else if (data.notes && Array.isArray(data.notes)) {
                // 批量导出格式：{ title, exportDate, totalNotes, notes: [...] }
                console.log(`检测到导出格式JSON，包含${data.notes.length}条笔记`);
                return data.notes.map(note => ({
                    title: note.title || '未命名笔记',
                    content: note.content || '',
                    theme: note.theme || 'default', // 保留原主题信息
                    tags: [...(note.tags || []), 'JSON导入'],
                    originalId: note.id, // 保留原始ID用于参考
                    createdAt: note.createdAt,
                    source: note.source
                }));
            } else if (Array.isArray(data)) {
                // 纯笔记数组格式
                return data.map(item => ({
                    title: item.title || '未命名笔记',
                    content: item.content || '',
                    theme: item.theme || 'default',
                    tags: [...(item.tags || []), 'JSON导入']
                }));
            } else if (data.title && data.content) {
                // 单个笔记格式
                return {
                    title: data.title,
                    content: data.content,
                    theme: data.theme || 'default',
                    tags: [...(data.tags || []), 'JSON导入']
                };
            } else {
                // 通用JSON格式，转换为文本
                return {
                    title: 'JSON数据导入',
                    content: JSON.stringify(data, null, 2),
                    tags: ['JSON导入', '数据']
                };
            }
        } catch (error) {
            throw new Error('JSON格式错误');
        }
    }
    
    async importTextNote() {
        const title = document.getElementById('textTitle').value.trim();
        const content = document.getElementById('textContent').value.trim();
        const tagsInput = document.getElementById('textTags').value.trim();

        if (!title || !content) {
            ui.showToast('请输入标题和内容', 'warning');
            return;
        }

        // 获取或创建主题
        const theme = await this.getOrCreateTheme('textTheme', 'textNewThemeGroup');
        if (!theme) {
            return; // 用户取消或输入无效
        }
        
        const tags = tagsInput ? tagsInput.split(',').map(tag => tag.trim()).filter(tag => tag) : [];
        tags.push('文本导入');
        
        try {
            const result = await api.notes.create({
                title: title,
                content: content,
                theme: theme,
                tags: tags
            });
            
            ui.showToast('笔记创建成功！', 'success');
            
            // 清空表单
            document.getElementById('textTitle').value = '';
            document.getElementById('textContent').value = '';
            document.getElementById('textTags').value = '';
            
        } catch (error) {
            console.error('Failed to create note:', error);
            ui.showToast('创建笔记失败: ' + error.message, 'error');
        }
    }
    
    async importFromUrl() {
        const url = document.getElementById('urlInput').value.trim();

        if (!url) {
            ui.showToast('请输入URL', 'warning');
            return;
        }

        // 获取或创建主题
        const theme = await this.getOrCreateTheme('urlTheme', 'urlNewThemeGroup');
        if (!theme) {
            return; // 用户取消或输入无效
        }
        
        try {
            // 这里应该调用后端API来抓取网页内容
            // 暂时使用模拟数据
            const result = await this.fetchUrlContent(url);
            
            const noteData = {
                title: result.title || '网页导入',
                content: `来源: ${url}\n\n${result.content || '无法获取内容'}`,
                theme: theme,
                tags: ['URL导入', '网页']
            };
            
            const createdNote = await api.notes.create(noteData);
            ui.showToast('网页内容导入成功！', 'success');
            
            // 清空表单
            document.getElementById('urlInput').value = '';
            
        } catch (error) {
            console.error('Failed to import from URL:', error);
            ui.showToast('URL导入失败: ' + error.message, 'error');
        }
    }
    
    async fetchUrlContent(url) {
        // 这里应该调用后端API
        // 暂时返回模拟数据
        return new Promise((resolve) => {
            setTimeout(() => {
                resolve({
                    title: '网页标题',
                    content: '这是从网页提取的内容...'
                });
            }, 1000);
        });
    }
    
    showProgress() {
        document.getElementById('importProgress').style.display = 'block';
        document.getElementById('importResults').style.display = 'none';
    }
    
    updateProgress(percentage, text) {
        document.getElementById('progressFill').style.width = percentage + '%';
        document.getElementById('progressText').textContent = text;
    }
    
    showResults() {
        document.getElementById('importProgress').style.display = 'none';
        document.getElementById('importResults').style.display = 'block';
        
        const resultsList = document.getElementById('resultsList');
        resultsList.innerHTML = this.importResults.map(result => `
            <div class="result-item ${result.type}">
                <i class="fas fa-${result.type === 'success' ? 'check-circle' : result.type === 'error' ? 'exclamation-circle' : 'exclamation-triangle'}"></i>
                <span>${result.message}</span>
            </div>
        `).join('');
        
        // 显示总结
        const successCount = this.importResults.filter(r => r.type === 'success').length;
        const errorCount = this.importResults.filter(r => r.type === 'error').length;
        
        ui.showToast(`导入完成！成功: ${successCount}, 失败: ${errorCount}`, successCount > 0 ? 'success' : 'warning');
    }

    // 更新主题选择状态
    updateThemeSelectState() {
        const themeSelect = document.getElementById('importTheme');
        const createNewTheme = document.getElementById('createNewTheme').checked;
        const useOriginalTheme = document.getElementById('useOriginalTheme').checked;
        const enableThemeChange = document.getElementById('enableThemeChange').checked;
        
        // 如果使用原始主题或为每个文件创建新主题，则禁用主题选择
        if (useOriginalTheme || createNewTheme) {
            themeSelect.disabled = true;
        } else if (enableThemeChange) {
            // 如果启用更改主题选项，则启用主题选择
            themeSelect.disabled = false;
        } else {
            // 否则禁用主题选择
            themeSelect.disabled = true;
        }
    }
}

// 重置导入
function resetImport() {
    document.getElementById('importProgress').style.display = 'none';
    document.getElementById('importResults').style.display = 'none';
    document.getElementById('selectedFiles').innerHTML = '';
    document.getElementById('fileInput').value = '';
    
    importManager.selectedFiles = [];
    importManager.updateImportButton();
}

// 初始化
let importManager;
document.addEventListener('DOMContentLoaded', () => {
    importManager = new ImportManager();
});

// 添加选中文件项的样式
if (!document.getElementById('import-styles')) {
    const style = document.createElement('style');
    style.id = 'import-styles';
    style.textContent = `
    .selected-files-list {
        border: 1px solid #e9ecef;
        border-radius: 8px;
        max-height: 200px;
        overflow-y: auto;
    }
    
    .selected-file-item {
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 12px 16px;
        border-bottom: 1px solid #f1f3f4;
    }
    
    .selected-file-item:last-child {
        border-bottom: none;
    }
    
    .file-info {
        flex: 1;
    }
    
    .file-name {
        font-weight: 500;
        color: #2c3e50;
        margin-bottom: 4px;
    }
    
    .file-name i {
        margin-right: 8px;
        color: #6c757d;
    }
    
    .file-size {
        font-size: 12px;
        color: #6c757d;
    }
    
    .remove-file-btn {
        background: #dc3545;
        color: white;
        border: none;
        border-radius: 50%;
        width: 24px;
        height: 24px;
        display: flex;
        align-items: center;
        justify-content: center;
        cursor: pointer;
        font-size: 12px;
        transition: all 0.2s ease;
    }
    
    .remove-file-btn:hover {
        background: #c82333;
    }
`;
    document.head.appendChild(style);
}
