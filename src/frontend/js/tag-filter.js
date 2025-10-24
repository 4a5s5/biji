// 标签筛选管理器
class TagFilterManager {
    constructor() {
        this.selectedTags = new Set();
        this.allTags = new Map(); // tag -> count
        this.isDropdownOpen = false;
        
        this.display = document.getElementById('tagFilterDisplay');
        this.dropdown = document.getElementById('tagFilterDropdown');
        this.options = document.getElementById('tagFilterOptions');
        this.searchInput = document.getElementById('tagSearchInput');
        this.clearBtn = document.getElementById('clearTagFilter');
        this.applyBtn = document.getElementById('applyTagFilter');
        
        this.initializeEventListeners();
        this.loadAllTags();
    }
    
    // 初始化事件监听器
    initializeEventListeners() {
        // 显示/隐藏下拉框
        this.display.addEventListener('click', (e) => {
            e.stopPropagation();
            this.toggleDropdown();
        });
        
        // 点击外部关闭下拉框
        document.addEventListener('click', (e) => {
            if (!e.target.closest('.multi-select-wrapper')) {
                this.closeDropdown();
            }
        });
        
        // 搜索标签
        this.searchInput.addEventListener('input', (e) => {
            this.filterTagOptions(e.target.value);
        });
        
        // 清空选择
        this.clearBtn.addEventListener('click', () => {
            this.clearSelection();
        });
        
        // 应用筛选
        this.applyBtn.addEventListener('click', () => {
            this.applyFilter();
        });
        
        // 阻止下拉框内部点击事件冒泡
        this.dropdown.addEventListener('click', (e) => {
            e.stopPropagation();
        });
    }
    
    // 加载所有标签
    async loadAllTags() {
        try {
            // 获取所有笔记来统计标签
            const response = await api.notes.getAll({ limit: 1000 }); // 获取足够多的笔记来统计标签
            const notes = response.notes || [];
            
            // 统计标签使用次数
            const tagCounts = new Map();
            notes.forEach(note => {
                if (note.tags && Array.isArray(note.tags)) {
                    note.tags.forEach(tag => {
                        if (tag && tag.trim()) {
                            const normalizedTag = tag.trim();
                            tagCounts.set(normalizedTag, (tagCounts.get(normalizedTag) || 0) + 1);
                        }
                    });
                }
            });
            
            this.allTags = tagCounts;
            this.renderTagOptions();
            
        } catch (error) {
            console.error('加载标签失败:', error);
            ui.showToast('加载标签失败', 'error');
        }
    }
    
    // 渲染标签选项
    renderTagOptions(searchTerm = '') {
        if (!this.options) return;
        
        // 过滤标签
        const filteredTags = Array.from(this.allTags.entries())
            .filter(([tag, count]) => 
                searchTerm === '' || tag.toLowerCase().includes(searchTerm.toLowerCase())
            )
            .sort((a, b) => {
                // 按使用次数降序排列
                if (b[1] !== a[1]) return b[1] - a[1];
                // 使用次数相同时按字母顺序
                return a[0].localeCompare(b[0]);
            });
        
        if (filteredTags.length === 0) {
            this.options.innerHTML = '<div class="no-tags">没有找到标签</div>';
            return;
        }
        
        this.options.innerHTML = filteredTags.map(([tag, count]) => {
            const isSelected = this.selectedTags.has(tag);
            return `
                <div class="multi-select-option ${isSelected ? 'selected' : ''}" data-tag="${tag}">
                    <input type="checkbox" ${isSelected ? 'checked' : ''}>
                    <div class="tag-info">
                        <span class="tag-name">${tag}</span>
                        <span class="tag-count">${count}</span>
                    </div>
                </div>
            `;
        }).join('');
        
        // 添加选项点击事件
        this.options.querySelectorAll('.multi-select-option').forEach(option => {
            option.addEventListener('click', (e) => {
                e.preventDefault();
                const tag = option.dataset.tag;
                const checkbox = option.querySelector('input[type="checkbox"]');
                
                if (this.selectedTags.has(tag)) {
                    this.selectedTags.delete(tag);
                    checkbox.checked = false;
                    option.classList.remove('selected');
                } else {
                    this.selectedTags.add(tag);
                    checkbox.checked = true;
                    option.classList.add('selected');
                }
                
                this.updateDisplay();
            });
        });
    }
    
    // 过滤标签选项
    filterTagOptions(searchTerm) {
        this.renderTagOptions(searchTerm);
    }
    
    // 切换下拉框显示状态
    toggleDropdown() {
        if (this.isDropdownOpen) {
            this.closeDropdown();
        } else {
            this.openDropdown();
        }
    }
    
    // 打开下拉框
    openDropdown() {
        this.isDropdownOpen = true;
        this.dropdown.classList.add('show');
        this.display.classList.add('active');
        this.searchInput.focus();
        
        // 重新加载标签以获取最新数据
        this.loadAllTags();
    }
    
    // 关闭下拉框
    closeDropdown() {
        this.isDropdownOpen = false;
        this.dropdown.classList.remove('show');
        this.display.classList.remove('active');
        this.searchInput.value = '';
        this.renderTagOptions(); // 清除搜索过滤
    }
    
    // 更新显示
    updateDisplay() {
        const placeholder = this.display.querySelector('.placeholder');
        const selectedTagsContainer = this.display.querySelector('.selected-tags');
        
        if (this.selectedTags.size === 0) {
            if (placeholder) {
                placeholder.style.display = 'block';
                placeholder.textContent = '选择标签...';
            }
            if (selectedTagsContainer) {
                selectedTagsContainer.remove();
            }
        } else {
            if (placeholder) {
                placeholder.style.display = 'none';
            }
            
            // 创建或更新选中标签显示
            let tagsContainer = selectedTagsContainer;
            if (!tagsContainer) {
                tagsContainer = document.createElement('div');
                tagsContainer.className = 'selected-tags';
                this.display.insertBefore(tagsContainer, this.display.querySelector('.fas'));
            }
            
            tagsContainer.innerHTML = Array.from(this.selectedTags).map(tag => `
                <span class="selected-tag">
                    ${tag}
                    <span class="remove-tag" data-tag="${tag}">×</span>
                </span>
            `).join('');
            
            // 添加移除标签事件
            tagsContainer.querySelectorAll('.remove-tag').forEach(removeBtn => {
                removeBtn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    const tag = removeBtn.dataset.tag;
                    this.selectedTags.delete(tag);
                    this.updateDisplay();
                    this.renderTagOptions(); // 更新选项状态
                });
            });
        }
    }
    
    // 清空选择
    clearSelection() {
        this.selectedTags.clear();
        this.updateDisplay();
        this.renderTagOptions();
    }
    
    // 应用筛选
    applyFilter() {
        this.closeDropdown();
        
        // 触发笔记列表重新加载
        if (window.noteManager) {
            window.noteManager.currentPage = 1;
            window.noteManager.loadNotes();
        }
        
        // 显示应用的筛选条件
        if (this.selectedTags.size > 0) {
            ui.showToast(`已应用标签筛选: ${Array.from(this.selectedTags).join(', ')}`, 'success');
        } else {
            ui.showToast('已清除标签筛选', 'info');
        }
    }
    
    // 获取当前选中的标签
    getSelectedTags() {
        return Array.from(this.selectedTags);
    }
    
    // 设置选中的标签
    setSelectedTags(tags) {
        this.selectedTags = new Set(tags);
        this.updateDisplay();
        this.renderTagOptions();
    }
    
    // 检查是否有筛选条件
    hasFilter() {
        return this.selectedTags.size > 0;
    }
}

// 全局变量
let tagFilterManager = null;

// 初始化标签筛选管理器
document.addEventListener('DOMContentLoaded', () => {
    // 延迟初始化，确保其他组件已加载
    setTimeout(() => {
        if (document.getElementById('tagFilterDisplay')) {
            tagFilterManager = new TagFilterManager();
            window.tagFilterManager = tagFilterManager;
        }
    }, 100);
});
