// 截图选择器模块
// 提供区域选择和截图功能

class ScreenshotSelector {
    constructor() {
        this.isSelecting = false;
        this.startX = 0;
        this.startY = 0;
        this.endX = 0;
        this.endY = 0;
        this.overlay = null;
        this.selectionBox = null;
        this.toolbar = null;
    }

    // 开始截图选择
    async startSelection() {
        return new Promise((resolve, reject) => {
            try {
                this.createOverlay();
                this.setupEventListeners(resolve, reject);
            } catch (error) {
                reject(error);
            }
        });
    }

    // 创建遮罩层
    createOverlay() {
        // 创建半透明遮罩
        this.overlay = document.createElement('div');
        this.overlay.id = 'screenshot-overlay';
        this.overlay.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            width: 100vw;
            height: 100vh;
            background: rgba(0, 0, 0, 0.4);
            z-index: 999999;
            cursor: crosshair;
            user-select: none;
        `;

        // 创建选择框
        this.selectionBox = document.createElement('div');
        this.selectionBox.id = 'screenshot-selection';
        this.selectionBox.style.cssText = `
            position: fixed;
            border: 2px solid #4CAF50;
            background: rgba(76, 175, 80, 0.1);
            z-index: 1000000;
            display: none;
            pointer-events: none;
        `;

        // 创建工具栏
        this.toolbar = document.createElement('div');
        this.toolbar.id = 'screenshot-toolbar';
        this.toolbar.style.cssText = `
            position: fixed;
            background: white;
            border-radius: 8px;
            padding: 10px;
            box-shadow: 0 2px 10px rgba(0,0,0,0.2);
            z-index: 1000001;
            display: none;
            gap: 10px;
            align-items: center;
        `;

        // 添加工具栏按钮
        this.toolbar.innerHTML = `
            <button id="save-screenshot" style="
                padding: 8px 16px;
                background: #4CAF50;
                color: white;
                border: none;
                border-radius: 4px;
                cursor: pointer;
                font-size: 14px;
            ">💾 保存图片</button>
            <button id="cancel-screenshot" style="
                padding: 8px 16px;
                background: #f44336;
                color: white;
                border: none;
                border-radius: 4px;
                cursor: pointer;
                font-size: 14px;
            ">❌ 取消</button>
        `;

        document.body.appendChild(this.overlay);
        document.body.appendChild(this.selectionBox);
        document.body.appendChild(this.toolbar);
    }

    // 设置事件监听器
    setupEventListeners(resolve, reject) {
        // 鼠标按下
        const handleMouseDown = (e) => {
            this.isSelecting = true;
            this.startX = e.clientX;
            this.startY = e.clientY;
            this.selectionBox.style.display = 'block';
            this.updateSelection(e.clientX, e.clientY);
        };

        // 鼠标移动
        const handleMouseMove = (e) => {
            if (!this.isSelecting) return;
            this.updateSelection(e.clientX, e.clientY);
        };

        // 鼠标释放
        const handleMouseUp = (e) => {
            if (!this.isSelecting) return;
            this.isSelecting = false;
            this.endX = e.clientX;
            this.endY = e.clientY;

            // 显示工具栏
            const rect = this.getSelectionRect();
            if (rect.width > 10 && rect.height > 10) {
                this.showToolbar(rect);
            } else {
                // 如果选择区域太小，重新开始
                this.selectionBox.style.display = 'none';
            }
        };

        // 键盘事件
        const handleKeyDown = (e) => {
            if (e.key === 'Escape') {
                this.cleanup();
                reject(new Error('用户取消截图'));
            }
        };

        // 工具栏按钮事件
        const handleSaveClick = () => {
            const rect = this.getSelectionRect();
            this.cleanup();
            resolve({
                action: 'save',
                rect: rect
            });
        };


        const handleCancelClick = () => {
            this.cleanup();
            reject(new Error('用户取消截图'));
        };

        // 绑定事件
        this.overlay.addEventListener('mousedown', handleMouseDown);
        document.addEventListener('mousemove', handleMouseMove);
        document.addEventListener('mouseup', handleMouseUp);
        document.addEventListener('keydown', handleKeyDown);

        // 工具栏按钮事件
        setTimeout(() => {
            document.getElementById('save-screenshot')?.addEventListener('click', handleSaveClick);
            document.getElementById('cancel-screenshot')?.addEventListener('click', handleCancelClick);
        }, 100);

        // 保存清理函数
        this.cleanupHandlers = () => {
            this.overlay.removeEventListener('mousedown', handleMouseDown);
            document.removeEventListener('mousemove', handleMouseMove);
            document.removeEventListener('mouseup', handleMouseUp);
            document.removeEventListener('keydown', handleKeyDown);
        };
    }

    // 更新选择框
    updateSelection(currentX, currentY) {
        const left = Math.min(this.startX, currentX);
        const top = Math.min(this.startY, currentY);
        const width = Math.abs(currentX - this.startX);
        const height = Math.abs(currentY - this.startY);

        this.selectionBox.style.left = `${left}px`;
        this.selectionBox.style.top = `${top}px`;
        this.selectionBox.style.width = `${width}px`;
        this.selectionBox.style.height = `${height}px`;
    }

    // 获取选择区域
    getSelectionRect() {
        const left = Math.min(this.startX, this.endX);
        const top = Math.min(this.startY, this.endY);
        const width = Math.abs(this.endX - this.startX);
        const height = Math.abs(this.endY - this.startY);

        // 转换为页面坐标（考虑滚动）
        return {
            left: left + window.scrollX,
            top: top + window.scrollY,
            width: width,
            height: height,
            // 视口坐标（用于截图）
            viewportLeft: left,
            viewportTop: top
        };
    }

    // 显示工具栏
    showToolbar(rect) {
        this.toolbar.style.display = 'flex';
        
        // 计算工具栏位置（在选择框下方）
        let toolbarTop = rect.viewportTop + rect.height + 10;
        let toolbarLeft = rect.viewportLeft + (rect.width / 2) - 150; // 假设工具栏宽度约300px

        // 确保工具栏在视口内
        if (toolbarTop + 60 > window.innerHeight) {
            toolbarTop = rect.viewportTop - 60;
        }
        if (toolbarLeft < 10) {
            toolbarLeft = 10;
        }
        if (toolbarLeft + 300 > window.innerWidth) {
            toolbarLeft = window.innerWidth - 310;
        }

        this.toolbar.style.top = `${toolbarTop}px`;
        this.toolbar.style.left = `${toolbarLeft}px`;
    }

    // 清理
    cleanup() {
        if (this.cleanupHandlers) {
            this.cleanupHandlers();
        }
        if (this.overlay) {
            this.overlay.remove();
        }
        if (this.selectionBox) {
            this.selectionBox.remove();
        }
        if (this.toolbar) {
            this.toolbar.remove();
        }
    }
}

// 导出给content script使用
if (typeof window !== 'undefined') {
    window.ScreenshotSelector = ScreenshotSelector;
}