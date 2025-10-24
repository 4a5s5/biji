// Smart Note Collector - Mobile JavaScript
// 移动端专用功能和交互

class MobileInterface {
    constructor() {
        this.isMobile = this.detectMobile();
        this.touchStartY = 0;
        this.touchStartX = 0;
        this.isScrolling = false;
        
        if (this.isMobile) {
            this.init();
        }
    }
    
    // 检测是否为移动设备
    detectMobile() {
        return window.innerWidth <= 768 || /Android|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
    }
    
    // 初始化移动端功能
    init() {
        console.log('Initializing mobile interface...');
        
        this.setupViewport();
        this.setupTouchEvents();
        this.setupSwipeGestures();
        this.setupPullToRefresh();
        this.setupFAB();
        this.setupMobileNavigation();
        this.optimizeScrolling();
        this.handleOrientationChange();
        
        // 添加移动端样式类
        document.body.classList.add('mobile-interface');
    }
    
    // 设置视口
    setupViewport() {
        let viewport = document.querySelector('meta[name="viewport"]');
        if (!viewport) {
            viewport = document.createElement('meta');
            viewport.name = 'viewport';
            document.head.appendChild(viewport);
        }
        viewport.content = 'width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no';
    }
    
    // 设置触摸事件
    setupTouchEvents() {
        // 防止双击缩放
        let lastTouchEnd = 0;
        document.addEventListener('touchend', (e) => {
            const now = (new Date()).getTime();
            if (now - lastTouchEnd <= 300) {
                e.preventDefault();
            }
            lastTouchEnd = now;
        }, false);
        
        // 长按事件
        this.setupLongPress();
    }
    
    // 设置长按事件
    setupLongPress() {
        let pressTimer;
        
        document.addEventListener('touchstart', (e) => {
            const target = e.target.closest('.note-card');
            if (!target) return;
            
            pressTimer = setTimeout(() => {
                this.handleLongPress(target, e);
            }, 500);
        });
        
        document.addEventListener('touchend', () => {
            clearTimeout(pressTimer);
        });
        
        document.addEventListener('touchmove', () => {
            clearTimeout(pressTimer);
        });
    }
    
    // 处理长按事件
    handleLongPress(element, event) {
        event.preventDefault();
        
        // 添加触觉反馈
        if (navigator.vibrate) {
            navigator.vibrate(50);
        }
        
        // 显示上下文菜单
        this.showContextMenu(element, event);
    }
    
    // 显示上下文菜单
    showContextMenu(noteCard, event) {
        const noteId = noteCard.dataset.noteId;
        if (!noteId) return;
        
        const contextMenu = document.createElement('div');
        contextMenu.className = 'mobile-context-menu';
        contextMenu.innerHTML = `
            <div class="context-menu-backdrop"></div>
            <div class="context-menu-content">
                <div class="context-menu-header">
                    <h4>笔记操作</h4>
                    <button class="context-menu-close">&times;</button>
                </div>
                <div class="context-menu-actions">
                    <button class="context-action" data-action="edit" data-note-id="${noteId}">
                        <span class="action-icon">✏️</span>
                        <span class="action-text">编辑</span>
                    </button>
                    <button class="context-action" data-action="share" data-note-id="${noteId}">
                        <span class="action-icon">📤</span>
                        <span class="action-text">分享</span>
                    </button>
                    <button class="context-action" data-action="copy" data-note-id="${noteId}">
                        <span class="action-icon">📋</span>
                        <span class="action-text">复制</span>
                    </button>
                    <button class="context-action danger" data-action="delete" data-note-id="${noteId}">
                        <span class="action-icon">🗑️</span>
                        <span class="action-text">删除</span>
                    </button>
                </div>
            </div>
        `;
        
        document.body.appendChild(contextMenu);
        
        // 添加事件监听
        contextMenu.querySelector('.context-menu-backdrop').addEventListener('click', () => {
            this.hideContextMenu(contextMenu);
        });
        
        contextMenu.querySelector('.context-menu-close').addEventListener('click', () => {
            this.hideContextMenu(contextMenu);
        });
        
        contextMenu.querySelectorAll('.context-action').forEach(button => {
            button.addEventListener('click', (e) => {
                const action = e.currentTarget.dataset.action;
                const noteId = e.currentTarget.dataset.noteId;
                this.handleContextAction(action, noteId);
                this.hideContextMenu(contextMenu);
            });
        });
        
        // 显示动画
        setTimeout(() => {
            contextMenu.classList.add('show');
        }, 10);
    }
    
    // 隐藏上下文菜单
    hideContextMenu(contextMenu) {
        contextMenu.classList.remove('show');
        setTimeout(() => {
            if (contextMenu.parentNode) {
                contextMenu.parentNode.removeChild(contextMenu);
            }
        }, 300);
    }
    
    // 处理上下文操作
    handleContextAction(action, noteId) {
        switch (action) {
            case 'edit':
                this.editNote(noteId);
                break;
            case 'share':
                this.shareNote(noteId);
                break;
            case 'copy':
                this.copyNote(noteId);
                break;
            case 'delete':
                this.deleteNote(noteId);
                break;
        }
    }
    
    // 设置滑动手势
    setupSwipeGestures() {
        let startX, startY, distX, distY;
        
        document.addEventListener('touchstart', (e) => {
            const touch = e.touches[0];
            startX = touch.clientX;
            startY = touch.clientY;
        });
        
        document.addEventListener('touchmove', (e) => {
            if (!startX || !startY) return;
            
            const touch = e.touches[0];
            distX = touch.clientX - startX;
            distY = touch.clientY - startY;
            
            // 判断是否为水平滑动
            if (Math.abs(distX) > Math.abs(distY) && Math.abs(distX) > 50) {
                const target = e.target.closest('.note-card');
                if (target) {
                    this.handleSwipe(target, distX > 0 ? 'right' : 'left');
                }
            }
        });
        
        document.addEventListener('touchend', () => {
            startX = startY = null;
        });
    }
    
    // 处理滑动
    handleSwipe(element, direction) {
        if (direction === 'left') {
            // 左滑显示删除按钮
            this.showSwipeActions(element);
        } else if (direction === 'right') {
            // 右滑隐藏操作按钮
            this.hideSwipeActions(element);
        }
    }
    
    // 显示滑动操作
    showSwipeActions(noteCard) {
        // 隐藏其他卡片的操作
        document.querySelectorAll('.note-card.swiped').forEach(card => {
            if (card !== noteCard) {
                this.hideSwipeActions(card);
            }
        });
        
        noteCard.classList.add('swiped');
        
        if (!noteCard.querySelector('.swipe-actions')) {
            const actions = document.createElement('div');
            actions.className = 'swipe-actions';
            actions.innerHTML = `
                <button class="swipe-action edit" data-action="edit">✏️</button>
                <button class="swipe-action delete" data-action="delete">🗑️</button>
            `;
            noteCard.appendChild(actions);
            
            // 添加事件监听
            actions.querySelectorAll('.swipe-action').forEach(button => {
                button.addEventListener('click', (e) => {
                    e.stopPropagation();
                    const action = e.currentTarget.dataset.action;
                    const noteId = noteCard.dataset.noteId;
                    this.handleContextAction(action, noteId);
                    this.hideSwipeActions(noteCard);
                });
            });
        }
    }
    
    // 隐藏滑动操作
    hideSwipeActions(noteCard) {
        noteCard.classList.remove('swiped');
        const actions = noteCard.querySelector('.swipe-actions');
        if (actions) {
            setTimeout(() => {
                if (actions.parentNode) {
                    actions.parentNode.removeChild(actions);
                }
            }, 300);
        }
    }
    
    // 设置下拉刷新
    setupPullToRefresh() {
        let startY = 0;
        let currentY = 0;
        let isPulling = false;
        
        const refreshIndicator = document.createElement('div');
        refreshIndicator.className = 'pull-refresh-indicator';
        refreshIndicator.innerHTML = '<div class="refresh-spinner"></div><span>下拉刷新</span>';
        document.body.insertBefore(refreshIndicator, document.body.firstChild);
        
        document.addEventListener('touchstart', (e) => {
            if (window.scrollY === 0) {
                startY = e.touches[0].clientY;
            }
        });
        
        document.addEventListener('touchmove', (e) => {
            if (startY === 0) return;
            
            currentY = e.touches[0].clientY;
            const pullDistance = currentY - startY;
            
            if (pullDistance > 0 && window.scrollY === 0) {
                isPulling = true;
                e.preventDefault();
                
                const progress = Math.min(pullDistance / 100, 1);
                refreshIndicator.style.transform = `translateY(${pullDistance * 0.5}px)`;
                refreshIndicator.style.opacity = progress;
                
                if (pullDistance > 80) {
                    refreshIndicator.classList.add('ready');
                    refreshIndicator.querySelector('span').textContent = '释放刷新';
                } else {
                    refreshIndicator.classList.remove('ready');
                    refreshIndicator.querySelector('span').textContent = '下拉刷新';
                }
            }
        });
        
        document.addEventListener('touchend', () => {
            if (isPulling) {
                const pullDistance = currentY - startY;
                
                if (pullDistance > 80) {
                    this.performRefresh(refreshIndicator);
                } else {
                    this.resetRefreshIndicator(refreshIndicator);
                }
                
                isPulling = false;
                startY = 0;
            }
        });
    }
    
    // 执行刷新
    performRefresh(indicator) {
        indicator.classList.add('refreshing');
        indicator.querySelector('span').textContent = '刷新中...';
        
        // 模拟刷新操作
        setTimeout(() => {
            // 这里应该调用实际的刷新函数
            if (window.loadNotes) {
                window.loadNotes();
            }
            
            this.resetRefreshIndicator(indicator);
        }, 1500);
    }
    
    // 重置刷新指示器
    resetRefreshIndicator(indicator) {
        indicator.classList.remove('ready', 'refreshing');
        indicator.style.transform = 'translateY(-100%)';
        indicator.style.opacity = '0';
        indicator.querySelector('span').textContent = '下拉刷新';
    }
    
    // 设置浮动操作按钮
    setupFAB() {
        const fab = document.createElement('button');
        fab.className = 'fab';
        fab.innerHTML = '+';
        fab.title = '添加笔记';
        
        fab.addEventListener('click', () => {
            // 触发添加笔记功能
            if (window.noteManager) {
                window.noteManager.showNoteModal();
            }
        });
        
        document.body.appendChild(fab);
        
        // 滚动时隐藏/显示FAB
        let lastScrollY = window.scrollY;
        window.addEventListener('scroll', () => {
            const currentScrollY = window.scrollY;
            
            if (currentScrollY > lastScrollY && currentScrollY > 100) {
                fab.style.transform = 'translateY(100px)';
            } else {
                fab.style.transform = 'translateY(0)';
            }
            
            lastScrollY = currentScrollY;
        });
    }
    
    // 设置移动端导航
    setupMobileNavigation() {
        // 添加汉堡菜单按钮
        const header = document.querySelector('.header');
        if (header && !header.querySelector('.mobile-menu-toggle')) {
            const menuToggle = document.createElement('button');
            menuToggle.className = 'mobile-menu-toggle';
            menuToggle.innerHTML = '☰';
            menuToggle.addEventListener('click', () => {
                this.toggleMobileMenu();
            });
            
            header.appendChild(menuToggle);
        }
    }
    
    // 切换移动端菜单
    toggleMobileMenu() {
        const nav = document.querySelector('.nav-tabs');
        if (nav) {
            nav.classList.toggle('mobile-menu-open');
        }
    }
    
    // 优化滚动
    optimizeScrolling() {
        // 启用平滑滚动
        document.documentElement.style.scrollBehavior = 'smooth';
        
        // 优化iOS滚动
        document.body.style.webkitOverflowScrolling = 'touch';
    }
    
    // 处理屏幕方向变化
    handleOrientationChange() {
        window.addEventListener('orientationchange', () => {
            // 延迟执行以确保视口已更新
            setTimeout(() => {
                this.adjustLayoutForOrientation();
            }, 100);
        });
    }
    
    // 调整布局适应屏幕方向
    adjustLayoutForOrientation() {
        const isLandscape = window.innerWidth > window.innerHeight;
        document.body.classList.toggle('landscape', isLandscape);
        document.body.classList.toggle('portrait', !isLandscape);
    }
    
    // 编辑笔记
    editNote(noteId) {
        if (window.editNote) {
            window.editNote(noteId);
        }
    }
    
    // 分享笔记
    shareNote(noteId) {
        if (navigator.share) {
            // 使用原生分享API
            const note = this.getNoteById(noteId);
            if (note) {
                navigator.share({
                    title: note.title,
                    text: note.content,
                    url: window.location.href
                });
            }
        } else {
            // 降级到复制链接
            this.copyNote(noteId);
        }
    }
    
    // 复制笔记
    copyNote(noteId) {
        const note = this.getNoteById(noteId);
        if (note && navigator.clipboard) {
            navigator.clipboard.writeText(`${note.title}\n\n${note.content}`).then(() => {
                this.showToast('笔记已复制到剪贴板');
            });
        }
    }
    
    // 删除笔记
    deleteNote(noteId) {
        if (confirm('确定要删除这条笔记吗？')) {
            if (window.deleteNote) {
                window.deleteNote(noteId);
            }
        }
    }
    
    // 获取笔记数据
    getNoteById(noteId) {
        // 这里应该从全局状态或API获取笔记数据
        const noteCard = document.querySelector(`[data-note-id="${noteId}"]`);
        if (noteCard) {
            return {
                id: noteId,
                title: noteCard.querySelector('.note-title')?.textContent || '',
                content: noteCard.querySelector('.note-content')?.textContent || ''
            };
        }
        return null;
    }
    
    // 显示Toast消息
    showToast(message, duration = 3000) {
        const toast = document.createElement('div');
        toast.className = 'mobile-toast';
        toast.textContent = message;
        
        document.body.appendChild(toast);
        
        setTimeout(() => {
            toast.classList.add('show');
        }, 10);
        
        setTimeout(() => {
            toast.classList.remove('show');
            setTimeout(() => {
                if (toast.parentNode) {
                    toast.parentNode.removeChild(toast);
                }
            }, 300);
        }, duration);
    }
}

// 初始化移动端界面
document.addEventListener('DOMContentLoaded', () => {
    window.mobileInterface = new MobileInterface();
});

// 导出供其他模块使用
window.MobileInterface = MobileInterface;
