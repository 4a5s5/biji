const puppeteer = require('puppeteer');

// 爬取页面内容API
module.exports = async (req, res) => {
    try {
        const { url } = req.body;
        
        if (!url) {
            return res.status(400).json({ error: '请提供URL' });
        }
        
        console.log('🕷️ Starting crawl for:', url);
        
        // 使用puppeteer爬取页面
        const browser = await puppeteer.launch({
            headless: 'new',
            args: ['--no-sandbox', '--disable-setuid-sandbox']
        });
        
        try {
            const page = await browser.newPage();
            
            // 设置用户代理
            await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36');
            
            // 访问页面
            await page.goto(url, {
                waitUntil: 'networkidle2',
                timeout: 30000
            });
            
            // 提取页面信息
            const pageData = await page.evaluate(() => {
                // 获取标题
                const title = document.title || '';
                
                // 获取描述
                const description = document.querySelector('meta[name="description"]')?.content || 
                                   document.querySelector('meta[property="og:description"]')?.content || '';
                
                // 获取主要内容
                const contentSelectors = [
                    'main', 'article', '[role="main"]', '.content', '#content', '.post', '.entry-content'
                ];
                
                let content = '';
                for (const selector of contentSelectors) {
                    const element = document.querySelector(selector);
                    if (element) {
                        content = element.innerText || element.textContent || '';
                        break;
                    }
                }
                
                // 如果没有找到特定容器，获取body的文本
                if (!content) {
                    content = document.body.innerText || document.body.textContent || '';
                }
                
                // 清理内容
                content = content.trim().substring(0, 5000); // 限制长度
                
                // 获取图片
                const images = Array.from(document.querySelectorAll('img'))
                    .slice(0, 10)
                    .map(img => ({
                        src: img.src,
                        alt: img.alt || ''
                    }))
                    .filter(img => img.src);
                
                // 获取链接
                const links = Array.from(document.querySelectorAll('a'))
                    .slice(0, 20)
                    .map(a => ({
                        url: a.href,
                        text: (a.innerText || a.textContent || '').trim()
                    }))
                    .filter(link => link.url && link.url.startsWith('http'));
                
                return {
                    title,
                    description,
                    content,
                    images,
                    links
                };
            });
            
            await browser.close();
            
            console.log('✅ Crawl completed successfully');
            res.json({
                success: true,
                ...pageData
            });
            
        } catch (error) {
            await browser.close();
            throw error;
        }
        
    } catch (error) {
        console.error('❌ Crawl error:', error);
        res.status(500).json({ 
            error: '爬取失败', 
            message: error.message 
        });
    }
};