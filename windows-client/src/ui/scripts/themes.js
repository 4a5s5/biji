// Smart Note Collector - 主题管理模块
// window.ipcRenderer 已在 dialogs.js 中声明

// 主题管理类
class ThemesManager {
    constructor() {
        this.themes = [];
        this.selectedThemeId = 'all';
    }

    // 初始化
    init() {
        this.bindEvents();
        this.loadThemes();
    }

    // 绑定事件
    bindEvents() {
        // 主题筛选点击事件在 main.js 中处理
    }

    // 加载主题列表
    async loadThemes() {
        try {
            const themes = await window.ipcRenderer.invoke('get-themes');
            this.themes = themes || [];

            this.renderThemesList();
            this.updateThemeSelects();

            return themes;
        } catch (error) {
            console.error('加载主题失败:', error);
            this.themes = [];
            showNotification('加载主题失败', error.message, 'error');
            return [];
        }
    }

    // 渲染主题列表
    renderThemesList() {
        const themeList = document.getElementById('themeList');
        if (!themeList) return;

        // 保留"全部"项
        const allItem = themeList.querySelector('[data-theme="all"]');
        themeList.innerHTML = '';

        if (allItem) {
            themeList.appendChild(allItem);
        } else {
            // 创建"全部"项
            const allThemeItem = this.createThemeItem('all', '全部', this.getTotalNotesCount());
            allThemeItem.classList.add('active');
            themeList.appendChild(allThemeItem);
        }

        // 添加主题项
        this.themes.forEach(theme => {
            const themeItem = this.createThemeItem(theme.id, theme.name, theme.noteCount || 0);
            themeList.appendChild(themeItem);
        });

        // 更新总数
        this.updateTotalCount();
    }

    // 创建主题项元素
    createThemeItem(id, name, count) {
        const themeItem = document.createElement('div');
        themeItem.className = 'theme-item';
        themeItem.dataset.theme = id;

        themeItem.innerHTML = `
            <span class="theme-name">${escapeHtml(name)}</span>
            <span class="theme-count">${count}</span>
        `;

        // 添加点击事件
        themeItem.addEventListener('click', () => {
            this.selectTheme(id);
        });

        return themeItem;
    }

    // 选择主题
    selectTheme(themeId) {
        this.selectedThemeId = themeId;

        // 更新UI选中状态
        document.querySelectorAll('.theme-item').forEach(item => {
            item.classList.remove('active');
        });

        const selectedItem = document.querySelector(`[data-theme="${themeId}"]`);
        if (selectedItem) {
            selectedItem.classList.add('active');
        }

        // 通知主应用进行筛选
        if (typeof selectTheme === 'function') {
            selectTheme(themeId);
        }
    }

    // 更新主题选择下拉框
    updateThemeSelects() {
        const themeSelects = document.querySelectorAll('select[id$="Theme"], select[name$="theme"]');

        themeSelects.forEach(select => {
            const currentValue = select.value;

            // 清空选项（保留默认选项）
            const defaultOptions = Array.from(select.options).filter(option =>
                option.value === 'default' || option.value === ''
            );

            select.innerHTML = '';

            // 重新添加默认选项
            defaultOptions.forEach(option => {
                select.appendChild(option);
            });

            // 添加主题选项
            this.themes.forEach(theme => {
                const option = document.createElement('option');
                option.value = theme.id;
                option.textContent = theme.name;
                select.appendChild(option);
            });

            // 恢复之前的选择
            if (currentValue) {
                select.value = currentValue;
            }
        });
    }

    // 获取总笔记数
    getTotalNotesCount() {
        return this.themes.reduce((sum, theme) => sum + (theme.noteCount || 0), 0);
    }

    // 更新总数显示
    updateTotalCount() {
        const totalCountElement = document.getElementById('totalCount');
        if (totalCountElement) {
            totalCountElement.textContent = this.getTotalNotesCount();
        }
    }

    // 创建新主题
    async createTheme(themeName, description = '') {
        try {
            updateOperationStatus('创建主题中...');

            const themeData = {
                name: themeName,
                description: description || `用户创建的主题: ${themeName}`
            };

            const result = await window.ipcRenderer.invoke('create-theme', themeData);

            if (result) {
                updateOperationStatus('就绪');
                showNotification('创建成功', `主题"${themeName}"已创建`, 'success');

                // 重新加载主题列表
                await this.loadThemes();

                return result;
            }
        } catch (error) {
            console.error('创建主题失败:', error);
            updateOperationStatus('创建失败');
            showNotification('创建失败', error.message, 'error');
            return null;
        }
    }

    // 编辑主题
    async editTheme(themeId, newName, newDescription = '') {
        try {
            updateOperationStatus('更新主题中...');

            const themeData = {
                name: newName,
                description: newDescription
            };

            const result = await window.ipcRenderer.invoke('update-theme', themeId, themeData);

            if (result) {
                updateOperationStatus('就绪');
                showNotification('更新成功', `主题已更新为"${newName}"`, 'success');

                // 重新加载主题列表
                await this.loadThemes();

                return result;
            }
        } catch (error) {
            console.error('更新主题失败:', error);
            updateOperationStatus('更新失败');
            showNotification('更新失败', error.message, 'error');
            return null;
        }
    }

    // 删除主题
    async deleteTheme(themeId) {
        const theme = this.themes.find(t => t.id === themeId);
        if (!theme) return;

        // 不允许删除默认主题
        if (themeId === 'default') {
            showNotification('操作失败', '不能删除默认主题', 'warning');
            return;
        }

        const confirmed = confirm(
            `确定要删除主题"${theme.name}"吗？\n\n` +
            `该主题下的 ${theme.noteCount || 0} 条笔记将被移动到默认主题。\n\n` +
            `此操作不可撤销。`
        );

        if (!confirmed) return;

        try {
            updateOperationStatus('删除主题中...');

            const result = await window.ipcRenderer.invoke('delete-theme', themeId);

            if (result) {
                updateOperationStatus('就绪');
                showNotification('删除成功', `主题"${theme.name}"已删除`, 'success');

                // 如果正在筛选被删除的主题，切换到全部
                if (this.selectedThemeId === themeId) {
                    this.selectTheme('all');
                }

                // 重新加载主题列表
                await this.loadThemes();

                return result;
            }
        } catch (error) {
            console.error('删除主题失败:', error);
            updateOperationStatus('删除失败');
            showNotification('删除失败', error.message, 'error');
            return null;
        }
    }

    // 显示添加主题对话框
    showAddThemeDialog() {
        const themeName = prompt('请输入新主题名称:');
        if (!themeName || !themeName.trim()) {
            return;
        }

        // 检查主题名是否已存在
        const existingTheme = this.themes.find(t =>
            t.name.toLowerCase() === themeName.trim().toLowerCase()
        );

        if (existingTheme) {
            showNotification('创建失败', '主题名称已存在', 'warning');
            return;
        }

        this.createTheme(themeName.trim());
    }

    // 显示编辑主题对话框
    showEditThemeDialog(themeId) {
        const theme = this.themes.find(t => t.id === themeId);
        if (!theme) return;

        if (themeId === 'default') {
            showNotification('操作失败', '不能编辑默认主题', 'warning');
            return;
        }

        const newName = prompt('请输入新的主题名称:', theme.name);
        if (!newName || !newName.trim()) {
            return;
        }

        if (newName.trim() === theme.name) {
            return; // 名称没有变化
        }

        // 检查主题名是否已存在
        const existingTheme = this.themes.find(t =>
            t.id !== themeId &&
            t.name.toLowerCase() === newName.trim().toLowerCase()
        );

        if (existingTheme) {
            showNotification('更新失败', '主题名称已存在', 'warning');
            return;
        }

        this.editTheme(themeId, newName.trim(), theme.description);
    }

    // 获取主题信息
    getTheme(themeId) {
        return this.themes.find(t => t.id === themeId);
    }

    // 获取主题名称
    getThemeName(themeId) {
        const theme = this.getTheme(themeId);
        return theme ? theme.name : '默认主题';
    }

    // 刷新主题列表
    async refresh() {
        await this.loadThemes();
    }

    // 主题统计
    getThemeStats() {
        return {
            total: this.themes.length,
            totalNotes: this.getTotalNotesCount(),
            themes: this.themes.map(theme => ({
                id: theme.id,
                name: theme.name,
                noteCount: theme.noteCount || 0
            }))
        };
    }
}

// 创建全局主题管理器实例
const themesManager = new ThemesManager();

// 页面加载完成后初始化
document.addEventListener('DOMContentLoaded', () => {
    themesManager.init();
});

// 添加主题按钮点击事件
document.addEventListener('click', (e) => {
    if (e.target.id === 'addThemeBtn') {
        themesManager.showAddThemeDialog();
    }
});

// 主题项右键菜单（可选功能）
document.addEventListener('contextmenu', (e) => {
    const themeItem = e.target.closest('.theme-item');
    if (themeItem && themeItem.dataset.theme !== 'all') {
        e.preventDefault();

        const themeId = themeItem.dataset.theme;
        if (themeId === 'default') return; // 默认主题不显示右键菜单

        showThemeContextMenu(e.clientX, e.clientY, themeId);
    }
});

// 显示主题右键菜单
function showThemeContextMenu(x, y, themeId) {
    // 移除现有菜单
    const existingMenu = document.getElementById('themeContextMenu');
    if (existingMenu) {
        existingMenu.remove();
    }

    const menu = document.createElement('div');
    menu.id = 'themeContextMenu';
    menu.style.cssText = `
        position: fixed;
        top: ${y}px;
        left: ${x}px;
        background: white;
        border: 1px solid #e9ecef;
        border-radius: 6px;
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
        z-index: 1000;
        min-width: 120px;
        overflow: hidden;
    `;

    menu.innerHTML = `
        <div class="context-menu-item" onclick="themesManager.showEditThemeDialog('${themeId}')">
            <span>✏️ 编辑</span>
        </div>
        <div class="context-menu-item" onclick="themesManager.deleteTheme('${themeId}')">
            <span>🗑️ 删除</span>
        </div>
    `;

    // 添加样式
    if (!document.getElementById('contextMenuStyles')) {
        const styles = document.createElement('style');
        styles.id = 'contextMenuStyles';
        styles.textContent = `
            .context-menu-item {
                padding: 8px 12px;
                cursor: pointer;
                font-size: 14px;
                transition: background 0.2s;
            }
            .context-menu-item:hover {
                background: #f8f9fa;
            }
        `;
        document.head.appendChild(styles);
    }

    document.body.appendChild(menu);

    // 点击其他地方关闭菜单
    const closeMenu = (e) => {
        if (!menu.contains(e.target)) {
            menu.remove();
            document.removeEventListener('click', closeMenu);
        }
    };

    setTimeout(() => {
        document.addEventListener('click', closeMenu);
    }, 100);
}

console.log('主题管理模块加载完成');