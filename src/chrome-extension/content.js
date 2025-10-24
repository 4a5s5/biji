// Smart Note Collector - Content Script
// 处理主题选择对话框和页面交互

console.log('Smart Note Collector content script loaded');

// 全局变量
let selectionButton = null;
let currentSelection = null;
let extensionContextValid = true;

// 检查插件上下文是否有效
function checkExtensionContext() {
  try {
    if (!chrome.runtime || !chrome.runtime.sendMessage) {
      extensionContextValid = false;
      return false;
    }
    // 尝试访问extension ID
    const id = chrome.runtime.id;
    extensionContextValid = true;
    return true;
  } catch (error) {
    extensionContextValid = false;
    return false;
  }
}

// 定期检查插件上下文
setInterval(() => {
  checkExtensionContext();
}, 5000);

// 本地存储键名
const LAST_SELECTED_THEME_KEY = 'smart-note-last-selected-theme';

// 获取上次选择的主题
function getLastSelectedTheme() {
  try {
    return localStorage.getItem(LAST_SELECTED_THEME_KEY) || 'default';
  } catch (error) {
    console.warn('无法读取上次选择的主题:', error);
    return 'default';
  }
}

// 保存选择的主题
function saveLastSelectedTheme(themeId) {
  try {
    localStorage.setItem(LAST_SELECTED_THEME_KEY, themeId);
  } catch (error) {
    console.warn('无法保存选择的主题:', error);
  }
}

// 显示笔记编辑对话框
function showThemeSelectionDialog(noteData) {
  return new Promise((resolve, reject) => {
    // 创建对话框覆盖层
    const overlay = document.createElement('div');
    overlay.id = 'smart-note-edit-overlay';
    overlay.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      background: rgba(0, 0, 0, 0.5);
      z-index: 10000;
      display: flex;
      align-items: center;
      justify-content: center;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    `;

    // 创建对话框
    const dialog = document.createElement('div');
    dialog.style.cssText = `
      background: white;
      border-radius: 12px;
      box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
      max-width: 600px;
      width: 95%;
      max-height: 85vh;
      overflow-y: auto;
      animation: slideIn 0.3s ease;
    `;

    dialog.innerHTML = `
      <div style="padding: 24px;">
        <div style="display: flex; align-items: center; margin-bottom: 20px;">
          <h2 style="margin: 0; color: #2c3e50; font-size: 18px; flex: 1;">📝 编辑笔记</h2>
          <button id="close-dialog" style="background: none; border: none; font-size: 20px; cursor: pointer; color: #95a5a6;">×</button>
        </div>

        <!-- 笔记标题编辑 -->
        <div style="margin-bottom: 16px;">
          <label style="display: block; font-weight: 500; color: #34495e; margin-bottom: 8px;">📄 笔记标题：</label>
          <input type="text" id="note-title" value="${noteData.title}" style="
            width: 100%;
            padding: 12px;
            border: 2px solid #e9ecef;
            border-radius: 6px;
            font-size: 16px;
            font-weight: 500;
            transition: border-color 0.2s ease;
            box-sizing: border-box;
          " placeholder="输入笔记标题">
        </div>

        <!-- 笔记内容编辑 -->
        <div style="margin-bottom: 16px;">
          <label style="display: block; font-weight: 500; color: #34495e; margin-bottom: 8px;">📝 笔记内容：</label>
          <textarea id="note-content" style="
            width: 100%;
            min-height: 120px;
            padding: 12px;
            border: 2px solid #e9ecef;
            border-radius: 6px;
            font-size: 14px;
            line-height: 1.5;
            resize: vertical;
            transition: border-color 0.2s ease;
            box-sizing: border-box;
            font-family: inherit;
          " placeholder="输入笔记内容">${noteData.content}</textarea>
        </div>

        <!-- 标签编辑 -->
        <div style="margin-bottom: 16px;">
          <label style="display: block; font-weight: 500; color: #34495e; margin-bottom: 8px;">🏷️ 标签：</label>
          <input type="text" id="note-tags" value="${(noteData.tags || []).join(', ')}" style="
            width: 100%;
            padding: 10px 12px;
            border: 2px solid #e9ecef;
            border-radius: 6px;
            font-size: 14px;
            transition: border-color 0.2s ease;
            box-sizing: border-box;
          " placeholder="输入标签，用逗号分隔，注意必须使用英文格式的,">
          <div style="font-size: 12px; color: #6c757d; margin-top: 4px;">例如：工作, 重要, 学习</div>
        </div>

        <!-- 主题选择 -->
        <div style="margin-bottom: 20px;">
          <label style="display: block; font-weight: 500; color: #34495e; margin-bottom: 8px;">🎨 选择主题：</label>
          <div id="theme-list" style="max-height: 150px; overflow-y: auto; border: 2px solid #e9ecef; border-radius: 6px; padding: 8px;">
            <div style="text-align: center; color: #6c757d; padding: 20px;">加载中...</div>
          </div>
        </div>

        <!-- 新建主题 -->
        <div style="margin-bottom: 20px;">
          <label style="display: block; font-weight: 500; color: #34495e; margin-bottom: 8px;">➕ 或创建新主题：</label>
          <input type="text" id="new-theme-name" placeholder="输入新主题名称" style="
            width: 100%;
            padding: 10px 12px;
            border: 2px solid #e9ecef;
            border-radius: 6px;
            font-size: 14px;
            transition: border-color 0.2s ease;
            box-sizing: border-box;
          ">
        </div>

        <!-- 操作按钮 -->
        <div style="display: flex; gap: 12px; justify-content: flex-end; border-top: 1px solid #e9ecef; padding-top: 16px; margin-top: 20px;">
          <button id="cancel-btn" style="
            padding: 12px 24px;
            border: 2px solid #e9ecef;
            background: white;
            color: #6c757d;
            border-radius: 6px;
            cursor: pointer;
            font-size: 14px;
            transition: all 0.2s ease;
          ">取消</button>
          <button id="save-btn" style="
            padding: 12px 24px;
            border: none;
            background: linear-gradient(135deg, #3498db, #2980b9);
            color: white;
            border-radius: 6px;
            cursor: pointer;
            font-size: 14px;
            font-weight: 500;
            transition: all 0.2s ease;
          ">💾 保存笔记</button>
        </div>
      </div>
    `;

    // 添加动画样式
    if (!document.getElementById('smart-note-dialog-styles')) {
      const styles = document.createElement('style');
      styles.id = 'smart-note-dialog-styles';
      styles.textContent = `
        @keyframes slideIn {
          from { opacity: 0; transform: translateY(-20px) scale(0.95); }
          to { opacity: 1; transform: translateY(0) scale(1); }
        }
        
        #note-title:focus, #note-content:focus, #note-tags:focus, #new-theme-name:focus {
          outline: none;
          border-color: #3498db !important;
          box-shadow: 0 0 0 3px rgba(52, 152, 219, 0.1);
        }
        
        #cancel-btn:hover {
          background: #f8f9fa !important;
          border-color: #dee2e6 !important;
        }
        
        #save-btn:hover {
          background: linear-gradient(135deg, #2980b9, #1f5f8b) !important;
          transform: translateY(-1px);
        }
        
        .theme-item {
          padding: 12px;
          border: 2px solid #e9ecef;
          border-radius: 6px;
          margin-bottom: 8px;
          cursor: pointer;
          transition: all 0.2s ease;
          background: white;
        }
        
        .theme-item:hover {
          border-color: #3498db;
          background: #f8f9fa;
        }
        
        .theme-item.selected {
          border-color: #3498db;
          background: #e3f2fd;
        }
        
        .theme-item:last-child {
          margin-bottom: 0;
        }
      `;
      document.head.appendChild(styles);
    }

    overlay.appendChild(dialog);
    document.body.appendChild(overlay);

    let selectedTheme = null;
    const lastSelectedTheme = getLastSelectedTheme();

    // 加载主题列表
    loadThemes();

    async function loadThemes() {
      try {
        // 从配置中获取服务器地址，默认使用本地
        let serverUrl = 'http://localhost:3000';
        
        // 尝试从 chrome.storage获取服务器地址
        try {
          const result = await chrome.storage.local.get(['config']);
          if (result.config && result.config.serverUrl) {
            serverUrl = result.config.serverUrl;
          }
        } catch (storageError) {
          console.warn('Chrome Extension: Failed to get server URL from storage:', storageError);
        }
        console.log('Chrome Extension: Starting to load themes from:', serverUrl);
        const response = await fetch(`${serverUrl}/api/themes`, {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json'
          }
        });
        console.log('Chrome Extension: Response status:', response.status);

        if (response.ok) {
          const themes = await response.json();
          console.log('Chrome Extension: Themes loaded:', themes);
          console.log('Chrome Extension: Themes type:', typeof themes);
          console.log('Chrome Extension: Is array:', Array.isArray(themes));

          if (Array.isArray(themes)) {
            displayThemes(themes);
          } else {
            console.error('Chrome Extension: Themes is not an array:', themes);
            throw new Error('Themes response is not an array');
          }
        } else {
          const errorText = await response.text();
          console.error('Chrome Extension: HTTP error:', response.status, errorText);
          throw new Error(`HTTP ${response.status}: ${errorText}`);
        }
      } catch (error) {
        console.error('Chrome Extension: Failed to load themes:', error);
        
        // 显示默认主题选项
        const themeListElement = document.getElementById('theme-list');
        if (themeListElement) {
          themeListElement.innerHTML = `
            <div class="theme-item" data-theme-id="default">
              <span class="theme-name">默认主题</span>
            </div>
            <div style="text-align: center; color: #e74c3c; padding: 10px; font-size: 12px;">
              无法连接服务器，使用默认主题
            </div>
          `;
          
          // 为默认主题添加点击事件
          const defaultTheme = themeListElement.querySelector('.theme-item');
          if (defaultTheme) {
            defaultTheme.addEventListener('click', () => {
              document.querySelectorAll('.theme-item').forEach(item => item.classList.remove('selected'));
              defaultTheme.classList.add('selected');
              selectedTheme = 'default';
            });
            // 如果上次选择的是默认主题，则选中它
            if (lastSelectedTheme === 'default') {
              defaultTheme.click();
            }
          }
        }
      }
    }

    function displayThemes(themes) {
      console.log('Chrome Extension: displayThemes called with:', themes);
      const themeList = document.getElementById('theme-list');

      if (!themeList) {
        console.error('Chrome Extension: theme-list element not found');
        return;
      }

      if (!themes || themes.length === 0) {
        console.log('Chrome Extension: No themes to display');
        themeList.innerHTML = `
          <div style="text-align: center; color: #6c757d; padding: 20px;">
            暂无主题<br>
            <small>请在下方创建新主题</small>
          </div>
        `;
        return;
      }

      themeList.innerHTML = themes.map(theme => `
        <div class="theme-item" data-theme-id="${theme.id}">
          <div style="font-weight: 500; color: #2c3e50; margin-bottom: 4px;">${theme.name}</div>
          <div style="font-size: 12px; color: #6c757d;">
            ${theme.noteCount || 0} 条笔记
            ${theme.id === 'default' ? ' • 默认主题' : ''}
          </div>
        </div>
      `).join('');

      // 尝试选中上次选择的主题，如果找不到则选中第一个主题
      let themeToSelect = null;
      
      // 先查找上次选择的主题
      if (lastSelectedTheme) {
        themeToSelect = themeList.querySelector(`[data-theme-id="${lastSelectedTheme}"]`);
      }
      
      // 如果没找到上次选择的主题，则选择第一个主题
      if (!themeToSelect) {
        themeToSelect = themeList.querySelector('.theme-item');
      }
      
      if (themeToSelect) {
        themeToSelect.classList.add('selected');
        selectedTheme = themeToSelect.dataset.themeId;
      }

      // 添加主题选择事件
      themeList.addEventListener('click', (e) => {
        const themeItem = e.target.closest('.theme-item');
        if (themeItem) {
          // 移除其他选中状态
          themeList.querySelectorAll('.theme-item').forEach(item => {
            item.classList.remove('selected');
          });
          
          // 选中当前主题
          themeItem.classList.add('selected');
          selectedTheme = themeItem.dataset.themeId;
          
          // 清空新主题输入框
          document.getElementById('new-theme-name').value = '';
        }
      });
    }

    // 事件处理
    document.getElementById('close-dialog').addEventListener('click', () => {
      document.body.removeChild(overlay);
      reject(new Error('用户取消操作'));
    });

    document.getElementById('cancel-btn').addEventListener('click', () => {
      document.body.removeChild(overlay);
      reject(new Error('用户取消操作'));
    });

    document.getElementById('new-theme-name').addEventListener('input', (e) => {
      if (e.target.value.trim()) {
        // 清除主题选择
        document.querySelectorAll('.theme-item').forEach(item => {
          item.classList.remove('selected');
        });
        selectedTheme = null;
      }
    });

    document.getElementById('save-btn').addEventListener('click', async () => {
      // 获取编辑后的笔记数据
      const editedTitle = document.getElementById('note-title').value.trim();
      const editedContent = document.getElementById('note-content').value.trim();
      const editedTags = document.getElementById('note-tags').value.trim();
      const newThemeName = document.getElementById('new-theme-name').value.trim();

      // 验证必填字段
      if (!editedTitle) {
        showToast('请输入笔记标题', 'warning');
        document.getElementById('note-title').focus();
        return;
      }

      if (!editedContent) {
        showToast('请输入笔记内容', 'warning');
        document.getElementById('note-content').focus();
        return;
      }

      let finalTheme = selectedTheme;

      // 保存选择的主题到本地存储
      if (selectedTheme) {
        saveLastSelectedTheme(selectedTheme);
      }

      // 如果输入了新主题名称，创建新主题
      if (newThemeName) {
        try {
          // 获取服务器地址
          let serverUrl = 'http://localhost:3000';
          try {
            const result = await chrome.storage.local.get(['config']);
            if (result.config && result.config.serverUrl) {
              serverUrl = result.config.serverUrl;
            }
          } catch (storageError) {
            console.warn('Chrome Extension: Failed to get server URL from storage:', storageError);
          }
          
          const response = await fetch(`${serverUrl}/api/themes`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name: newThemeName })
          });

          if (response.ok) {
            const newTheme = await response.json();
            finalTheme = newTheme.id;
            showToast(`新主题"${newTheme.name}"创建成功`, 'success');
          } else {
            throw new Error('创建主题失败');
          }
        } catch (error) {
          console.error('Failed to create theme:', error);
          showToast('创建主题失败: ' + error.message, 'error');
          return;
        }
      }

      if (!finalTheme) {
        showToast('请选择一个主题或创建新主题', 'warning');
        return;
      }

      // 处理标签
      const tagsArray = editedTags ? editedTags.split(',').map(tag => tag.trim()).filter(tag => tag) : [];

      // 构建编辑后的笔记数据
      const editedNoteData = {
        title: editedTitle,
        content: editedContent,
        tags: tagsArray,
        theme: finalTheme,
        url: noteData.url,
        source: noteData.source
      };

      document.body.removeChild(overlay);
      resolve({ success: true, theme: finalTheme, noteData: editedNoteData });
    });

    // 移除点击覆盖层关闭功能，防止意外关闭
    // overlay.addEventListener('click', (e) => {
    //   if (e.target === overlay) {
    //     document.body.removeChild(overlay);
    //     reject(new Error('用户取消操作'));
    //   }
    // });

    // 键盘快捷键支持
    const handleKeydown = (e) => {
      if (e.key === 'Escape') {
        // ESC键关闭
        document.body.removeChild(overlay);
        document.removeEventListener('keydown', handleKeydown);
        reject(new Error('用户取消操作'));
      } else if (e.ctrlKey && e.key === 'Enter') {
        // Ctrl+Enter保存
        e.preventDefault();
        document.getElementById('save-btn').click();
      }
    };
    document.addEventListener('keydown', handleKeydown);
  });
}

// 显示Toast消息
function showToast(message, type = 'info') {
  const toast = document.createElement('div');
  toast.textContent = message;
  
  toast.style.cssText = `
    position: fixed;
    top: 20px;
    right: 20px;
    z-index: 10001;
    padding: 12px 20px;
    border-radius: 6px;
    color: white;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    font-size: 14px;
    font-weight: 500;
    box-shadow: 0 4px 12px rgba(0,0,0,0.3);
    animation: slideIn 0.3s ease;
    max-width: 300px;
  `;
  
  // 设置不同类型的颜色
  if (type === 'success') {
    toast.style.background = 'linear-gradient(135deg, #2ecc71, #27ae60)';
  } else if (type === 'error') {
    toast.style.background = 'linear-gradient(135deg, #e74c3c, #c0392b)';
  } else if (type === 'warning') {
    toast.style.background = 'linear-gradient(135deg, #f39c12, #e67e22)';
  } else {
    toast.style.background = 'linear-gradient(135deg, #3498db, #2980b9)';
  }
  
  // 添加滑入动画
  if (!document.getElementById('smart-note-toast-styles')) {
    const styles = document.createElement('style');
    styles.id = 'smart-note-toast-styles';
    styles.textContent = `
      @keyframes slideIn {
        from { opacity: 0; transform: translateX(100%); }
        to { opacity: 1; transform: translateX(0); }
      }
    `;
    document.head.appendChild(styles);
  }
  
  document.body.appendChild(toast);
  
  // 3秒后自动移除
  setTimeout(() => {
    if (toast.parentNode) {
      toast.parentNode.removeChild(toast);
    }
  }, 3000);
}

// 监听来自background script的消息
chrome.runtime.onMessage.addListener((request, _sender, sendResponse) => {
  console.log('Content script received message:', request.action);

  if (request.action === 'ping') {
    // 响应ping请求，确认content script已加载
    sendResponse({ status: 'ready' });
    return;
  }
  
  // 处理截图选择请求
  if (request.action === 'startScreenshotSelection') {
    console.log('Starting screenshot selection...');
    
    // 检查ScreenshotSelector是否可用
    if (typeof ScreenshotSelector === 'undefined') {
      console.error('ScreenshotSelector not found, loading it...');
      // 尝试动态加载
      const script = document.createElement('script');
      script.src = chrome.runtime.getURL('screenshot-selector.js');
      script.onload = () => {
        console.log('ScreenshotSelector loaded dynamically');
        // 重新执行选择逻辑
        if (typeof ScreenshotSelector !== 'undefined') {
          const selector = new ScreenshotSelector();
          selector.startSelection()
            .then(result => {
              console.log('Screenshot selection result:', result);
              sendResponse(result);
            })
            .catch(error => {
              console.error('Screenshot selection error:', error);
              sendResponse({ error: error.message });
            });
        }
      };
      document.head.appendChild(script);
    } else {
      const selector = new ScreenshotSelector();
      selector.startSelection()
        .then(result => {
          console.log('Screenshot selection result:', result);
          sendResponse(result);
        })
        .catch(error => {
          console.error('Screenshot selection error:', error);
          sendResponse({ error: error.message });
        });
    }
    
    return true; // 保持消息通道开放
  }

  if (request.action === 'showThemeDialog') {
    console.log('Showing theme dialog for:', request.noteData);

    showThemeSelectionDialog(request.noteData)
      .then(result => {
        console.log('Theme selected:', result);

        sendResponse(result);
      })
      .catch(error => {
        console.error('Theme selection failed:', error);
        sendResponse({ success: false, error: error.message });
      });

    return true; // 保持消息通道开放
  }

  if (request.action === 'getPageContent') {
    const pageContent = {
      selectedText: window.getSelection().toString().trim(),
      pageTitle: document.title,
      pageUrl: window.location.href,
      description: document.querySelector('meta[name="description"]')?.content || '',
      keywords: document.querySelector('meta[name="keywords"]')?.content || ''
    };

    sendResponse(pageContent);
  }
});

// 创建选中文本后的小蓝点按钮
function createSelectionButton() {
  const button = document.createElement('div');
  button.id = 'smart-note-selection-button';
  button.innerHTML = '📝';
  button.style.cssText = `
    position: absolute;
    width: 32px;
    height: 32px;
    background: #007bff;
    border: 2px solid white;
    border-radius: 50%;
    cursor: pointer;
    z-index: 9999;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 14px;
    color: white;
    box-shadow: 0 2px 8px rgba(0, 123, 255, 0.3);
    transition: all 0.2s ease;
    opacity: 0;
    transform: scale(0.8);
    pointer-events: none;
  `;

  // 点击事件
  button.addEventListener('click', (e) => {
    e.preventDefault();
    e.stopPropagation();
    handleSelectionButtonClick();
  });

  // 鼠标悬停效果
  button.addEventListener('mouseenter', () => {
    button.style.transform = 'scale(1.1)';
    button.style.boxShadow = '0 4px 12px rgba(0, 123, 255, 0.4)';
  });

  button.addEventListener('mouseleave', () => {
    button.style.transform = 'scale(1)';
    button.style.boxShadow = '0 2px 8px rgba(0, 123, 255, 0.3)';
  });

  document.body.appendChild(button);
  return button;
}

// 显示选择按钮
function showSelectionButton(selection) {
  if (!selection || selection.toString().trim().length === 0) {
    hideSelectionButton();
    return;
  }

  // 如果插件上下文无效，不显示按钮
  if (!extensionContextValid) {
    return;
  }

  if (!selectionButton) {
    selectionButton = createSelectionButton();
  }

  const range = selection.getRangeAt(0);
  const rect = range.getBoundingClientRect();
  
  // 计算按钮位置（选中文本右上角）
  const buttonX = rect.right + window.scrollX + 5;
  const buttonY = rect.top + window.scrollY - 5;

  selectionButton.style.left = buttonX + 'px';
  selectionButton.style.top = buttonY + 'px';
  selectionButton.style.opacity = '1';
  selectionButton.style.transform = 'scale(1)';
  selectionButton.style.pointerEvents = 'auto';

  currentSelection = selection.toString().trim();
}

// 隐藏选择按钮
function hideSelectionButton() {
  if (selectionButton) {
    selectionButton.style.opacity = '0';
    selectionButton.style.transform = 'scale(0.8)';
    selectionButton.style.pointerEvents = 'none';
  }
  currentSelection = null;
}

// 处理选择按钮点击
function handleSelectionButtonClick() {
  if (!currentSelection) return;

  try {
    // 检查插件上下文是否有效
    if (!checkExtensionContext()) {
      console.error('Chrome extension context is invalidated');
      showNotification('插件上下文已失效，请刷新页面重新加载插件', 'error');
      hideSelectionButton();
      return;
    }

    // 直接发送消息给background script，模拟右键菜单的addSelectionToNotes功能
    chrome.runtime.sendMessage({
      action: 'addSelectionToNotes',
      data: {
        selectedText: currentSelection,
        pageTitle: document.title,
        pageUrl: window.location.href,
        description: document.querySelector('meta[name="description"]')?.content || '',
        keywords: document.querySelector('meta[name="keywords"]')?.content || ''
      }
    }).then((response) => {
      if (response && response.success) {
        console.log('笔记已保存:', response);
        hideSelectionButton();
        showNotification('笔记已成功保存！', 'success');
      } else {
        console.error('保存笔记失败:', response);
        showNotification('保存笔记失败，请重试', 'error');
      }
    }).catch((error) => {
      console.error('发送消息失败:', error);
      if (error.message && error.message.includes('Extension context invalidated')) {
        showNotification('插件需要重新加载，请刷新页面', 'error');
      } else {
        showNotification('保存笔记失败，请重试', 'error');
      }
    });
  } catch (error) {
    console.error('处理选择按钮点击失败:', error);
    if (error.message && error.message.includes('Extension context invalidated')) {
      showNotification('插件需要重新加载，请刷新页面', 'error');
    } else {
      showNotification('保存笔记失败，请重试', 'error');
    }
  }
}

// 显示通知
function showNotification(message, type = 'info') {
  const notification = document.createElement('div');
  notification.style.cssText = `
    position: fixed;
    top: 20px;
    right: 20px;
    background: ${type === 'success' ? '#28a745' : type === 'error' ? '#dc3545' : '#007bff'};
    color: white;
    padding: 12px 20px;
    border-radius: 8px;
    font-size: 14px;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    z-index: 10001;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2);
    opacity: 0;
    transform: translateX(100%);
    transition: all 0.3s ease;
  `;
  
  notification.textContent = message;
  document.body.appendChild(notification);

  // 显示动画
  setTimeout(() => {
    notification.style.opacity = '1';
    notification.style.transform = 'translateX(0)';
  }, 100);

  // 自动隐藏
  setTimeout(() => {
    notification.style.opacity = '0';
    notification.style.transform = 'translateX(100%)';
    setTimeout(() => {
      if (notification.parentNode) {
        notification.parentNode.removeChild(notification);
      }
    }, 300);
  }, 3000);
}

// 监听文本选择事件
document.addEventListener('mouseup', (e) => {
  setTimeout(() => {
    const selection = window.getSelection();
    if (selection && selection.toString().trim().length > 0) {
      showSelectionButton(selection);
    } else {
      hideSelectionButton();
    }
  }, 100);
});

// 监听键盘选择事件
document.addEventListener('keyup', (e) => {
  // 检查是否是选择相关的按键
  if (e.key === 'ArrowLeft' || e.key === 'ArrowRight' || 
      e.key === 'ArrowUp' || e.key === 'ArrowDown' ||
      e.shiftKey) {
    setTimeout(() => {
      const selection = window.getSelection();
      if (selection && selection.toString().trim().length > 0) {
        showSelectionButton(selection);
      } else {
        hideSelectionButton();
      }
    }, 100);
  }
});

// 监听点击事件，点击其他地方时隐藏按钮
document.addEventListener('click', (e) => {
  if (e.target !== selectionButton && !e.target.closest('#smart-note-selection-button')) {
    const selection = window.getSelection();
    if (!selection || selection.toString().trim().length === 0) {
      hideSelectionButton();
    }
  }
});

// 监听滚动事件，滚动时隐藏按钮
document.addEventListener('scroll', () => {
  hideSelectionButton();
});
