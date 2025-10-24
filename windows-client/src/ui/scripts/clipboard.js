// Smart Note Collector - 剪切板监听状态管理
// ipcRenderer 已在 dialogs.js 中声明

// 剪切板管理类
class ClipboardUIManager {
    constructor() {
        this.isEnabled = true;
        this.todayCount = 0;
        this.totalCount = 0;
        this.lastUpdateTime = null;
    }

    // 初始化
    init() {
        this.bindEvents();
        this.loadClipboardStats();
        this.startStatsTimer();
    }

    // 绑定事件
    bindEvents() {
        // 剪切板开关在 main.js 中处理
    }

    // 加载剪切板统计
    async loadClipboardStats() {
        try {
            const stats = await window.ipcRenderer.invoke('get-clipboard-stats');
            if (stats) {
                this.todayCount = stats.todayCount || 0;
                this.totalCount = stats.totalCount || 0;
                this.lastUpdateTime = stats.lastUpdateTime || null;
            }

            this.updateStatsDisplay();
        } catch (error) {
            console.error('加载剪切板统计失败:', error);
        }
    }

    // 更新统计显示
    updateStatsDisplay() {
        const todayCountElement = document.getElementById('todayCount');
        const totalClipboardCountElement = document.getElementById('totalClipboardCount');

        if (todayCountElement) {
            todayCountElement.textContent = this.todayCount;
        }

        if (totalClipboardCountElement) {
            totalClipboardCountElement.textContent = this.totalCount;
        }
    }

    // 启动统计定时器
    startStatsTimer() {
        // 每分钟更新一次统计
        setInterval(() => {
            this.loadClipboardStats();
        }, 60000);
    }

    // 增加今日计数
    incrementTodayCount() {
        this.todayCount++;
        this.totalCount++;
        this.updateStatsDisplay();
    }

    // 切换剪切板监听状态
    async toggleClipboardMonitoring(enabled) {
        try {
            const success = await window.ipcRenderer.invoke('update-app-config', {
                enableClipboardMonitor: enabled
            });

            if (success) {
                this.isEnabled = enabled;
                this.updateToggleUI(enabled);

                showNotification(
                    '剪切板监听',
                    enabled ? '已启用剪切板监听' : '已禁用剪切板监听',
                    'success'
                );
            } else {
                // 如果失败，恢复开关状态
                this.updateToggleUI(!enabled);
                showNotification('设置失败', '无法更改剪切板监听状态', 'error');
            }
        } catch (error) {
            console.error('切换剪切板监听失败:', error);
            // 恢复开关状态
            this.updateToggleUI(!enabled);
            showNotification('设置失败', error.message, 'error');
        }
    }

    // 更新开关UI状态
    updateToggleUI(enabled) {
        const toggle = document.getElementById('clipboardToggle');
        if (toggle) {
            toggle.checked = enabled;
        }
    }

    // 获取剪切板监听状态
    isClipboardMonitoringEnabled() {
        return this.isEnabled;
    }

    // 显示剪切板使用提示
    showClipboardTip() {
        const tipHtml = `
            <div style="padding: 16px; max-width: 400px;">
                <h4 style="margin-bottom: 12px; color: #333;">💡 剪切板监听使用提示</h4>
                <ul style="margin: 0; padding-left: 20px; line-height: 1.6; color: #666;">
                    <li>复制任何文字或图片后，右下角会自动弹出通知</li>
                    <li>通知会在15秒后自动消失，不影响您的工作</li>
                    <li>点击"保存"可将内容保存为笔记</li>
                    <li>点击"忽略"或等待超时会关闭通知</li>
                    <li>可在设置中调整通知显示时间</li>
                    <li>可随时通过托盘菜单或设置页面开启/关闭</li>
                </ul>
                <div style="margin-top: 16px; text-align: center;">
                    <button onclick="this.closest('.modal-overlay').style.display='none'"
                            style="padding: 8px 16px; background: #667eea; color: white; border: none; border-radius: 4px; cursor: pointer;">
                        我知道了
                    </button>
                </div>
            </div>
        `;

        this.showModal('剪切板监听使用提示', tipHtml);
    }

    // 显示模态框
    showModal(title, content) {
        const overlay = document.getElementById('modalOverlay');
        const modalContent = document.getElementById('modalContent');

        if (overlay && modalContent) {
            modalContent.innerHTML = `
                <div style="padding: 0;">
                    <div style="padding: 16px 20px; border-bottom: 1px solid #e9ecef; background: #f8f9fa;">
                        <h3 style="margin: 0; color: #333;">${title}</h3>
                    </div>
                    ${content}
                </div>
            `;

            overlay.style.display = 'flex';

            // 点击遮罩层关闭
            overlay.onclick = (e) => {
                if (e.target === overlay) {
                    overlay.style.display = 'none';
                }
            };
        }
    }

    // 清除今日统计
    async clearTodayStats() {
        const confirmed = confirm('确定要清除今日剪切板收集统计吗？');
        if (!confirmed) return;

        try {
            await window.ipcRenderer.invoke('clear-today-clipboard-stats');
            this.todayCount = 0;
            this.updateStatsDisplay();
            showNotification('清除成功', '今日统计已清除', 'success');
        } catch (error) {
            console.error('清除统计失败:', error);
            showNotification('清除失败', error.message, 'error');
        }
    }

    // 清除所有统计
    async clearAllStats() {
        const confirmed = confirm('确定要清除所有剪切板收集统计吗？\n\n注意：这不会删除笔记，只会清除统计数据。');
        if (!confirmed) return;

        try {
            await window.ipcRenderer.invoke('clear-all-clipboard-stats');
            this.todayCount = 0;
            this.totalCount = 0;
            this.updateStatsDisplay();
            showNotification('清除成功', '所有统计已清除', 'success');
        } catch (error) {
            console.error('清除统计失败:', error);
            showNotification('清除失败', error.message, 'error');
        }
    }

    // 导出剪切板笔记
    async exportClipboardNotes() {
        try {
            updateOperationStatus('导出剪切板笔记中...');

            const result = await window.ipcRenderer.invoke('export-clipboard-notes');

            if (result && result.success) {
                updateOperationStatus('就绪');
                showNotification('导出成功', `已导出 ${result.count} 条剪切板笔记`, 'success');
            } else {
                updateOperationStatus('导出失败');
                showNotification('导出失败', result?.error || '未知错误', 'error');
            }
        } catch (error) {
            console.error('导出剪切板笔记失败:', error);
            updateOperationStatus('导出失败');
            showNotification('导出失败', error.message, 'error');
        }
    }

    // 获取剪切板使用建议
    getUsageTips() {
        return [
            {
                title: '文字收集技巧',
                tip: '复制网页文章段落、聊天记录、代码片段等，自动保存为笔记'
            },
            {
                title: '图片收集技巧',
                tip: '截图、复制图片或表情包，自动上传并保存为图片笔记'
            },
            {
                title: '工作流优化',
                tip: '浏览网页时复制有用信息，稍后在笔记中统一整理和编辑'
            },
            {
                title: '隐私保护',
                tip: '敏感信息建议手动创建笔记，或临时关闭剪切板监听'
            },
            {
                title: '性能优化',
                tip: '大量复制操作时可临时关闭监听，避免过多通知'
            }
        ];
    }

    // 显示使用建议
    showUsageTips() {
        const tips = this.getUsageTips();
        const tipsHtml = `
            <div style="padding: 16px; max-width: 500px;">
                <h4 style="margin-bottom: 16px; color: #333;">💡 剪切板使用建议</h4>
                <div style="max-height: 300px; overflow-y: auto;">
                    ${tips.map(tip => `
                        <div style="margin-bottom: 16px; padding: 12px; background: #f8f9fa; border-radius: 6px;">
                            <div style="font-weight: 600; color: #667eea; margin-bottom: 4px;">${tip.title}</div>
                            <div style="font-size: 14px; color: #666; line-height: 1.5;">${tip.tip}</div>
                        </div>
                    `).join('')}
                </div>
                <div style="margin-top: 16px; text-align: center;">
                    <button onclick="this.closest('.modal-overlay').style.display='none'"
                            style="padding: 8px 16px; background: #667eea; color: white; border: none; border-radius: 4px; cursor: pointer;">
                        关闭
                    </button>
                </div>
            </div>
        `;

        this.showModal('剪切板使用建议', tipsHtml);
    }

    // 刷新统计
    async refresh() {
        await this.loadClipboardStats();
    }
}

// 创建全局剪切板UI管理器实例
const clipboardUIManager = new ClipboardUIManager();

// 页面加载完成后初始化
document.addEventListener('DOMContentLoaded', () => {
    clipboardUIManager.init();

    // 监听来自主进程的剪切板相关事件
    if (window.ipcRenderer) {
        window.ipcRenderer.on('clipboard-item-saved', () => {
            clipboardUIManager.incrementTodayCount();
        });

        window.ipcRenderer.on('clipboard-monitoring-changed', (event, enabled) => {
            clipboardUIManager.updateToggleUI(enabled);
        });
    } else {
        console.warn('clipboard.js: window.ipcRenderer 不可用，跳过IPC事件监听器设置');
    }
});

// 添加剪切板相关的右键菜单
document.addEventListener('contextmenu', (e) => {
    const clipboardSection = e.target.closest('.clipboard-status');
    if (clipboardSection) {
        e.preventDefault();
        showClipboardContextMenu(e.clientX, e.clientY);
    }
});

// 显示剪切板右键菜单
function showClipboardContextMenu(x, y) {
    // 移除现有菜单
    const existingMenu = document.getElementById('clipboardContextMenu');
    if (existingMenu) {
        existingMenu.remove();
    }

    const menu = document.createElement('div');
    menu.id = 'clipboardContextMenu';
    menu.style.cssText = `
        position: fixed;
        top: ${y}px;
        left: ${x}px;
        background: white;
        border: 1px solid #e9ecef;
        border-radius: 6px;
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
        z-index: 1000;
        min-width: 150px;
        overflow: hidden;
    `;

    menu.innerHTML = `
        <div class="context-menu-item" onclick="clipboardUIManager.showClipboardTip()">
            <span>💡 使用提示</span>
        </div>
        <div class="context-menu-item" onclick="clipboardUIManager.showUsageTips()">
            <span>📖 使用建议</span>
        </div>
        <div class="context-menu-item" onclick="clipboardUIManager.exportClipboardNotes()">
            <span>📤 导出笔记</span>
        </div>
        <div class="context-menu-separator" style="height: 1px; background: #e9ecef; margin: 4px 0;"></div>
        <div class="context-menu-item" onclick="clipboardUIManager.clearTodayStats()">
            <span>🗑️ 清除今日</span>
        </div>
        <div class="context-menu-item" onclick="clipboardUIManager.clearAllStats()">
            <span>🗑️ 清除全部</span>
        </div>
    `;

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

console.log('剪切板UI管理模块加载完成');