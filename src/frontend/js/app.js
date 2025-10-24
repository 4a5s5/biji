// 主应用程序
class App {
    constructor() {
        this.isInitialized = false;
        this.version = '1.0.0';
        this.init();
    }

    // 初始化应用程序
    async init() {
        try {
            console.log('Smart Note Collector 正在启动...');
            
            // 显示加载指示器
            ui.showLoading('初始化应用程序...');
            
            // 检查API连接
            await this.checkApiConnection();
            
            // 初始化各个模块
            await this.initializeModules();
            
            // 设置全局事件监听器
            this.setupGlobalEventListeners();
            
            // 设置键盘快捷键
            this.setupKeyboardShortcuts();
            
            // 标记为已初始化
            this.isInitialized = true;
            
            console.log('Smart Note Collector 启动完成');
            ui.showToast('应用程序启动成功', 'success');
            
        } catch (error) {
            console.error('应用程序初始化失败:', error);
            ui.showToast('应用程序启动失败: ' + error.message, 'error');
        } finally {
            ui.hideLoading();
        }
    }

    // 检查API连接
    async checkApiConnection() {
        try {
            const health = await api.healthCheck();
            if (health.status !== 'ok') {
                throw new Error('API服务器状态异常');
            }
            console.log('API连接正常');
        } catch (error) {
            throw new Error('无法连接到API服务器: ' + error.message);
        }
    }

    // 初始化各个模块
    async initializeModules() {
        // 主题管理器和笔记管理器已经在各自的文件中自动初始化
        // 这里可以添加其他模块的初始化逻辑
        
        // 等待主题加载完成后再加载笔记
        if (window.themeManager) {
            await new Promise(resolve => {
                const checkThemes = () => {
                    if (window.themeManager.themes.length > 0) {
                        resolve();
                    } else {
                        setTimeout(checkThemes, 100);
                    }
                };
                checkThemes();
            });
        }
    }

    // 设置全局事件监听器
    setupGlobalEventListeners() {
        // 窗口大小改变时重新布局
        window.addEventListener('resize', ui.debounce(() => {
            this.handleResize();
        }, 250));

        // 在线/离线状态监听
        window.addEventListener('online', () => {
            ui.showToast('网络连接已恢复', 'success');
        });

        window.addEventListener('offline', () => {
            ui.showToast('网络连接已断开', 'warning');
        });

        // 页面可见性变化
        document.addEventListener('visibilitychange', () => {
            if (!document.hidden && this.isInitialized) {
                // 页面重新可见时刷新数据
                this.refreshData();
            }
        });

        // 全局错误处理
        window.addEventListener('error', (event) => {
            console.error('全局错误:', event.error);
            ui.showToast('发生了一个错误，请刷新页面重试', 'error');
        });

        // 未处理的Promise拒绝
        window.addEventListener('unhandledrejection', (event) => {
            console.error('未处理的Promise拒绝:', event.reason);
            ui.showToast('操作失败，请重试', 'error');
        });
    }

    // 设置键盘快捷键
    setupKeyboardShortcuts() {
        document.addEventListener('keydown', (e) => {
            // Ctrl/Cmd + N: 新建笔记
            if ((e.ctrlKey || e.metaKey) && e.key === 'n') {
                e.preventDefault();
                if (window.noteManager) {
                    window.noteManager.showNoteModal();
                }
            }

            // Ctrl/Cmd + Shift + N: 新建主题
            if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'N') {
                e.preventDefault();
                if (window.themeManager) {
                    window.themeManager.showThemeModal();
                }
            }

            // Ctrl/Cmd + F: 聚焦搜索框
            if ((e.ctrlKey || e.metaKey) && e.key === 'f') {
                e.preventDefault();
                const searchInput = document.getElementById('searchInput');
                if (searchInput) {
                    searchInput.focus();
                    searchInput.select();
                }
            }

            // Ctrl/Cmd + R: 刷新数据
            if ((e.ctrlKey || e.metaKey) && e.key === 'r') {
                e.preventDefault();
                this.refreshData();
            }

            // Escape: 关闭模态框
            if (e.key === 'Escape') {
                const openModal = document.querySelector('.modal.show');
                if (openModal) {
                    ui.hideModal(openModal.id);
                }
            }
        });
    }

    // 处理窗口大小改变
    handleResize() {
        // 在移动设备上自动调整视图
        const isMobile = window.innerWidth <= 768;
        if (isMobile && window.noteManager) {
            window.noteManager.setViewMode('list');
        }
    }

    // 刷新数据
    async refreshData() {
        try {
            ui.showLoading('刷新数据中...');
            
            // 并行刷新主题和笔记数据
            const promises = [];
            
            if (window.themeManager) {
                promises.push(window.themeManager.loadThemes());
            }
            
            if (window.noteManager) {
                promises.push(window.noteManager.loadNotes());
            }
            
            await Promise.all(promises);
            ui.showToast('数据刷新成功', 'success');
            
        } catch (error) {
            console.error('刷新数据失败:', error);
            ui.showToast('刷新数据失败: ' + error.message, 'error');
        } finally {
            ui.hideLoading();
        }
    }

    // 导出应用数据
    async exportAppData() {
        try {
            ui.showLoading('正在导出数据...');
            
            console.log('开始导出数据...');
            
            // 获取所有数据
            const [themes, notesResponse] = await Promise.all([
                api.themes.getAll(),
                api.notes.getAll({ limit: 1000 }) // 导出所有笔记
            ]);
            
            console.log('获取到的数据:', { themes, notesResponse });
            
            // 处理笔记数据格式
            let notes = [];
            if (notesResponse && Array.isArray(notesResponse.notes)) {
                notes = notesResponse.notes;
            } else if (Array.isArray(notesResponse)) {
                notes = notesResponse;
            }
            
            const exportData = {
                version: this.version,
                exportDate: new Date().toISOString(),
                themes: themes || [],
                notes: notes || [],
                totalThemes: themes ? themes.length : 0,
                totalNotes: notes ? notes.length : 0
            };
            
            console.log('准备导出的数据:', exportData);
            
            const timestamp = new Date().toISOString().split('T')[0];
            const filename = `smart-note-collector-backup-${timestamp}.json`;
            
            ui.downloadFile(
                JSON.stringify(exportData, null, 2),
                filename,
                'application/json'
            );
            
            ui.showToast(`数据导出成功！包含 ${exportData.totalThemes} 个主题和 ${exportData.totalNotes} 条笔记`, 'success');
            
        } catch (error) {
            console.error('导出数据失败:', error);
            ui.showToast('导出数据失败: ' + error.message, 'error');
        } finally {
            ui.hideLoading();
        }
    }

    // 显示应用信息
    showAbout() {
        const aboutHtml = `
            <div class="about-content" style="text-align: center; padding: 2rem;">
                <h2 style="color: #3498db; margin-bottom: 1rem;">
                    <i class="fas fa-sticky-note"></i>
                    Smart Note Collector
                </h2>
                <p style="margin-bottom: 0.5rem;"><strong>版本:</strong> ${this.version}</p>
                <p style="margin-bottom: 0.5rem;"><strong>描述:</strong> 智能笔记收集器</p>
                <p style="margin-bottom: 1.5rem; color: #6c757d;">
                    支持从各种应用程序快速收集文字和图片内容，并按主题进行分类管理。
                </p>
                <div style="display: flex; gap: 1rem; justify-content: center;">
                    <button class="btn btn-primary" onclick="app.exportAppData()">
                        <i class="fas fa-download"></i>
                        导出数据
                    </button>
                    <button class="btn btn-secondary" onclick="app.refreshData()">
                        <i class="fas fa-sync-alt"></i>
                        刷新数据
                    </button>
                </div>
            </div>
        `;

        // 创建临时模态框
        const modal = document.createElement('div');
        modal.className = 'modal show';
        modal.innerHTML = `
            <div class="modal-content" style="max-width: 500px;">
                <div class="modal-header">
                    <h3>关于</h3>
                    <button class="btn-close" onclick="this.closest('.modal').remove(); document.body.style.overflow = '';">
                        <i class="fas fa-times"></i>
                    </button>
                </div>
                <div class="modal-body">
                    ${aboutHtml}
                </div>
            </div>
        `;

        document.body.appendChild(modal);
        document.body.style.overflow = 'hidden';

        // 点击背景关闭
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                modal.remove();
                document.body.style.overflow = '';
            }
        });
    }

    // 获取应用状态
    getStatus() {
        return {
            initialized: this.isInitialized,
            version: this.version,
            themes: window.themeManager ? window.themeManager.themes.length : 0,
            notes: window.noteManager ? window.noteManager.notes.length : 0
        };
    }
}

// 等待DOM加载完成后初始化应用程序
document.addEventListener('DOMContentLoaded', () => {
    window.app = new App();
});

// 导出数据按钮和设置按钮点击事件
document.addEventListener('DOMContentLoaded', () => {
    const exportDataBtn = document.getElementById('exportDataBtn');
    if (exportDataBtn) {
        exportDataBtn.addEventListener('click', () => {
            if (window.app) {
                window.app.exportAppData();
            }
        });
    }
    
    // 设置按钮点击事件
    const settingsBtn = document.getElementById('settingsBtn');
    if (settingsBtn) {
        settingsBtn.addEventListener('click', () => {
            try {
                // 等待AI管理器初始化完成
                const checkAndShowSettings = () => {
                    if (window.aiManager && window.aiManager.isInitialized && typeof window.aiManager.showSettingsModal === 'function') {
                        window.aiManager.showSettingsModal();
                    } else if (window.aiManager && !window.aiManager.isInitialized) {
                        // AI管理器存在但未初始化完成，等待一下
                        setTimeout(checkAndShowSettings, 100);
                    } else {
                        console.error('AI管理器未初始化或方法不存在');
                        ui.showToast('AI功能未正确初始化，请刷新页面重试', 'error');
                    }
                };
                checkAndShowSettings();
            } catch (error) {
                console.error('设置按钮点击错误:', error);
                ui.showToast('发生了一个错误，请刷新页面重试', 'error');
            }
        });
    }
});

// 全局函数，供HTML中的onclick使用
window.showNewNoteModal = () => {
    if (window.noteManager) {
        window.noteManager.showNoteModal();
    }
};

// 导出App类（如果使用模块系统）
if (typeof module !== 'undefined' && module.exports) {
    module.exports = App;
}
