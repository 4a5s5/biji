// 网页爬虫管理器 - 爬取网页内容
const axios = require('axios');
const cheerio = require('cheerio');
const { URL } = require('url');

class WebCrawler {
    constructor(options = {}) {
        this.onCrawlComplete = options.onCrawlComplete || (() => {});
        this.timeout = options.timeout || 30000; // 30秒超时
        this.userAgent = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36';
        this.maxContentLength = options.maxContentLength || 10000; // 最大内容长度
        this.maxImageCount = options.maxImageCount || 10; // 最大图片数量
        this.maxLinkCount = options.maxLinkCount || 20; // 最大链接数量
    }
    
    // 爬取网页
    async crawl(url) {
        try {
            console.log('开始爬取网页:', url);
            
            // 验证URL
            if (!this.isValidUrl(url)) {
                throw new Error('无效的URL地址');
            }
            
            // 获取网页内容
            const response = await this.fetchPage(url);
            
            // 解析网页内容
            const crawlData = await this.parsePage(response.data, url);
            
            console.log('网页爬取完成:', crawlData.title || url);
            
            // 触发完成回调
            this.onCrawlComplete(crawlData);
            
            return crawlData;
            
        } catch (error) {
            console.error('网页爬取失败:', error);
            throw error;
        }
    }
    
    // 验证URL
    isValidUrl(urlString) {
        try {
            const url = new URL(urlString);
            return url.protocol === 'http:' || url.protocol === 'https:';
        } catch (error) {
            return false;
        }
    }
    
    // 获取网页内容
    async fetchPage(url) {
        try {
            const response = await axios.get(url, {
                timeout: this.timeout,
                headers: {
                    'User-Agent': this.userAgent,
                    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
                    'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
                    'Accept-Encoding': 'gzip, deflate',
                    'Connection': 'keep-alive',
                    'Upgrade-Insecure-Requests': '1'
                },
                maxRedirects: 5,
                validateStatus: (status) => status < 400
            });
            
            return response;
        } catch (error) {
            if (error.response) {
                throw new Error(`HTTP错误: ${error.response.status} ${error.response.statusText}`);
            } else if (error.code === 'ENOTFOUND') {
                throw new Error('域名无法解析，请检查网址是否正确');
            } else if (error.code === 'ETIMEDOUT') {
                throw new Error('请求超时，请检查网络连接');
            } else {
                throw new Error(`请求失败: ${error.message}`);
            }
        }
    }
    
    // 解析网页内容
    async parsePage(html, url) {
        try {
            const $ = cheerio.load(html);
            const parsedUrl = new URL(url);
            
            const crawlData = {
                url: url,
                title: this.extractTitle($),
                description: this.extractDescription($),
                keywords: this.extractKeywords($),
                content: this.extractMainContent($),
                images: this.extractImages($, parsedUrl),
                links: this.extractLinks($, parsedUrl),
                metadata: this.extractMetadata($),
                timestamp: new Date().toISOString()
            };
            
            return crawlData;
        } catch (error) {
            console.error('解析网页内容失败:', error);
            throw new Error('网页内容解析失败');
        }
    }
    
    // 提取标题
    extractTitle($) {
        let title = $('title').text().trim();
        
        if (!title) {
            title = $('h1').first().text().trim();
        }
        
        if (!title) {
            title = $('meta[property="og:title"]').attr('content');
        }
        
        return title || '无标题';
    }
    
    // 提取描述
    extractDescription($) {
        let description = $('meta[name="description"]').attr('content');
        
        if (!description) {
            description = $('meta[property="og:description"]').attr('content');
        }
        
        if (!description) {
            // 尝试从第一个段落提取
            const firstParagraph = $('p').first().text().trim();
            if (firstParagraph.length > 10) {
                description = firstParagraph.substring(0, 200);
            }
        }
        
        return description || '';
    }
    
    // 提取关键词
    extractKeywords($) {
        const keywords = $('meta[name="keywords"]').attr('content');
        return keywords || '';
    }
    
    // 提取主要内容
    extractMainContent($) {
        let content = '';
        
        // 尝试不同的内容选择器
        const contentSelectors = [
            'main',
            'article',
            '.content',
            '.main-content',
            '.post-content',
            '.entry-content',
            '#content',
            '#main'
        ];
        
        for (const selector of contentSelectors) {
            const element = $(selector).first();
            if (element.length > 0) {
                content = this.cleanText(element.text());
                if (content.length > 100) {
                    break;
                }
            }
        }
        
        // 如果没有找到主要内容，尝试提取所有段落
        if (!content || content.length < 100) {
            const paragraphs = [];
            $('p').each((index, element) => {
                const text = $(element).text().trim();
                if (text.length > 20) {
                    paragraphs.push(text);
                }
            });
            content = paragraphs.join('\\n\\n');
        }
        
        // 限制内容长度
        if (content.length > this.maxContentLength) {
            content = content.substring(0, this.maxContentLength) + '...';
        }
        
        return content;
    }
    
    // 提取图片
    extractImages($, baseUrl) {
        const images = [];
        
        $('img').each((index, element) => {
            if (images.length >= this.maxImageCount) return false;
            
            const img = $(element);
            let src = img.attr('src') || img.attr('data-src') || img.attr('data-original');
            
            if (src) {
                // 处理相对URL
                if (src.startsWith('//')) {
                    src = baseUrl.protocol + src;
                } else if (src.startsWith('/')) {
                    src = `${baseUrl.protocol}//${baseUrl.host}${src}`;
                } else if (!src.startsWith('http')) {
                    src = `${baseUrl.protocol}//${baseUrl.host}/${src}`;
                }
                
                const alt = img.attr('alt') || '';
                const title = img.attr('title') || '';
                
                images.push({
                    src: src,
                    alt: alt,
                    title: title,
                    width: img.attr('width') || '',
                    height: img.attr('height') || ''
                });
            }
        });
        
        return images;
    }
    
    // 提取链接
    extractLinks($, baseUrl) {
        const links = [];
        const seenUrls = new Set();
        
        $('a[href]').each((index, element) => {
            if (links.length >= this.maxLinkCount) return false;
            
            const link = $(element);
            let href = link.attr('href');
            
            if (href) {
                // 处理相对URL
                if (href.startsWith('//')) {
                    href = baseUrl.protocol + href;
                } else if (href.startsWith('/')) {
                    href = `${baseUrl.protocol}//${baseUrl.host}${href}`;
                } else if (!href.startsWith('http') && !href.startsWith('mailto:') && !href.startsWith('tel:')) {
                    href = `${baseUrl.protocol}//${baseUrl.host}/${href}`;
                }
                
                // 跳过锚点链接和邮件链接
                if (href.startsWith('#') || href.startsWith('mailto:') || href.startsWith('tel:')) {
                    return;
                }
                
                // 避免重复链接
                if (seenUrls.has(href)) {
                    return;
                }
                seenUrls.add(href);
                
                const text = link.text().trim();
                const title = link.attr('title') || '';
                
                if (text) {
                    links.push({
                        url: href,
                        text: text.substring(0, 100), // 限制文本长度
                        title: title
                    });
                }
            }
        });
        
        return links;
    }
    
    // 提取元数据
    extractMetadata($) {
        const metadata = {};
        
        // Open Graph数据
        $('meta[property^="og:"]').each((index, element) => {
            const property = $(element).attr('property');
            const content = $(element).attr('content');
            if (property && content) {
                metadata[property] = content;
            }
        });
        
        // Twitter Card数据
        $('meta[name^="twitter:"]').each((index, element) => {
            const name = $(element).attr('name');
            const content = $(element).attr('content');
            if (name && content) {
                metadata[name] = content;
            }
        });
        
        // 其他元数据
        const metaTags = ['author', 'generator', 'robots', 'viewport'];
        metaTags.forEach(tagName => {
            const content = $(`meta[name="${tagName}"]`).attr('content');
            if (content) {
                metadata[tagName] = content;
            }
        });
        
        return metadata;
    }
    
    // 清理文本
    cleanText(text) {
        return text
            .replace(/\\s+/g, ' ') // 将多个空白字符替换为单个空格
            .replace(/\\n\\s*\\n/g, '\\n\\n') // 规范化换行
            .trim();
    }
    
    // 批量爬取多个URL
    async crawlMultiple(urls) {
        const results = [];
        
        for (const url of urls) {
            try {
                const result = await this.crawl(url);
                results.push({ url, success: true, data: result });
            } catch (error) {
                results.push({ url, success: false, error: error.message });
            }
        }
        
        return results;
    }
    
    // 检查URL是否可访问
    async checkUrl(url) {
        try {
            const response = await axios.head(url, {
                timeout: 10000,
                headers: {
                    'User-Agent': this.userAgent
                },
                maxRedirects: 5
            });
            
            return {
                accessible: true,
                status: response.status,
                contentType: response.headers['content-type'],
                contentLength: response.headers['content-length']
            };
        } catch (error) {
            return {
                accessible: false,
                error: error.message
            };
        }
    }
    
    // 销毁爬虫
    destroy() {
        // 清理资源
        console.log('网页爬虫已销毁');
    }
}

module.exports = WebCrawler;