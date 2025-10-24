// 快速导入页面逻辑
class QuickImport {
    constructor() {
        this.content = '';
        this.source = null;
        this.themes = [];
        
        this.initializeElements();
        this.initializeEventListeners();
        this.loadData();
    }

    // 初始化DOM元素
    initializeElements() {
        this.contentText = document.getElementById('contentText');
        this.contentInfo = document.getElementById('contentInfo');
        this.contentSource = document.getElementById('contentSource');
        this.noteTitle = document.getElementById('noteTitle');
        this.noteTheme = document.getElementById('noteTheme');
        this.noteTags = document.getElementById('noteTags');
        this.sourceInfo = document.getElementById('sourceInfo');
        this.sourceApp = document.getElementById('sourceApp');
        this.sourceTitle = document.getElementById('sourceTitle');
        this.sourceTime = document.getElementById('sourceTime');
        this.loading = document.getElementById('loading');
        this.toastContainer = document.getElementById('toastContainer');
    }

    // 初始化事件监听器
    initializeEventListeners() {
        // 关闭按钮
        document.getElementById('closeBtn').addEventListener('click', () => {
            this.closeWindow();
        });

        // 取消按钮
        document.getElementById('cancelBtn').addEventListener('click', () => {
            this.closeWindow();
        });

        // 保存按钮
        document.getElementById('saveBtn').addEventListener('click', () => {
            this.saveNote();
        });

        // ESC键关闭
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                this.closeWindow();
            }
        });

        // Enter键保存（Ctrl+Enter）
        document.addEventListener('keydown', (e) => {
            if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
                this.saveNote();
            }
        });
    }

    // 加载数据
    async loadData() {
        try {
            // 从URL参数获取内容和来源信息
            const urlParams = new URLSearchParams(window.location.search);
            this.content = urlParams.get('content') || '';
            const sourceParam = urlParams.get('source');
            
            if (sourceParam) {
                try {
                    this.source = JSON.parse(decodeURIComponent(sourceParam));
                } catch (e) {
                    console.warn('Failed to parse source info:', e);
                }
            }

            // 显示内容
            this.displayContent();

            // 加载主题列表
            await this.loadThemes();

            // 生成默认标题
            this.generateDefaultTitle();

        } catch (error) {
            console.error('Failed to load data:', error);
            this.showToast('加载数据失败', 'error');
        }
    }

    // 显示内容
    displayContent() {
        if (this.content) {
            this.contentText.textContent = this.content;
            
            // 更新内容信息
            const contentLength = this.content.length;
            document.querySelector('.content-length').textContent = `长度: ${contentLength} 字符`;
            
            if (this.source) {
                this.contentSource.textContent = `来自: ${this.source.app || '未知应用'}`;
                this.displaySourceInfo();
            }
        } else {
            this.contentText.textContent = '没有检测到内容，请先选中要收集的文字，然后右键选择"添加到笔记"。';
            this.contentText.style.color = '#6c757d';
            this.contentText.style.fontStyle = 'italic';
        }
    }

    // 显示来源信息
    displaySourceInfo() {
        if (this.source) {
            this.sourceApp.textContent = this.source.app || '未知';
            this.sourceTitle.textContent = this.source.title || '未知';
            this.sourceTime.textContent = this.source.timestamp ? 
                new Date(this.source.timestamp).toLocaleString('zh-CN') : '未知';
            
            this.sourceInfo.style.display = 'block';
        }
    }

    // 加载主题列表
    async loadThemes() {
        try {
            this.themes = await api.themes.getAll();
            this.renderThemeOptions();
        } catch (error) {
            console.error('Failed to load themes:', error);
            this.showToast('加载主题失败', 'error');
        }
    }

    // 渲染主题选项
    renderThemeOptions() {
        this.noteTheme.innerHTML = '';
        
        this.themes.forEach(theme => {
            const option = document.createElement('option');
            option.value = theme.id;
            option.textContent = theme.name;
            option.style.color = theme.color;
            this.noteTheme.appendChild(option);
        });
    }

    // 生成默认标题
    generateDefaultTitle() {
        if (this.content) {
            // 从内容中提取前几个词作为标题
            const words = this.content.trim().split(/\s+/).slice(0, 8);
            let title = words.join(' ');
            
            if (title.length > 50) {
                title = title.substring(0, 47) + '...';
            }
            
            // 如果有来源信息，添加到标题中
            if (this.source && this.source.app) {
                title = `${title} - 来自${this.source.app}`;
            }
            
            this.noteTitle.value = title;
        }
    }

    // 保存笔记
    async saveNote() {
        try {
            if (!this.content.trim()) {
                this.showToast('内容不能为空', 'warning');
                return;
            }

            this.showLoading('保存笔记中...');

            // 处理标签
            const tagsInput = this.noteTags.value.trim();
            const tags = tagsInput ? 
                tagsInput.split(',').map(tag => tag.trim()).filter(tag => tag) : [];

            // 构建笔记数据
            const noteData = {
                title: this.noteTitle.value.trim() || '快速导入笔记',
                content: this.content.trim(),
                theme: this.noteTheme.value || 'default',
                tags: tags,
                source: this.source
            };

            // 发送到服务器
            const result = await api.request('/quick-import', {
                method: 'POST',
                body: JSON.stringify(noteData)
            });

            this.hideLoading();
            this.showToast('笔记保存成功！', 'success');

            // 延迟关闭窗口
            setTimeout(() => {
                this.closeWindow();
            }, 1500);

        } catch (error) {
            this.hideLoading();
            console.error('Failed to save note:', error);
            this.showToast('保存笔记失败: ' + error.message, 'error');
        }
    }

    // 显示加载指示器
    showLoading(message = '加载中...') {
        const loadingText = this.loading.querySelector('p');
        if (loadingText) {
            loadingText.textContent = message;
        }
        this.loading.style.display = 'flex';
    }

    // 隐藏加载指示器
    hideLoading() {
        this.loading.style.display = 'none';
    }

    // 显示Toast通知
    showToast(message, type = 'info', duration = 3000) {
        const toast = document.createElement('div');
        toast.className = `toast ${type}`;
        toast.textContent = message;
        
        this.toastContainer.appendChild(toast);
        
        // 自动移除Toast
        setTimeout(() => {
            toast.style.animation = 'toastSlideOut 0.3s ease forwards';
            setTimeout(() => {
                if (toast.parentNode) {
                    toast.parentNode.removeChild(toast);
                }
            }, 300);
        }, duration);
        
        // 点击移除Toast
        toast.addEventListener('click', () => {
            toast.style.animation = 'toastSlideOut 0.3s ease forwards';
            setTimeout(() => {
                if (toast.parentNode) {
                    toast.parentNode.removeChild(toast);
                }
            }, 300);
        });
    }

    // 关闭窗口
    closeWindow() {
        // 尝试关闭窗口
        if (window.opener) {
            window.close();
        } else {
            // 如果不能关闭，跳转到主页面
            window.location.href = '/';
        }
    }
}

// 添加Toast滑出动画的CSS
const style = document.createElement('style');
style.textContent = `
    @keyframes toastSlideOut {
        to {
            opacity: 0;
            transform: translateX(100%);
        }
    }
`;
document.head.appendChild(style);

// 等待DOM加载完成后初始化
document.addEventListener('DOMContentLoaded', () => {
    window.quickImport = new QuickImport();
});

// 导出QuickImport类（如果使用模块系统）
if (typeof module !== 'undefined' && module.exports) {
    module.exports = QuickImport;
}
