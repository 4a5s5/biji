// Smart Note Collector - Full Server with Import Support
// 完整版服务器，支持导入功能

const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs').promises;
const multer = require('multer');
const { v4: uuidv4 } = require('uuid');
const crawlAPI = require('./src/api/crawl'); // 爬取API
// 所有修复已内联到此文件中，不再需要外部依赖

// 核心模块
const NotesManager = require('./src/core/NotesManager');
const ThemesManager = require('./src/core/ThemesManager');
const DatabaseManager = require('./src/core/DatabaseManager');

// API模块
const QuickImportAPI = require('./src/api/quick-import');
const ExportAPI = require('./src/api/export');
const ImportAPI = require('./src/api/import');

const PORT = process.env.PORT || 3000;
const HOST = process.env.HOST || '0.0.0.0';

class SmartNoteServer {
    constructor() {
        this.app = express();
        
        // 必须在最开始设置CORS，在所有其他中间件之前
        this.setupCORS();
        
        this.notesManager = new NotesManager();
        this.themesManager = new ThemesManager();
        this.dbManager = new DatabaseManager();
        
        this.setupMiddleware();
        this.setupAPIs();
        this.setupRoutes();
        this.ensureDirectories();
    }

    async initializeManagers() {
        try {
            console.log('🔧 Initializing managers...');
            await this.notesManager.ensureInitialized();
            await this.themesManager.ensureInitialized();
            await this.dbManager.initialize();
            console.log('✅ Managers initialized successfully');
        } catch (error) {
            console.error('❌ Failed to initialize managers:', error);
            // 继续启动，使用回退模式
        }
    }
    
    setupCORS() {
        // 单独的CORS设置方法，确保在所有中间件之前执行
        console.log('🌐 Setting up CORS (first priority)...');
        
        // 方法1: 使用cors库
        const cors = require('cors');
        this.app.use(cors({
            origin: function(origin, callback) {
                // 允许所有来源
                callback(null, true);
            },
            credentials: true,
            methods: '*',
            allowedHeaders: '*',
            exposedHeaders: '*',
            optionsSuccessStatus: 200,
            preflightContinue: false
        }));
        
        // 方法52: 手动设置备份
        this.app.use((req, res, next) => {
            const origin = req.headers.origin;
            console.log(`🌐 Request from: ${origin || 'no-origin'} - ${req.method} ${req.path}`);
            
            // 设置所有必要的CORS头
            res.header('Access-Control-Allow-Origin', origin || '*');
            res.header('Access-Control-Allow-Credentials', 'true');
            res.header('Access-Control-Allow-Methods', '*');
            res.header('Access-Control-Allow-Headers', '*');
            res.header('Access-Control-Expose-Headers', '*');
            res.header('Access-Control-Max-Age', '86400');
            
            // 处理OPTIONS预检请求
            if (req.method === 'OPTIONS') {
                console.log('🌐 Handling OPTIONS preflight');
                return res.status(200).end();
            }
            
            next();
        });
        
        console.log('✅ CORS setup complete');
    }
    
    setupMiddleware() {
        
        // JSON解析
        this.app.use(express.json({ limit: '50mb' }));
        this.app.use(express.urlencoded({ extended: true, limit: '50mb' }));
        
        // 静态文件服务
        this.app.use(express.static(path.join(__dirname, 'src/frontend')));
        
        // 内联静态文件配置
        const setupStaticFiles = () => {
            const directories = [
                { route: '/uploads', path: path.join(__dirname, 'uploads') },
                { route: '/uploads', path: path.join(__dirname, 'data', 'images') },
                { route: '/data/images', path: path.join(__dirname, 'data', 'images') },
                { route: '/images', path: path.join(__dirname, 'data', 'images') }
            ];
            
            directories.forEach(({ route, path: dirPath }) => {
                this.app.use(route, express.static(dirPath, {
                    fallthrough: true,
                    setHeaders: (res) => {
                        res.set('Access-Control-Allow-Origin', '*');
                        res.set('Cache-Control', 'public, max-age=3600');
                    }
                }));
            });
        };
        setupStaticFiles();
        
        // 处理多文件上传（修复multer的配置问题）
        const multer = require('multer');
        const uploadStorage = multer.diskStorage({
            destination: async (req, file, cb) => {
                // 从FormData中获取targetDir
                const targetDir = req.body && req.body.targetDir ? req.body.targetDir : 'uploads';
                const uploadDir = path.join(__dirname, targetDir);
                
                // 确保目录存在
                try {
                    await fs.access(uploadDir);
                } catch {
                    await fs.mkdir(uploadDir, { recursive: true });
                    console.log(`📁 Created upload directory: ${targetDir}`);
                }
                
                cb(null, uploadDir);
            },
            filename: (req, file, cb) => {
                const timestamp = Date.now();
                const ext = path.extname(file.originalname);
                cb(null, `upload-${timestamp}${ext}`);
            }
        });
        this.upload = multer({ 
            storage: uploadStorage,
            limits: { fileSize: 10 * 1024 * 1024 } // 10MB 限制
        });
        
        // 请求日志
        this.app.use((req, res, next) => {
            console.log(`${new Date().toISOString()} - ${req.method} ${req.url}`);
            next();
        });
    }
    
    setupAPIs() {
        // 初始化API模块
        this.quickImportAPI = new QuickImportAPI(this.notesManager, this.themesManager);
        this.exportAPI = new ExportAPI(this.notesManager, this.themesManager);
        this.importAPI = new ImportAPI(this.notesManager, this.themesManager);
        
        // 注册API路由
        this.quickImportAPI.registerRoutes(this.app);
        this.exportAPI.registerRoutes(this.app);
        this.importAPI.registerRoutes(this.app);
    }
    
    setupRoutes() {
        // API健康检查
        this.app.get('/api/health', (req, res) => {
            res.json({ 
                status: 'ok', 
                timestamp: new Date().toISOString(),
                version: '1.0.0'
            });
        });

        // AI配置接口
        this.app.get('/api/config/ai', (req, res) => {
            res.json({
                enabled: false,
                provider: 'none',
                model: '',
                apiKey: ''
            });
        });
        
        // 笔记相关API
        this.app.get('/api/notes', async (req, res) => {
            try {
                const { theme, theme_id, search, tags, page, limit } = req.query;
                const pageNum = parseInt(page) || 1;
                const limitNum = parseInt(limit) || 20;

                const result = await this.notesManager.getNotes({
                    theme: theme_id || theme,
                    search,
                    tags,
                    page: pageNum,
                    limit: limitNum
                });

                res.json({
                    success: true,
                    notes: result.notes || result,
                    total: result.total || result.length,
                    totalPages: result.totalPages || Math.ceil((result.total || result.length) / limitNum),
                    currentPage: result.page || pageNum,
                    itemsPerPage: result.limit || limitNum
                });
            } catch (error) {
                console.error('Get notes error:', error);
                res.status(500).json({ error: error.message });
            }
        });
        
        this.app.get('/api/notes/:id', async (req, res) => {
            try {
                const note = await this.notesManager.getNoteById(req.params.id);
                if (!note) {
                    return res.status(404).json({ error: '笔记不存在' });
                }
                res.json({ success: true, note });
            } catch (error) {
                console.error('Get note error:', error);
                res.status(500).json({ error: error.message });
            }
        });
        
        this.app.post('/api/notes', async (req, res) => {
            try {
                const note = await this.notesManager.createNote(req.body);
                res.status(201).json({ success: true, note });
            } catch (error) {
                console.error('Create note error:', error);
                res.status(500).json({ error: error.message });
            }
        });
        
        this.app.put('/api/notes/:id', async (req, res) => {
            try {
                const note = await this.notesManager.updateNote(req.params.id, req.body);
                res.json({ success: true, note });
            } catch (error) {
                console.error('Update note error:', error);
                res.status(500).json({ error: error.message });
            }
        });
        
        this.app.delete('/api/notes/:id', async (req, res) => {
            try {
                await this.notesManager.deleteNote(req.params.id);
                res.json({ success: true });
            } catch (error) {
                console.error('Delete note error:', error);
                res.status(500).json({ error: error.message });
            }
        });
        
        // AI预设相关API
        this.app.get('/api/ai-presets', async (req, res) => {
            try {
                const presets = await this.dbManager.getAllAIPresets();
                res.json({ presets });
            } catch (error) {
                console.error('获取AI预设失败:', error);
                res.status(500).json({ 
                    error: '获取AI预设失败', 
                    message: error.message 
                });
            }
        });

        this.app.get('/api/ai-presets/default', async (req, res) => {
            try {
                const defaultPreset = await this.dbManager.getDefaultAIPreset();
                res.json({ defaultPreset });
            } catch (error) {
                console.error('获取默认AI预设失败:', error);
                res.status(500).json({ 
                    error: '获取默认AI预设失败', 
                    message: error.message 
                });
            }
        });

        this.app.get('/api/ai-presets/:id', async (req, res) => {
            try {
                const preset = await this.dbManager.getAIPresetById(req.params.id);
                if (!preset) {
                    return res.status(404).json({ error: 'AI预设不存在' });
                }
                res.json({ preset });
            } catch (error) {
                console.error('获取AI预设失败:', error);
                res.status(500).json({ 
                    error: '获取AI预设失败', 
                    message: error.message 
                });
            }
        });

        this.app.post('/api/ai-presets', async (req, res) => {
            try {
                console.log('接收到创建预设请求:', req.body);
                const { name, prompt, is_default } = req.body;
                
                if (!name || !prompt) {
                    console.error('预设创建失败 - 缺少必要字段:', { name, prompt });
                    return res.status(400).json({ 
                        error: '缺少必要字段', 
                        message: '预设名称和内容不能为空' 
                    });
                }

                const presetData = {
                    name: name.trim(),
                    prompt: prompt.trim(),
                    is_default: Boolean(is_default)
                };

                console.log('准备创建预设:', presetData);
                const result = await this.dbManager.createAIPreset(presetData);
                console.log('预设创建成功:', result);
                
                if (is_default) {
                    await this.dbManager.setDefaultAIPreset(result.id);
                }
                
                res.status(201).json({ 
                    message: 'AI预设创建成功', 
                    preset: { id: result.id, ...presetData }
                });
            } catch (error) {
                console.error('创建AI预设失败:', error);
                res.status(500).json({ 
                    error: '创建AI预设失败', 
                    message: error.message 
                });
            }
        });

        this.app.put('/api/ai-presets/:id', async (req, res) => {
            try {
                const { name, prompt, is_default } = req.body;
                
                if (!name || !prompt) {
                    return res.status(400).json({ 
                        error: '缺少必要字段', 
                        message: '预设名称和内容不能为空' 
                    });
                }

                const presetData = {
                    name: name.trim(),
                    prompt: prompt.trim(),
                    is_default: Boolean(is_default)
                };

                await this.dbManager.updateAIPreset(req.params.id, presetData);
                
                if (is_default) {
                    await this.dbManager.setDefaultAIPreset(req.params.id);
                }
                
                res.json({ 
                    message: 'AI预设更新成功', 
                    preset: { id: req.params.id, ...presetData }
                });
            } catch (error) {
                console.error('更新AI预设失败:', error);
                res.status(500).json({ 
                    error: '更新AI预设失败', 
                    message: error.message 
                });
            }
        });

        this.app.put('/api/ai-presets/:id/default', async (req, res) => {
            try {
                await this.dbManager.setDefaultAIPreset(req.params.id);
                res.json({ message: '默认预设设置成功' });
            } catch (error) {
                console.error('设置默认预设失败:', error);
                res.status(500).json({ 
                    error: '设置默认预设失败', 
                    message: error.message 
                });
            }
        });

        this.app.delete('/api/ai-presets/default', async (req, res) => {
            try {
                await this.dbManager.clearDefaultAIPreset();
                res.json({ message: '默认预设清除成功' });
            } catch (error) {
                console.error('清除默认预设失败:', error);
                res.status(500).json({ 
                    error: '清除默认预设失败', 
                    message: error.message 
                });
            }
        });

        this.app.delete('/api/ai-presets/:id', async (req, res) => {
            try {
                await this.dbManager.deleteAIPreset(req.params.id);
                res.json({ message: 'AI预设删除成功' });
            } catch (error) {
                console.error('删除AI预设失败:', error);
                res.status(500).json({ 
                    error: '删除AI预设失败', 
                    message: error.message 
                });
            }
        });

        // 内联图片上传API
        this.app.post('/api/upload', this.upload.single('image'), async (req, res) => {
            try {
                if (!req.file) {
                    return res.status(400).json({ error: '没有上传文件' });
                }
                
                const targetDir = req.body.targetDir || 'data/images';
                const imagesDir = path.join(__dirname, targetDir);
                await fs.mkdir(imagesDir, { recursive: true });
                
                const filename = req.file.filename;
                const fileUrl = `/uploads/${filename}`;
                
                // 复制到data/images目录
                const targetPath = path.join(imagesDir, filename);
                if (req.file.path !== targetPath) {
                    await fs.copyFile(req.file.path, targetPath).catch(() => {});
                }
                
                res.json({
                    success: true,
                    url: fileUrl,
                    filename: filename,
                    originalName: req.file.originalname,
                    size: req.file.size
                });
            } catch (error) {
                console.error('❌ Upload error:', error);
                res.status(500).json({ error: error.message });
            }
        });
        
        // 内联修复后的OCR API
        const setupFixedOCR = () => {
            const ocrHandler = async (req, res) => {
                try {
                    const { imagePath, imageUrl, imageData, url, path: imgPath, language = 'chi_sim' } = req.body;
                    const imageInput = imagePath || imageUrl || imageData || url || imgPath;
                    
                    if (!imageInput) {
                        return res.status(400).json({ 
                            success: false,
                            error: '缺少图片参数'
                        });
                    }
                    
                    console.log('🔍 OCR Request:', imageInput, 'Language:', language);
                    
                    let resolvedPath = imageInput;
                    
                    // 处理URL路径
                    if (typeof imageInput === 'string' && imageInput.startsWith('/')) {
                        const filename = path.basename(imageInput);
                        const possiblePaths = [
                            path.join(__dirname, 'data', 'images', filename),
                            path.join(__dirname, 'uploads', filename),
                            path.join(__dirname, imageInput.substring(1))
                        ];
                        
                        for (const p of possiblePaths) {
                            try {
                                await fs.access(p);
                                resolvedPath = p;
                                console.log('✅ Found image at:', p);
                                break;
                            } catch (err) {
                                // 文件不存在，继续检查下一个路径
                            }
                        }
                    }
                    
                    // 确保OCR服务已初始化
                    if (!this.ocrService.initialized || this.ocrService.currentLanguage !== language) {
                        console.log('🔍 Initializing OCR for:', language);
                        try {
                            await this.ocrService.initialize(language);
                        } catch (initError) {
                            console.error('❌ OCR initialization failed:', initError.message);
                            // 尝试使用默认英文
                            if (language !== 'eng') {
                                console.log('🔄 Retrying with English...');
                                await this.ocrService.initialize('eng');
                            } else {
                                throw initError;
                            }
                        }
                    }
                    
                    // 执行OCR
                    const startTime = Date.now();
                    const ocrResult = await this.ocrService.recognizeText(resolvedPath, { language });
                    const duration = Date.now() - startTime;
                    
                    console.log('✅ OCR completed in', duration, 'ms, confidence:', ocrResult.confidence + '%');
                    
                    res.json({
                        success: true,
                        text: ocrResult.text || '',
                        confidence: ocrResult.confidence || 0,
                        language: ocrResult.language || language,
                        lines: ocrResult.lines || [],
                        stats: ocrResult.stats || {},
                        processingTime: duration
                    });
                    
                } catch (error) {
                    console.error('❌ OCR Error:', error);
                    res.status(500).json({
                        success: false,
                        error: 'OCR识别失败',
                        message: error.message
                    });
                }
            };
            
            // 注册所有OCR端点
            this.app.post('/api/ocr', ocrHandler);
            this.app.post('/api/ocr/recognize', ocrHandler);
            
            // OCR状态检查
            this.app.get('/api/ocr/status', (req, res) => {
                res.json({
                    success: true,
                    status: {
                        initialized: this.ocrService.initialized || false,
                        currentLanguage: this.ocrService.currentLanguage || 'not set',
                        worker: this.ocrService.worker ? 'ready' : 'not ready'
                    }
                });
            });
        };
        
        setupFixedOCR();
        
        // OCR语言检测API
        this.app.post('/api/ocr/detect-language', async (req, res) => {
            try {
                const { imageUrl, imageData } = req.body;
                
                if (!imageUrl && !imageData) {
                    return res.status(400).json({ error: '缺少图片URL或图片数据' });
                }
                
                const imagePath = imageUrl || imageData;
                const detectedLang = await this.ocrService.detectLanguage(imagePath);
                
                res.json({
                    success: true,
                    language: detectedLang,
                    languageName: this.ocrService.getSupportedLanguages()[detectedLang] || detectedLang
                });
                
            } catch (error) {
                console.error('Language detection error:', error);
                res.status(500).json({ 
                    error: '语言检测失败',
                    message: error.message 
                });
            }
        });
        
        // 获取支持的OCR语言列表
        this.app.get('/api/ocr/languages', (req, res) => {
            res.json({
                success: true,
                languages: this.ocrService.getSupportedLanguages()
            });
        });
        
        // 网页内容爬取API
        this.app.post('/api/crawl-content', async (req, res) => {
            try {
                const { url, options = {} } = req.body;
                
                if (!url) {
                    return res.status(400).json({ error: '缺少URL参数' });
                }
                
                // 这里使用简单的fetch来获取网页内容
                // 实际生产环境建议使用 puppeteer 或 playwright 来处理动态内容
                const fetch = (await import('node-fetch')).default;
                
                console.log('🕷️ Crawling URL:', url);
                const response = await fetch(url, {
                    headers: {
                        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
                    }
                });
                
                if (!response.ok) {
                    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
                }
                
                const html = await response.text();
                
                // 简单的HTML解析（生产环境建议使用 cheerio 或 jsdom）
                const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
                const title = titleMatch ? titleMatch[1].trim() : '';
                
                const descMatch = html.match(/<meta[^>]*name=["']description["'][^>]*content=["']([^"']+)["']/i);
                const description = descMatch ? descMatch[1].trim() : '';
                
                // 提取纯文本内容（移除HTML标签）
                let textContent = html
                    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
                    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
                    .replace(/<[^>]+>/g, ' ')
                    .replace(/\s+/g, ' ')
                    .trim();
                
                // 限制内容长度
                if (textContent.length > 5000) {
                    textContent = textContent.substring(0, 5000) + '...';
                }
                
                // 提取图片（最多10个）
                const imgMatches = html.match(/<img[^>]*src=["']([^"']+)["'][^>]*>/gi) || [];
                const images = imgMatches.slice(0, 10).map(imgTag => {
                    const srcMatch = imgTag.match(/src=["']([^"']+)["']/i);
                    const altMatch = imgTag.match(/alt=["']([^"']+)["']/i);
                    return {
                        src: srcMatch ? srcMatch[1] : '',
                        alt: altMatch ? altMatch[1] : ''
                    };
                }).filter(img => img.src);
                
                // 提取链接（最多20个）
                const linkMatches = html.match(/<a[^>]*href=["']([^"']+)["'][^>]*>([^<]*)<\/a>/gi) || [];
                const links = linkMatches.slice(0, 20).map(linkTag => {
                    const hrefMatch = linkTag.match(/href=["']([^"']+)["']/i);
                    const textMatch = linkTag.match(/>([^<]+)<\/a>/i);
                    return {
                        url: hrefMatch ? hrefMatch[1] : '',
                        text: textMatch ? textMatch[1].trim() : ''
                    };
                }).filter(link => link.url && !link.url.startsWith('#'));
                
                res.json({
                    success: true,
                    url: url,
                    title: title,
                    description: description,
                    content: textContent,
                    images: images,
                    links: links,
                    crawledAt: new Date().toISOString()
                });
                
            } catch (error) {
                console.error('Crawl content error:', error);
                res.status(500).json({ 
                    error: '爬取失败', 
                    message: error.message 
                });
            }
        });
        
        // 主题相关API
        this.app.get('/api/themes', async (req, res) => {
            try {
                const themes = await this.themesManager.getThemes();
                res.json(themes);
            } catch (error) {
                console.error('Get themes error:', error);
                res.status(500).json({ error: error.message });
            }
        });
        
        this.app.post('/api/themes', async (req, res) => {
            try {
                const theme = await this.themesManager.createTheme(req.body);
                res.status(201).json(theme);
            } catch (error) {
                console.error('Create theme error:', error);
                res.status(500).json({ error: error.message });
            }
        });
        
        this.app.put('/api/themes/:id', async (req, res) => {
            try {
                const theme = await this.themesManager.updateTheme(req.params.id, req.body);
                res.json(theme);
            } catch (error) {
                console.error('Update theme error:', error);
                res.status(500).json({ error: error.message });
            }
        });

        // 批量导出API
        this.app.post('/api/export/custom/:format', async (req, res) => {
            try {
                const { format } = req.params;
                const { noteIds, title } = req.body;

                if (!noteIds || !Array.isArray(noteIds) || noteIds.length === 0) {
                    return res.status(400).json({ error: '请选择要导出的笔记' });
                }

                if (!['json', 'txt', 'md'].includes(format)) {
                    return res.status(400).json({ error: '不支持的导出格式' });
                }

                // 获取选中的笔记
                const notes = await this.notesManager.getNotes();
                const selectedNotes = notes.filter(note => noteIds.includes(note.id));

                if (selectedNotes.length === 0) {
                    return res.status(404).json({ error: '未找到要导出的笔记' });
                }

                let exportContent = '';
                const exportTitle = title || `批量导出_${selectedNotes.length}条笔记`;

                switch (format) {
                    case 'json':
                        exportContent = JSON.stringify({
                            title: exportTitle,
                            exportDate: new Date().toISOString(),
                            noteCount: selectedNotes.length,
                            notes: selectedNotes
                        }, null, 2);
                        break;

                    case 'txt':
                        exportContent = `${exportTitle}\n导出时间: ${new Date().toLocaleString('zh-CN')}\n笔记数量: ${selectedNotes.length}\n\n`;
                        exportContent += '='.repeat(50) + '\n\n';

                        selectedNotes.forEach((note, index) => {
                            exportContent += `${index + 1}. ${note.title}\n`;
                            exportContent += `创建时间: ${new Date(note.created_at).toLocaleString('zh-CN')}\n`;
                            exportContent += `主题: ${note.theme}\n`;
                            if (note.tags && note.tags.length > 0) {
                                exportContent += `标签: ${note.tags.join(', ')}\n`;
                            }
                            exportContent += `内容:\n${note.content}\n\n`;
                            exportContent += '-'.repeat(30) + '\n\n';
                        });
                        break;

                    case 'md':
                        exportContent = `# ${exportTitle}\n\n`;
                        exportContent += `**导出时间**: ${new Date().toLocaleString('zh-CN')}  \n`;
                        exportContent += `**笔记数量**: ${selectedNotes.length}\n\n`;
                        exportContent += '---\n\n';

                        selectedNotes.forEach((note, index) => {
                            exportContent += `## ${index + 1}. ${note.title}\n\n`;
                            exportContent += `**创建时间**: ${new Date(note.created_at).toLocaleString('zh-CN')}  \n`;
                            exportContent += `**主题**: ${note.theme}  \n`;
                            if (note.tags && note.tags.length > 0) {
                                exportContent += `**标签**: ${note.tags.join(', ')}  \n`;
                            }
                            exportContent += '\n**内容**:\n\n';
                            exportContent += `${note.content}\n\n`;
                            exportContent += '---\n\n';
                        });
                        break;
                }

                res.setHeader('Content-Type', format === 'json' ? 'application/json' : 'text/plain; charset=utf-8');
                res.send(exportContent);

            } catch (error) {
                console.error('Batch export error:', error);
                res.status(500).json({ error: error.message });
            }
        });
        
        this.app.delete('/api/themes/:id', async (req, res) => {
            try {
                await this.themesManager.deleteTheme(req.params.id);
                res.json({ success: true });
            } catch (error) {
                console.error('Delete theme error:', error);
                res.status(500).json({ error: error.message });
            }
        });
        
        // 搜索API
        this.app.get('/api/search', async (req, res) => {
            try {
                const { q, theme } = req.query;
                const results = await this.notesManager.searchNotes(q, { theme });
                res.json({ success: true, results });
            } catch (error) {
                console.error('Search error:', error);
                res.status(500).json({ error: error.message });
            }
        });
        
        // 统计API
        this.app.get('/api/stats', async (req, res) => {
            try {
                const stats = await this.getStats();
                res.json({ success: true, stats });
            } catch (error) {
                console.error('Stats error:', error);
                res.status(500).json({ error: error.message });
            }
        });
        
        // 导入页面路由
        this.app.get('/import', (req, res) => {
            res.sendFile(path.join(__dirname, 'src/frontend/import.html'));
        });
        
        // 默认路由
        this.app.get('/', (req, res) => {
            res.sendFile(path.join(__dirname, 'src/frontend/index.html'));
        });
        
        // 内联图片调试API
        this.app.get('/api/debug/images', async (req, res) => {
            try {
                const directories = ['uploads', 'data/images'];
                const result = {};
                
                for (const dir of directories) {
                    const fullPath = path.join(__dirname, dir);
                    try {
                        const files = await fs.readdir(fullPath);
                        result[dir] = {
                            exists: true,
                            path: fullPath,
                            files: files.slice(0, 10),
                            total: files.length
                        };
                    } catch {
                        result[dir] = {
                            exists: false,
                            path: fullPath,
                            files: [],
                            total: 0
                        };
                    }
                }
                
                res.json({
                    success: true,
                    directories: result
                });
            } catch (error) {
                res.status(500).json({ error: error.message });
            }
        });
        
        // 404处理
        this.app.use((req, res) => {
            res.status(404).json({ error: '页面不存在' });
        });
        
        // 错误处理
        this.app.use((error, req, res, next) => {
            console.error('Server error:', error);
            res.status(500).json({ error: '服务器内部错误' });
        });
    }
    
    async ensureDirectories() {
        const directories = [
            path.join(__dirname, 'uploads'),
            path.join(__dirname, 'exports')
        ];

        for (const dir of directories) {
            try {
                await fs.mkdir(dir, { recursive: true });
            } catch (error) {
                console.error(`Failed to create directory ${dir}:`, error.message);
            }
        }
        
        // 数据目录由DatabaseManager处理，避免重复创建
        console.log('📁 Directory initialization completed');
    }
    
    async getStats() {
        try {
            const notes = await this.notesManager.getNotes();
            const themes = await this.themesManager.getThemes();
            
            const stats = {
                totalNotes: notes.length,
                totalThemes: themes.length,
                notesByTheme: {},
                recentNotes: notes.slice(0, 5).map(note => ({
                    id: note.id,
                    title: note.title,
                    createdAt: note.createdAt
                }))
            };
            
            // 按主题统计笔记数量
            notes.forEach(note => {
                const theme = note.theme || 'default';
                stats.notesByTheme[theme] = (stats.notesByTheme[theme] || 0) + 1;
            });
            
            return stats;
        } catch (error) {
            console.error('Failed to get stats:', error);
            return {
                totalNotes: 0,
                totalThemes: 0,
                notesByTheme: {},
                recentNotes: []
            };
        }
    }
    
    start() {
        this.app.listen(PORT, HOST, () => {
            console.log(`🚀 Smart Note Collector Server full is running on http://${HOST}:${PORT}`);
            console.log(`📝 Main App: http://${HOST}:${PORT}`);
            console.log(`📥 Import Page: http://${HOST}:${PORT}/import`);
            console.log(`🔧 API Health: http://${HOST}:${PORT}/api/health`);
            console.log('');
            console.log('Features available:');
            console.log('✅ Note Management');
            console.log('✅ Theme Management');
            console.log('✅ Quick Import');
            console.log('✅ Export (JSON, TXT, MD)');
            console.log('✅ File Import (TXT, MD, JSON)');
            console.log('✅ URL Import');
            console.log('✅ Mobile Support');
            console.log('✅ Chrome Extension Support');
        });
    }
}

// 启动服务器
async function startServer() {
    try {
        const server = new SmartNoteServer();
        await server.initializeManagers();
        
        
        server.start();
    } catch (error) {
        console.error('❌ Failed to start server:', error);
        process.exit(1);
    }
}

startServer();

// 优雅关闭
process.on('SIGINT', () => {
    console.log('\n🛑 Shutting down Smart Note Collector Server...');
    process.exit(0);
});

process.on('SIGTERM', () => {
    console.log('\n🛑 Shutting down Smart Note Collector Server...');
    process.exit(0);
});

module.exports = SmartNoteServer;
