// UI工具模块
class UI {
    constructor() {
        this.toastContainer = document.getElementById('toastContainer');
        this.loadingElement = document.getElementById('loading');
        this.modals = new Map();
        this.initializeModals();
    }

    // 初始化模态框
    initializeModals() {
        const modals = document.querySelectorAll('.modal');
        modals.forEach(modal => {
            this.modals.set(modal.id, modal);
            
            // 移除之前的事件监听器（如果存在）
            modal.removeEventListener('click', modal._clickHandler);
            
            // 只对非AI对话框和非Chrome插件相关的模态框添加点击背景关闭功能
            if (!this.isProtectedModal(modal.id)) {
                // 点击背景关闭模态框
                modal._clickHandler = (e) => {
                    if (e.target === modal) {
                        this.hideModal(modal.id);
                    }
                };
                modal.addEventListener('click', modal._clickHandler);
            }
        });
        
        // 全局ESC键关闭模态框（只绑定一次）
        if (!this._escKeyBound) {
            document.addEventListener('keydown', (e) => {
                if (e.key === 'Escape') {
                    // 找到当前显示的模态框
                    const visibleModal = Array.from(this.modals.values()).find(modal => 
                        modal.classList.contains('show')
                    );
                    if (visibleModal) {
                        this.hideModal(visibleModal.id);
                    }
                }
            });
            this._escKeyBound = true;
        }
    }

    // 检查是否为受保护的模态框（不应该点击外部关闭）
    isProtectedModal(modalId) {
        const protectedModals = [
            'aiChatModal',
            'aiSettingsModal', 
            'presetEditModal',
            'chatHistoryModal',
            'noteEditModal'  // Chrome插件笔记保存界面
        ];
        return protectedModals.includes(modalId);
    }

    // 显示模态框
    showModal(modalId) {
        const modal = this.modals.get(modalId);
        if (modal) {
            modal.classList.add('show');
            document.body.style.overflow = 'hidden';
            
            // 聚焦到第一个输入框
            const firstInput = modal.querySelector('input, textarea, select');
            if (firstInput) {
                setTimeout(() => firstInput.focus(), 100);
            }
        }
    }

    // 隐藏模态框
    hideModal(modalId) {
        const modal = this.modals.get(modalId);
        if (modal) {
            modal.classList.remove('show');
            document.body.style.overflow = '';
        }
    }

    // 显示加载指示器
    showLoading(message = '加载中...') {
        if (this.loadingElement) {
            const loadingText = this.loadingElement.querySelector('p');
            if (loadingText) {
                loadingText.textContent = message;
            }
            this.loadingElement.style.display = 'flex';
        }
    }

    // 隐藏加载指示器
    hideLoading() {
        if (this.loadingElement) {
            this.loadingElement.style.display = 'none';
        }
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

    // 显示确认对话框
    showConfirm(message, title = '确认', onConfirm = null, onCancel = null) {
        return new Promise((resolve) => {
            const overlay = document.createElement('div');
            overlay.className = 'modal show';
            overlay.innerHTML = `
                <div class="modal-content" style="max-width: 400px;">
                    <div class="modal-header">
                        <h3>${title}</h3>
                    </div>
                    <div class="modal-body">
                        <p style="margin: 0; line-height: 1.6;">${message}</p>
                    </div>
                    <div class="modal-footer">
                        <button type="button" class="btn btn-secondary" id="confirmCancel">取消</button>
                        <button type="button" class="btn btn-primary" id="confirmOk">确认</button>
                    </div>
                </div>
            `;
            
            document.body.appendChild(overlay);
            document.body.style.overflow = 'hidden';
            
            const handleClose = (result) => {
                document.body.removeChild(overlay);
                document.body.style.overflow = '';
                resolve(result);
                
                if (result && onConfirm) {
                    onConfirm();
                } else if (!result && onCancel) {
                    onCancel();
                }
            };
            
            overlay.querySelector('#confirmOk').addEventListener('click', () => handleClose(true));
            overlay.querySelector('#confirmCancel').addEventListener('click', () => handleClose(false));
            overlay.addEventListener('click', (e) => {
                if (e.target === overlay) {
                    handleClose(false);
                }
            });
            
            // 聚焦确认按钮
            setTimeout(() => overlay.querySelector('#confirmOk').focus(), 100);
        });
    }

    // 格式化日期
    formatDate(dateString) {
        if (!dateString) {
            return '未知时间';
        }

        const date = new Date(dateString);

        // 检查日期是否有效
        if (isNaN(date.getTime())) {
            console.warn('Invalid date string:', dateString);
            return '无效日期';
        }

        const now = new Date();
        const diff = now - date;

        // 小于1分钟
        if (diff < 60000) {
            return '刚刚';
        }

        // 小于1小时
        if (diff < 3600000) {
            return `${Math.floor(diff / 60000)}分钟前`;
        }

        // 小于1天
        if (diff < 86400000) {
            return `${Math.floor(diff / 3600000)}小时前`;
        }

        // 小于7天
        if (diff < 604800000) {
            return `${Math.floor(diff / 86400000)}天前`;
        }

        // 超过7天显示具体日期
        try {
            return date.toLocaleDateString('zh-CN', {
                year: 'numeric',
                month: 'short',
                day: 'numeric'
            });
        } catch (error) {
            console.warn('Date formatting error:', error);
            return date.toISOString().split('T')[0]; // 备用格式
        }
    }

    // 格式化文件大小
    formatFileSize(bytes) {
        if (bytes === 0) return '0 B';
        
        const k = 1024;
        const sizes = ['B', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    }

    // 截断文本
    truncateText(text, maxLength = 100) {
        if (text.length <= maxLength) {
            return text;
        }
        return text.substring(0, maxLength) + '...';
    }

    // 高亮搜索关键词
    highlightText(text, keyword) {
        if (!keyword) return text;
        
        const regex = new RegExp(`(${keyword})`, 'gi');
        return text.replace(regex, '<mark>$1</mark>');
    }

    // 防抖函数
    debounce(func, wait) {
        let timeout;
        return function executedFunction(...args) {
            const later = () => {
                clearTimeout(timeout);
                func(...args);
            };
            clearTimeout(timeout);
            timeout = setTimeout(later, wait);
        };
    }

    // 节流函数
    throttle(func, limit) {
        let inThrottle;
        return function() {
            const args = arguments;
            const context = this;
            if (!inThrottle) {
                func.apply(context, args);
                inThrottle = true;
                setTimeout(() => inThrottle = false, limit);
            }
        };
    }

    // 复制到剪贴板
    async copyToClipboard(text) {
        try {
            await navigator.clipboard.writeText(text);
            this.showToast('已复制到剪贴板', 'success');
            return true;
        } catch (err) {
            console.error('复制失败:', err);
            this.showToast('复制失败', 'error');
            return false;
        }
    }

    // 下载文件
    downloadFile(content, filename, contentType = 'text/plain') {
        const blob = new Blob([content], { type: contentType });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = filename;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
    }

    // 图片预览
    previewImage(file, previewElement) {
        if (file && file.type.startsWith('image/')) {
            const reader = new FileReader();
            reader.onload = (e) => {
                previewElement.src = e.target.result;
                previewElement.parentElement.style.display = 'block';
            };
            reader.readAsDataURL(file);
        }
    }

    // 清除图片预览
    clearImagePreview(previewElement) {
        previewElement.src = '';
        previewElement.parentElement.style.display = 'none';
    }
}

// 创建全局UI实例
window.ui = new UI();

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

// 导出UI类（如果使用模块系统）
if (typeof module !== 'undefined' && module.exports) {
    module.exports = UI;
}
