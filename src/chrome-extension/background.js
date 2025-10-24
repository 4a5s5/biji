// Smart Note Collector - Background Script
// 处理右键菜单和插件核心逻辑

// 导入配置管理器
importScripts('config.js');

// 插件安装时创建右键菜单
chrome.runtime.onInstalled.addListener(async () => {
  console.log('Smart Note Collector installed');
  
  // configManager 已通过 importScripts 从 config.js 导入
  
  // 创建右键菜单项
  chrome.contextMenus.create({
    id: 'addToNotes',
    title: '添加到笔记',
    contexts: ['selection', 'page', 'link', 'image']
  });
  
  chrome.contextMenus.create({
    id: 'addSelectionToNotes',
    title: '添加选中内容到笔记',
    contexts: ['selection']
  });
  
  chrome.contextMenus.create({
    id: 'addPageToNotes',
    title: '添加页面信息到笔记',
    contexts: ['page']
  });
  
  chrome.contextMenus.create({
    id: 'addLinkToNotes',
    title: '添加链接到笔记',
    contexts: ['link']
  });
  
  chrome.contextMenus.create({
    id: 'addScreenshotToNotes',
    title: '截图添加到笔记',
    contexts: ['page']
  });
  
  chrome.contextMenus.create({
    id: 'crawlPageContent',
    title: '爬取网页内容到笔记',
    contexts: ['page', 'link']
  });
});

// 处理截图添加到笔记
async function handleScreenshotToNotes(tab, baseNoteData) {
  try {
    console.log('📸 Starting screenshot capture...');
    
    // 捕获当前标签页的截图
    const screenshotDataUrl = await chrome.tabs.captureVisibleTab(tab.windowId, {
      format: 'png',
      quality: 90
    });
    
    console.log('📸 Screenshot captured, size:', screenshotDataUrl.length);
    
    // 将截图转换为Blob
    const response = await fetch(screenshotDataUrl);
    const blob = await response.blob();
    
    // 创建FormData来上传截图
    const formData = new FormData();
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `screenshot-${timestamp}.png`;
    formData.append('image', blob, filename);
    
    // 获取服务器地址
    const serverUrl = await configManager.getServerUrl();
    
    // 上传截图到服务器
    console.log('📸 Uploading screenshot to server...');
    const uploadResponse = await fetch(`${serverUrl}/api/upload-image`, {
      method: 'POST',
      body: formData
    });
    
    if (!uploadResponse.ok) {
      throw new Error(`上传截图失败: ${uploadResponse.status}`);
    }
    
    const uploadResult = await uploadResponse.json();
    console.log('📸 Screenshot uploaded:', uploadResult);
    
    // 创建包含截图的笔记数据
    const noteData = {
      ...baseNoteData,
      title: `页面截图 - ${tab.title}`,
      content: `# 页面截图\n\n**页面URL**: ${tab.url}\n**截图时间**: ${new Date().toLocaleString()}\n\n![截图](${uploadResult.url})`,
      source: {
        type: 'chrome_extension_screenshot',
        url: tab.url,
        title: tab.title,
        screenshotUrl: uploadResult.url
      }
    };
    
    // 确保content script已加载并显示主题选择对话框
    await ensureContentScriptLoaded(tab.id);
    
    const themeResponse = await chrome.tabs.sendMessage(tab.id, {
      action: 'showThemeDialog',
      noteData: noteData
    });
    
    if (themeResponse && themeResponse.success) {
      const finalNoteData = themeResponse.noteData || noteData;
      await sendToNoteServer(finalNoteData, themeResponse.theme);
      
      showNotification('截图笔记保存成功！', `标题: ${finalNoteData.title}`, 'basic');
    } else {
      console.log('❌ 用户取消了截图笔记操作');
    }
    
  } catch (error) {
    console.error('📸 Screenshot capture failed:', error);
    showNotification('截图失败', error.message, 'basic');
  }
}

// 处理爬取网页内容到笔记
async function handleCrawlPageContent(targetUrl, tab, baseNoteData) {
  try {
    console.log('🕷️ Starting page content crawling for:', targetUrl);
    
    // 获取服务器地址
    const serverUrl = await configManager.getServerUrl();
    
    // 发送爬取请求到服务器
    console.log('🕷️ Sending crawl request to server...');
    const crawlResponse = await fetch(`${serverUrl}/api/crawl-content`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        url: targetUrl,
        options: {
          extractText: true,
          extractImages: true,
          extractLinks: true,
          maxDepth: 1
        }
      })
    });
    
    if (!crawlResponse.ok) {
      throw new Error(`爬取失败: ${crawlResponse.status}`);
    }
    
    const crawlResult = await crawlResponse.json();
    console.log('🕷️ Crawl completed:', crawlResult);
    
    // 构建笔记内容
    let content = `# 网页内容爬取\n\n`;
    content += `**原始链接**: ${targetUrl}\n`;
    content += `**爬取时间**: ${new Date().toLocaleString()}\n\n`;
    
    if (crawlResult.title) {
      content += `## 页面标题\n${crawlResult.title}\n\n`;
    }
    
    if (crawlResult.description) {
      content += `## 页面描述\n${crawlResult.description}\n\n`;
    }
    
    if (crawlResult.content) {
      content += `## 主要内容\n${crawlResult.content}\n\n`;
    }
    
    if (crawlResult.links && crawlResult.links.length > 0) {
      content += `## 相关链接\n`;
      crawlResult.links.slice(0, 10).forEach(link => {
        content += `- [${link.text || link.url}](${link.url})\n`;
      });
      content += '\n';
    }
    
    if (crawlResult.images && crawlResult.images.length > 0) {
      content += `## 页面图片\n`;
      crawlResult.images.slice(0, 5).forEach(img => {
        content += `![${img.alt || '图片'}](${img.src})\n`;
      });
      content += '\n';
    }
    
    // 创建笔记数据
    const noteData = {
      ...baseNoteData,
      title: `网页爬取 - ${crawlResult.title || targetUrl}`,
      content: content,
      source: {
        type: 'chrome_extension_crawl',
        url: targetUrl,
        title: crawlResult.title || tab.title,
        crawlData: crawlResult
      }
    };
    
    // 确保content script已加载并显示主题选择对话框
    await ensureContentScriptLoaded(tab.id);
    
    const themeResponse = await chrome.tabs.sendMessage(tab.id, {
      action: 'showThemeDialog',
      noteData: noteData
    });
    
    if (themeResponse && themeResponse.success) {
      const finalNoteData = themeResponse.noteData || noteData;
      await sendToNoteServer(finalNoteData, themeResponse.theme);
      
      showNotification('网页爬取笔记保存成功！', `标题: ${finalNoteData.title}`, 'basic');
    } else {
      console.log('❌ 用户取消了网页爬取笔记操作');
    }
    
  } catch (error) {
    console.error('🕷️ Page crawling failed:', error);
    showNotification('网页爬取失败', error.message, 'basic');
  }
}
// 处理来自content script和popup的消息
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  console.log('Background received message:', request.action);
  
  if (request.action === 'ping') {
    sendResponse({ status: 'ready' });
    return true;
  }
  
  if (request.action === 'addSelectionToNotes') {
    handleAddSelectionToNotes(request.data, sender.tab)
      .then(result => sendResponse(result))
      .catch(error => sendResponse({ success: false, error: error.message }));
    return true;
  }
  
  // 处理截图请求
  if (request.action === 'captureScreenshot') {
    const tab = request.tab;
    if (!tab) {
      sendResponse({ success: false, error: '无法获取标签页信息' });
      return;
    }
    
    const baseNoteData = {
      title: '',
      content: '',
      url: tab.url,
      pageTitle: tab.title,
      timestamp: new Date().toISOString()
    };
    
    handleScreenshotToNotes(tab, baseNoteData)
      .then(() => {
        sendResponse({ success: true });
      })
      .catch(error => {
        sendResponse({ success: false, error: error.message });
      });
    
    return true; // 保持消息通道开放
  }
  
  // 处理爬取页面请求
  if (request.action === 'crawlPage') {
    const tab = request.tab;
    const targetUrl = request.url;
    
    if (!targetUrl) {
      sendResponse({ success: false, error: '缺少目标URL' });
      return;
    }
    
    const baseNoteData = {
      title: '',
      content: '',
      url: tab?.url || targetUrl,
      pageTitle: tab?.title || '网页爬取',
      timestamp: new Date().toISOString()
    };
    
    handleCrawlPageContent(targetUrl, tab || { url: targetUrl, title: '网页' }, baseNoteData)
      .then(() => {
        sendResponse({ success: true });
      })
      .catch(error => {
        sendResponse({ success: false, error: error.message });
      });
    
    return true; // 保持消息通道开放
  }
  
  if (request.action === 'addNote') {
    sendToNoteServer(request.data)
      .then(result => {
        sendResponse({ success: true, data: result });
      })
      .catch(error => {
        sendResponse({ success: false, error: error.message });
      });
    return true;
  }

  if (request.action === 'openPopup') {
    chrome.tabs.create({
      url: chrome.runtime.getURL('popup.html'),
      active: true
    });
    sendResponse({ success: true });
    return true;
  }
});

// 处理添加选中内容到笔记
async function handleAddSelectionToNotes(data, tab) {
  try {
    // 检查是否是特殊页面
    if (tab.url.startsWith('chrome://') || tab.url.startsWith('chrome-extension://') || tab.url.startsWith('edge://') || tab.url.startsWith('about:')) {
      throw new Error('此页面不支持内容收集功能');
    }

    const noteData = {
      title: `选中内容 - ${data.pageTitle}`,
      content: data.selectedText,
      url: data.pageUrl,
      pageTitle: data.pageTitle,
      timestamp: new Date().toISOString(),
      source: {
        type: 'chrome_extension_selection_button',
        url: data.pageUrl,
        title: data.pageTitle
      }
    };

    console.log('🔵 Blue Button: Ensuring content script is loaded...');
    // 确保content script已加载（关键修复）
    await ensureContentScriptLoaded(tab.id);
    
    console.log('🔵 Blue Button: Sending message to content script...');
    const themeResponse = await chrome.tabs.sendMessage(tab.id, {
      action: 'showThemeDialog',
      noteData: noteData
    });

    console.log('🔵 Blue Button: Received response:', themeResponse);

    if (themeResponse && themeResponse.success) {
      const finalNoteData = themeResponse.noteData || noteData;
      
      console.log('🔵 Blue Button: Saving note with theme:', themeResponse.theme);
      await sendToNoteServer(finalNoteData, themeResponse.theme);
      
      return { success: true, note: finalNoteData };
    } else {
      throw new Error('用户取消了操作或主题选择失败');
    }
  } catch (error) {
    console.error('🔵 Blue Button: 处理选中内容失败:', error);
    throw error;
  }
}

chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  console.log('Context menu clicked:', info.menuItemId);
  console.log('Tab info:', { id: tab.id, url: tab.url, title: tab.title });

  try {
    // 检查是否是特殊页面（chrome://、extension://等）
    if (tab.url.startsWith('chrome://') || tab.url.startsWith('chrome-extension://') || tab.url.startsWith('edge://') || tab.url.startsWith('about:')) {
      console.log('Cannot access special page:', tab.url);
      showNotification('无法在此页面使用', '此页面不支持内容收集功能', 'basic');
      return;
    }

    let pageData = {
      selectedText: info.selectionText || '',
      description: '',
      keywords: '',
      url: tab.url,
      title: tab.title
    };

    // 尝试获取页面内容，如果失败则使用基本信息
    try {
      const results = await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        function: getPageContent,
        args: [info]
      });

      if (results && results[0] && results[0].result) {
        pageData = { ...pageData, ...results[0].result };
      }
    } catch (scriptError) {
      console.log('Cannot execute script on this page, using basic info:', scriptError);
      // 继续使用基本的pageData
    }
    
    // 根据菜单项类型处理不同的内容
    let noteData = {
      title: '',
      content: '',
      url: tab.url,
      pageTitle: tab.title,
      timestamp: new Date().toISOString(),
      source: {
        type: 'chrome_extension',
        url: tab.url,
        title: tab.title,
        menuItem: info.menuItemId
      }
    };

    switch (info.menuItemId) {
      case 'addSelectionToNotes':
        noteData.title = `选中内容 - ${tab.title}`;
        noteData.content = pageData.selectedText || info.selectionText || '';
        break;

      case 'addPageToNotes':
        noteData.title = tab.title;
        noteData.content = `页面URL: ${tab.url}\n\n页面描述: ${pageData.description || ''}`;
        break;

      case 'addLinkToNotes':
        noteData.title = `链接 - ${info.linkText || info.linkUrl}`;
        noteData.content = `链接地址: ${info.linkUrl}\n链接文本: ${info.linkText || ''}`;
        break;

      case 'addScreenshotToNotes':
        await handleScreenshotToNotes(tab, noteData);
        return; // 截图处理是异步的，直接返回

      case 'crawlPageContent':
        const targetUrl = info.linkUrl || tab.url;
        await handleCrawlPageContent(targetUrl, tab, noteData);
        return; // 爬取处理是异步的，直接返回

      default:
        // 默认添加选中内容或页面信息
        if (pageData.selectedText) {
          noteData.title = `网页内容 - ${tab.title}`;
          noteData.content = pageData.selectedText;
        } else {
          noteData.title = tab.title;
          noteData.content = `页面URL: ${tab.url}`;
        }
    }

    // 显示主题选择对话框
    try {
      // 确保content script已加载
      await ensureContentScriptLoaded(tab.id);

      console.log('🚀 Background: Sending message to content script...');
      console.log('🚀 Background: Original noteData:', noteData);

      const themeResponse = await chrome.tabs.sendMessage(tab.id, {
        action: 'showThemeDialog',
        noteData: noteData
      });

      console.log('🚀 Background: Received response from content script:', themeResponse);

      if (themeResponse && themeResponse.success) {
        // 使用编辑后的笔记数据保存
        const finalNoteData = themeResponse.noteData || noteData;

        console.log('=== Chrome Extension Debug ===');
        console.log('Original noteData:', noteData);
        console.log('Theme response:', themeResponse);
        console.log('Final noteData:', finalNoteData);
        console.log('Selected theme:', themeResponse.theme);
        console.log('Data comparison:');
        console.log('  Title changed:', noteData.title !== finalNoteData.title);
        console.log('  Content changed:', noteData.content !== finalNoteData.content);
        console.log('  Tags changed:', JSON.stringify(noteData.tags || []) !== JSON.stringify(finalNoteData.tags || []));
        console.log('==============================');

        await sendToNoteServer(finalNoteData, themeResponse.theme);

        // 显示成功通知
        const themeName = themeResponse.theme === 'default' ? '默认主题' : themeResponse.theme;
        showNotification('笔记保存成功！', `标题: ${finalNoteData.title}\n主题: ${themeName}`, 'basic');
      } else {
        console.log('❌ Background: 用户取消了操作或编辑失败');
        console.log('❌ Background: Theme response:', themeResponse);
      }
    } catch (messageError) {
      console.error('Failed to communicate with content script:', messageError);

      // 如果无法显示对话框，使用默认主题保存
      await sendToNoteServer(noteData, 'default');
      showNotification('笔记已保存', '使用默认主题保存（无法显示主题选择对话框）', 'basic');
    }

  } catch (error) {
    console.error('Error handling context menu click:', error);

    // 显示错误通知
    showNotification('添加笔记失败', error.message, 'basic');
  }
});

// 在页面中执行的函数，获取页面内容
function getPageContent(info) {
  const selectedText = window.getSelection().toString().trim();
  const description = document.querySelector('meta[name="description"]')?.content || '';
  const keywords = document.querySelector('meta[name="keywords"]')?.content || '';
  
  return {
    selectedText: selectedText,
    description: description,
    keywords: keywords,
    url: window.location.href,
    title: document.title
  };
}

// 发送笔记到服务器
async function sendToNoteServer(noteData, selectedTheme = 'default') {
  if (!configManager) {
    configManager = new ConfigManager();
  }
  const baseUrl = await configManager.getServerUrl();
  const serverUrl = `${baseUrl}/api/quick-import`;

  console.log('📤 SendToNoteServer: Starting...');
  console.log('📤 SendToNoteServer: Received noteData:', noteData);
  console.log('📤 SendToNoteServer: Selected theme:', selectedTheme);
  console.log('📤 SendToNoteServer: NoteData type:', typeof noteData);
  console.log('📤 SendToNoteServer: NoteData keys:', Object.keys(noteData || {}));

  try {
    // 处理标签：使用编辑后的标签，如果没有则使用默认标签
    let finalTags = ['网页收集', 'Chrome插件']; // 默认标签
    if (noteData.tags && Array.isArray(noteData.tags) && noteData.tags.length > 0) {
      // 使用编辑后的标签，并添加默认标签
      finalTags = [...noteData.tags, 'Chrome插件'];
    }

    const requestData = {
      title: noteData.title,
      content: noteData.content,
      theme: selectedTheme,
      tags: finalTags,
      source: noteData.source || {
        type: 'chrome_extension',
        app: 'Smart Note Collector',
        url: noteData.url
      }
    };

    console.log('📤 SendToNoteServer: Final request data:', requestData);
    console.log('📤 SendToNoteServer: Using edited tags:', finalTags);
    console.log('📤 SendToNoteServer: Request data keys:', Object.keys(requestData));
    console.log('📤 SendToNoteServer: About to send to:', serverUrl);

    const response = await fetch(serverUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestData)
    });

    console.log('Server response status:', response.status);

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Server error response:', errorText);
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const result = await response.json();
    console.log('Note saved successfully:', result);
    return result;

  } catch (error) {
    console.error('Failed to send note to server:', error);
    throw error;
  }
}

// 处理来自content script的消息
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'addNote') {
    sendToNoteServer(request.data)
      .then(result => {
        sendResponse({ success: true, data: result });
      })
      .catch(error => {
        sendResponse({ success: false, error: error.message });
      });

    // 返回true表示异步响应
    return true;
  }

  if (request.action === 'openPopup') {
    // 打开插件弹窗（通过创建新标签页的方式）
    chrome.tabs.create({
      url: chrome.runtime.getURL('popup.html'),
      active: true
    });

    sendResponse({ success: true });
    return true;
  }
});

// 检查服务器连接状态
async function checkServerConnection() {
  try {
    if (!configManager) {
      configManager = new ConfigManager();
    }
    const serverUrl = await configManager.getServerUrl();
    const response = await fetch(`${serverUrl}/api/health`);
    return response.ok;
  } catch (error) {
    return false;
  }
}

// 确保content script已加载
async function ensureContentScriptLoaded(tabId) {
  try {
    // 尝试ping content script
    await chrome.tabs.sendMessage(tabId, { action: 'ping' });
  } catch (error) {
    console.log('Content script not loaded, injecting...');

    // 如果content script未加载，手动注入所有必要的脚本
    await chrome.scripting.executeScript({
      target: { tabId: tabId },
      files: ['config.js', 'screenshot-selector.js', 'content.js']
    });

    // 等待一小段时间让script初始化
    await new Promise(resolve => setTimeout(resolve, 100));
  }
}

// 处理爬取网页内容到笔记
async function handleCrawlPageContent(targetUrl, tab, baseNoteData) {
  try {
    console.log('🕷️ Starting page content crawling for:', targetUrl);
    
    // 获取服务器地址
    const serverUrl = await configManager.getServerUrl();
    
    // 发送爬取请求到服务器
    console.log('🕷️ Sending crawl request to server...');
    const crawlResponse = await fetch(`${serverUrl}/api/crawl-content`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        url: targetUrl,
        options: {
          extractText: true,
          extractImages: true,
          extractLinks: true,
          maxDepth: 1
        }
      })
    });
    
    if (!crawlResponse.ok) {
      throw new Error(`爬取失败: ${crawlResponse.status}`);
    }
    
    const crawlResult = await crawlResponse.json();
    console.log('🕷️ Crawl completed:', crawlResult);
    
    // 构建笔记内容
    let content = `# 网页内容爬取\n\n`;
    content += `**原始链接**: ${targetUrl}\n`;
    content += `**爬取时间**: ${new Date().toLocaleString()}\n\n`;
    
    if (crawlResult.title) {
      content += `## 页面标题\n${crawlResult.title}\n\n`;
    }
    
    if (crawlResult.description) {
      content += `## 页面描述\n${crawlResult.description}\n\n`;
    }
    
    if (crawlResult.content) {
      content += `## 主要内容\n${crawlResult.content}\n\n`;
    }
    
    if (crawlResult.links && crawlResult.links.length > 0) {
      content += `## 相关链接\n`;
      crawlResult.links.slice(0, 10).forEach(link => {
        content += `- [${link.text || link.url}](${link.url})\n`;
      });
      content += '\n';
    }
    
    if (crawlResult.images && crawlResult.images.length > 0) {
      content += `## 页面图片\n`;
      crawlResult.images.slice(0, 5).forEach(img => {
        content += `![${img.alt || '图片'}](${img.src})\n`;
      });
      content += '\n';
    }
    
    // 创建笔记数据
    const noteData = {
      ...baseNoteData,
      title: `网页爬取 - ${crawlResult.title || targetUrl}`,
      content: content,
      source: {
        type: 'chrome_extension_crawl',
        url: targetUrl,
        title: crawlResult.title || tab.title,
        crawlData: crawlResult
      }
    };
    
    // 确保content script已加载并显示主题选择对话框
    await ensureContentScriptLoaded(tab.id);
    
    const themeResponse = await chrome.tabs.sendMessage(tab.id, {
      action: 'showThemeDialog',
      noteData: noteData
    });
    
    if (themeResponse && themeResponse.success) {
      const finalNoteData = themeResponse.noteData || noteData;
      await sendToNoteServer(finalNoteData, themeResponse.theme);
      
      showNotification('网页爬取笔记保存成功！', `标题: ${finalNoteData.title}`, 'basic');
    } else {
      console.log('❌ 用户取消了网页爬取笔记操作');
    }
    
  } catch (error) {
    console.error('🕷️ Page crawling failed:', error);
    showNotification('网页爬取失败', error.message, 'basic');
  }
}

// 处理截图添加到笔记
async function handleScreenshotToNotes(tab, baseNoteData) {
  try {
    console.log('📸 Starting screenshot capture with area selection...');
    
    // 确保content script已加载
    await ensureContentScriptLoaded(tab.id);
    
    // 先截取整个页面
    const fullScreenshot = await chrome.tabs.captureVisibleTab(tab.windowId, {
      format: 'png',
      quality: 90
    });
    
    // 让用户选择截图区域
    console.log('📸 Sending area selection request to content script...');
    const selectionResult = await chrome.tabs.sendMessage(tab.id, {
      action: 'startScreenshotSelection'
    });
    
    console.log('📸 Area selection result:', selectionResult);
    
    if (selectionResult.error) {
      throw new Error(selectionResult.error);
    }
    
    // 修复属性名问题：selectionResult返回的是rect而不是area
    const area = selectionResult.rect || selectionResult.area;
    if (!area) {
      throw new Error('未获取到截图区域信息');
    }
    
    console.log('📸 Cropping image with area:', area);
    
    // 裁剪截图到选定区域
    const croppedImage = await cropImage(fullScreenshot, area);
    
    // 将截图转换为Blob
    const response = await fetch(croppedImage);
    const blob = await response.blob();
    
    // 创建FormData来上传截图，明确指定保存到data/images
    const formData = new FormData();
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `screenshot-${timestamp}.png`;
    formData.append('image', blob, filename);
    // 注意：multer会在文件名前添加targetDir，所以不需要在这里指定
    // formData.append('targetDir', 'data/images'); // 移除这行，让服务器使用默认uploads目录
    
    // 获取服务器地址
    const serverUrl = await configManager.getServerUrl();
    
    // 上传截图到服务器
    console.log('📸 Uploading screenshot to server...');
    const uploadResponse = await fetch(`${serverUrl}/api/upload`, {
      method: 'POST',
      body: formData
    });
    
    if (!uploadResponse.ok) {
      throw new Error(`上传截图失败: ${uploadResponse.status}`);
    }
    
    const uploadResult = await uploadResponse.json();
    console.log('📸 Screenshot uploaded to data/images:', uploadResult);
    
    // 根据用户选择的操作类型处理
    let noteData;
    
    // 保存图片
    console.log('💾 User selected save image');
    noteData = {
      ...baseNoteData,
      title: `页面截图 - ${tab.title}`,
      content: `![截图](${uploadResult.url})\n\n页面URL: ${tab.url}\n截图时间: ${new Date().toLocaleString()}`,
      source: {
        type: 'chrome_extension_screenshot',
        url: tab.url,
        title: tab.title,
        screenshotUrl: uploadResult.url
      }
    };
    
    // 显示主题选择对话框，让用户可以编辑标题、内容、标签等
    console.log('📸 Showing theme dialog for user to edit note...');
    const themeResponse = await chrome.tabs.sendMessage(tab.id, {
      action: 'showThemeDialog',
      noteData: noteData
    });
    
    if (themeResponse && themeResponse.success) {
      const finalNoteData = themeResponse.noteData || noteData;
      await sendToNoteServer(finalNoteData, themeResponse.theme);
      
      const actionText = '截图';
      showNotification(`${actionText}笔记保存成功！`, `标题: ${finalNoteData.title}`, 'basic');
    } else {
      console.log('❌ 用户取消了截图笔记操作');
    }
    
  } catch (error) {
    console.error('📸 Screenshot capture failed:', error);
    showNotification('截图失败', error.message, 'basic');
  }
}

// 裁剪图片到指定区域（使用offscreen API）
async function cropImage(dataUrl, area) {
  try {
    // 检查是否已经创建了offscreen document
    const existingContexts = await chrome.runtime.getContexts({
      contextTypes: ['OFFSCREEN_DOCUMENT']
    });
    
    if (existingContexts.length === 0) {
      // 创建offscreen document
      await chrome.offscreen.createDocument({
        url: 'offscreen.html',
        reasons: ['BLOBS'],
        justification: 'Crop screenshot image'
      });
    }
    
    // 发送消息到offscreen document进行裁剪
    const result = await chrome.runtime.sendMessage({
      action: 'cropImage',
      dataUrl: dataUrl,
      area: area
    });
    
    if (result.success) {
      return result.dataUrl;
    } else {
      throw new Error(result.error || 'Failed to crop image');
    }
  } catch (error) {
    console.error('Crop image error:', error);
    // 如果裁剪失败，返回原图
    return dataUrl;
  }
}


// 显示通知的辅助函数
function showNotification(title, message, type = 'basic') {
  try {
    chrome.notifications.create({
      type: type,
      iconUrl: 'icons/icon48.png',
      title: title,
      message: message
    });
  } catch (error) {
    console.error('Failed to show notification:', error);
    // 如果通知失败，至少在控制台显示消息
    console.log(`Notification: ${title} - ${message}`);
  }
}

// 定期检查服务器状态
setInterval(async () => {
  const isConnected = await checkServerConnection();
  chrome.storage.local.set({ serverConnected: isConnected });
}, 30000); // 每30秒检查一次
