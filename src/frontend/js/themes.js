// 主题管理模块
class ThemeManager {
    constructor() {
        this.themes = [];
        this.currentTheme = 'all';
        this.themesList = document.getElementById('themesList');
        this.themeModal = document.getElementById('themeModal');
        this.themeForm = document.getElementById('themeForm');
        this.currentEditingTheme = null;
        
        this.initializeEventListeners();
        this.loadThemes();
    }

    // 初始化事件监听器
    initializeEventListeners() {
        // 新建主题按钮
        const newThemeBtn = document.getElementById('newThemeBtn');
        if (newThemeBtn) {
            newThemeBtn.addEventListener('click', () => {
                this.showThemeModal();
            });
        } else {
            console.warn('newThemeBtn not found');
        }

        // 刷新主题按钮
        const refreshThemesBtn = document.getElementById('refreshThemesBtn');
        if (refreshThemesBtn) {
            refreshThemesBtn.addEventListener('click', () => {
                this.loadThemes();
            });
        } else {
            console.warn('refreshThemesBtn not found');
        }

        // 主题模态框关闭按钮
        const closeThemeModal = document.getElementById('closeThemeModal');
        if (closeThemeModal) {
            closeThemeModal.addEventListener('click', () => {
                ui.hideModal('themeModal');
            });
        } else {
            console.warn('closeThemeModal not found');
        }

        // 取消按钮
        const cancelThemeBtn = document.getElementById('cancelThemeBtn');
        if (cancelThemeBtn) {
            cancelThemeBtn.addEventListener('click', () => {
                ui.hideModal('themeModal');
            });
        } else {
            console.warn('cancelThemeBtn not found');
        }

        // 保存按钮
        const saveThemeBtn = document.getElementById('saveThemeBtn');
        if (saveThemeBtn) {
            saveThemeBtn.addEventListener('click', () => {
                this.saveTheme();
            });
        } else {
            console.warn('saveThemeBtn not found');
        }

        // 颜色预设按钮
        document.querySelectorAll('.color-preset').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const color = e.target.dataset.color;
                document.getElementById('themeColor').value = color;
            });
        });

        // 表单提交
        if (this.themeForm) {
            this.themeForm.addEventListener('submit', (e) => {
                e.preventDefault();
                this.saveTheme();
            });
        } else {
            console.warn('themeForm not found');
        }
    }

    // 加载所有主题
    async loadThemes() {
        try {
            ui.showLoading('加载主题中...');
            this.themes = await api.themes.getAll();
            this.renderThemes();
            this.updateThemeSelects();
        } catch (error) {
            console.error('加载主题失败:', error);
            ui.showToast('加载主题失败: ' + error.message, 'error');
        } finally {
            ui.hideLoading();
        }
    }

    // 渲染主题列表
    renderThemes() {
        if (!this.themesList) return;

        // 添加"全部笔记"选项
        const allNotesItem = this.createThemeItem({
            id: 'all',
            name: '全部笔记',
            color: '#6c757d',
            note_count: this.getTotalNoteCount()
        }, true);

        const themeItems = this.themes.map(theme => this.createThemeItem(theme));
        
        this.themesList.innerHTML = '';
        this.themesList.appendChild(allNotesItem);
        themeItems.forEach(item => this.themesList.appendChild(item));
    }

    // 创建主题项元素
    createThemeItem(theme, isAllNotes = false) {
        const item = document.createElement('div');
        item.className = `theme-item ${this.currentTheme === theme.id ? 'active' : ''}`;
        item.dataset.themeId = theme.id;

        item.innerHTML = `
            <div class="theme-color" style="background-color: ${theme.color}"></div>
            <div class="theme-info">
                <div class="theme-name">${theme.name}</div>
                <div class="theme-count">${theme.noteCount || theme.note_count || 0} 条笔记</div>
            </div>
            ${!isAllNotes ? `
                <div class="theme-actions">
                    <button class="theme-action-btn" onclick="themeManager.editTheme('${theme.id}')" title="编辑">
                        <i class="fas fa-edit"></i>
                    </button>
                    <button class="theme-action-btn" onclick="themeManager.deleteTheme('${theme.id}')" title="删除">
                        <i class="fas fa-trash"></i>
                    </button>
                </div>
            ` : ''}
        `;

        // 点击切换主题
        item.addEventListener('click', (e) => {
            // 如果点击的是操作按钮，不切换主题
            if (e.target.closest('.theme-actions')) {
                return;
            }
            this.selectTheme(theme.id);
        });

        return item;
    }

    // 选择主题
    selectTheme(themeId) {
        this.currentTheme = themeId;
        
        // 更新UI状态
        document.querySelectorAll('.theme-item').forEach(item => {
            item.classList.toggle('active', item.dataset.themeId === themeId);
        });

        // 更新标题
        const theme = themeId === 'all' ? 
            { name: '全部笔记' } : 
            this.themes.find(t => t.id === themeId);
        
        if (theme) {
            const titleElement = document.getElementById('currentThemeTitle');
            if (titleElement) {
                titleElement.textContent = theme.name;
            }
        }

        // 通知笔记管理器主题切换并触发笔记列表更新
        if (window.noteManager) {
            window.noteManager.setCurrentTheme(themeId);
            window.noteManager.loadNotes();
        }
    }

    // 显示主题模态框
    showThemeModal(theme = null) {
        this.currentEditingTheme = theme;
        
        if (theme) {
            // 编辑模式
            document.getElementById('themeModalTitle').textContent = '编辑主题';
            document.getElementById('themeName').value = theme.name;
            document.getElementById('themeColor').value = theme.color;
            document.getElementById('themeIcon').value = theme.icon || 'default';
        } else {
            // 新建模式
            document.getElementById('themeModalTitle').textContent = '新建主题';
            this.themeForm.reset();
            document.getElementById('themeColor').value = '#3498db';
        }
        
        ui.showModal('themeModal');
    }

    // 保存主题
    async saveTheme() {
        try {
            const formData = new FormData(this.themeForm);
            const themeData = {
                name: formData.get('name').trim(),
                color: formData.get('color'),
                icon: formData.get('icon')
            };

            // 验证数据
            if (!themeData.name) {
                ui.showToast('请输入主题名称', 'warning');
                return;
            }

            ui.showLoading(this.currentEditingTheme ? '更新主题中...' : '创建主题中...');

            let result;
            if (this.currentEditingTheme) {
                // 更新主题
                result = await api.themes.update(this.currentEditingTheme.id, themeData);
                ui.showToast('主题更新成功', 'success');
            } else {
                // 创建主题
                result = await api.themes.create(themeData);
                ui.showToast('主题创建成功', 'success');
            }

            ui.hideModal('themeModal');
            await this.loadThemes();

        } catch (error) {
            console.error('保存主题失败:', error);
            ui.showToast('保存主题失败: ' + error.message, 'error');
        } finally {
            ui.hideLoading();
        }
    }

    // 编辑主题
    editTheme(themeId) {
        const theme = this.themes.find(t => t.id === themeId);
        if (theme) {
            this.showThemeModal(theme);
        }
    }

    // 删除主题
    async deleteTheme(themeId) {
        const theme = this.themes.find(t => t.id === themeId);
        if (!theme) return;

        const confirmed = await ui.showConfirm(
            `确定要删除主题"${theme.name}"吗？\n该主题下的所有笔记将移动到默认主题。`,
            '删除主题'
        );

        if (!confirmed) return;

        try {
            ui.showLoading('删除主题中...');
            const result = await api.themes.delete(themeId);
            
            ui.showToast(`主题删除成功${result.movedNotes ? `，已移动 ${result.movedNotes} 条笔记到默认主题` : ''}`, 'success');
            
            // 如果当前选中的是被删除的主题，切换到全部笔记
            if (this.currentTheme === themeId) {
                this.selectTheme('all');
            }
            
            await this.loadThemes();
            
            // 刷新笔记列表
            if (window.noteManager) {
                window.noteManager.loadNotes();
            }

        } catch (error) {
            console.error('删除主题失败:', error);
            ui.showToast('删除主题失败: ' + error.message, 'error');
        } finally {
            ui.hideLoading();
        }
    }

    // 更新主题选择下拉框
    updateThemeSelects() {
        const selects = document.querySelectorAll('#noteTheme');
        selects.forEach(select => {
            const currentValue = select.value;
            select.innerHTML = '';
            
            this.themes.forEach(theme => {
                const option = document.createElement('option');
                option.value = theme.id;
                option.textContent = theme.name;
                option.selected = theme.id === currentValue;
                select.appendChild(option);
            });
        });
    }

    // 获取主题信息
    getTheme(themeId) {
        return this.themes.find(t => t.id === themeId);
    }

    // 获取当前选中的主题
    getCurrentTheme() {
        return this.currentTheme;
    }

    // 获取总笔记数量
    getTotalNoteCount() {
        return this.themes.reduce((total, theme) => total + (theme.noteCount || theme.note_count || 0), 0);
    }

    // 根据主题ID获取主题颜色
    getThemeColor(themeId) {
        const theme = this.getTheme(themeId);
        return theme ? theme.color : '#6c757d';
    }

    // 根据主题ID获取主题名称
    getThemeName(themeId) {
        const theme = this.getTheme(themeId);
        return theme ? theme.name : '未知主题';
    }
}

// 创建全局主题管理器实例
window.themeManager = new ThemeManager();

// 导出ThemeManager类（如果使用模块系统）
if (typeof module !== 'undefined' && module.exports) {
    module.exports = ThemeManager;
}
