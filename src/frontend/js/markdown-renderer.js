// Markdown渲染器
// 用于在笔记阅览中正确显示Markdown内容，包括图片

class MarkdownRenderer {
    constructor() {
        // 获取服务器基础URL
        this.serverUrl = this.getServerUrl();
    }

    getServerUrl() {
        // 从当前页面URL推断服务器地址
        const currentUrl = window.location.origin;
        return currentUrl;
    }

    /**
     * 渲染Markdown内容为HTML
     * @param {string} content - Markdown内容
     * @returns {string} - HTML内容
     */
    render(content) {
        if (!content) return '';
        
        let html = content;
        
        // 1. 处理图片 - 支持相对路径和绝对路径
        // 匹配 ![alt text](url)
        html = html.replace(/!\[([^\]]*)\]\(([^)]+)\)/g, (match, alt, url) => {
            // 如果是相对路径，添加服务器基础URL
            let finalUrl = url;
            if (url.startsWith('/')) {
                finalUrl = this.serverUrl + url;
            } else if (!url.startsWith('http://') && !url.startsWith('https://')) {
                finalUrl = this.serverUrl + '/' + url;
            }
            
            console.log('Markdown image URL:', url, '-> Final URL:', finalUrl);
            
            return `<img src="${finalUrl}" alt="${alt || '图片'}" style="max-width: 100%; height: auto; display: block; margin: 10px 0;" onerror="this.style.display='none'; console.error('Failed to load image:', '${finalUrl}');" />`;
        });
        
        // 2. 处理标题
        html = html.replace(/^### (.*$)/gim, '<h3>$1</h3>');
        html = html.replace(/^## (.*$)/gim, '<h2>$1</h2>');
        html = html.replace(/^# (.*$)/gim, '<h1>$1</h1>');
        
        // 3. 处理粗体
        html = html.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
        
        // 4. 处理斜体
        html = html.replace(/\*([^*]+)\*/g, '<em>$1</em>');
        
        // 5. 处理链接 [text](url)
        html = html.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank">$1</a>');
        
        // 6. 处理代码块
        html = html.replace(/```([^`]*)```/g, '<pre><code>$1</code></pre>');
        
        // 7. 处理行内代码
        html = html.replace(/`([^`]+)`/g, '<code>$1</code>');
        
        // 8. 处理列表
        html = html.replace(/^\* (.+)$/gim, '<li>$1</li>');
        html = html.replace(/(<li>.*<\/li>)/s, '<ul>$1</ul>');
        
        // 9. 处理换行
        html = html.replace(/\n/g, '<br>');
        
        return html;
    }
    
    /**
     * 处理图片URL，确保使用正确的服务器地址
     */
    processImageUrl(url) {
        if (!url) return '';
        
        // 如果已经是完整URL，直接返回
        if (url.startsWith('http://') || url.startsWith('https://')) {
            return url;
        }
        
        // 如果是相对路径，添加服务器地址
        if (url.startsWith('/')) {
            return this.serverUrl + url;
        }
        
        return this.serverUrl + '/' + url;
    }
}

// 创建全局实例
window.markdownRenderer = new MarkdownRenderer();
