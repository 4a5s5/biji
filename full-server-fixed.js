// Smart Note Collector - Full Server with Complete CORS and OCR Fixes
// 完整版服务器，包含所有CORS和OCR修复

const express = require('express');
const path = require('path');
const fs = require('fs').promises;
const multer = require('multer');
const { v4: uuidv4 } = require('uuid');

class SmartNoteServer {
    constructor() {
        this.app = express();
        this.PORT = process.env.PORT || 8964;
        
        // 立即设置CORS - 必须是第一个中间件！
        this.setupCORS();
        
        // 然后设置其他中间件
        this.setupMiddleware();
        
        // 设置路由
        this.setupRoutes();
        
        // 设置OCR服务
        this.setupOCRService();
        
        // 初始化数据目录
        this.initializeData();
    }

    setupCORS() {
        // 最强CORS配置 - 处理所有跨域请求
        this.app.use((req, res, next) => {
            console.log(`[CORS] ${req.method} ${req.path} from ${req.headers.origin || 'no-origin'}`);
            
            // 设置最宽松的CORS头
            res.setHeader('Access-Control-Allow-Origin', '*');
            res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS, PATCH');
            res.setHeader('Access-Control-Allow-Headers', '*');
            res.setHeader('Access-Control-Allow-Credentials', 'true');
            res.setHeader('Access-Control-Max-Age', '86400');
            res.setHeader('Access-Control-Expose-Headers', '*');
            
            // 处理OPTIONS预检请求
            if (req.method === 'OPTIONS') {
                console.log('[CORS] Handling OPTIONS preflight request');
                res.sendStatus(200);
                return;
            }
            
            next();
        });
    }

    setupMiddleware() {
        // JSON解析
        this.app.use(express.json({ limit: '50mb' }));
        this.app.use(express.urlencoded({ extended: true, limit: '50mb' }));
        
        // 静态文件服务
        this.app.use('/images', express.static(path.join(__dirname, 'public/images')));
        this.app.use('/uploads', express.static(path.join(__dirname, 'uploads')));
        this.app.use(express.static(path.join(__dirname, 'public')));
        
        // 请求日志
        this.app.use((req, res, next) => {
            console.log(`[${new Date().toISOString()}] ${req.method} ${req.path}`);
            next();
        });
        
        // Multer配置用于文件上传
        const storage = multer.diskStorage({
            destination: async (req, file, cb) => {
                const uploadDir = path.join(__dirname, 'uploads');
                try {
                    await fs.mkdir(uploadDir, { recursive: true });
                    cb(null, uploadDir);
                } catch (error) {
                    cb(error);
                }
            },
            filename: (req, file, cb) => {
                const uniqueName = `${Date.now()}-${uuidv4()}${path.extname(file.originalname)}`;
                cb(null, uniqueName);
            }
        });
        
        this.upload = multer({ 
            storage,
            limits: { fileSize: 50 * 1024 * 1024 } // 50MB
        });
    }

    setupOCRService() {
        // OCR服务类
        class OCRService {
            constructor() {
                this.worker = null;
                this.isInitialized = false;
                this.initPromise = null;
            }

            async initialize() {
                if (this.isInitialized) return;
                if (this.initPromise) return this.initPromise;

                this.initPromise = this._doInitialize();
                await this.initPromise;
                this.isInitialized = true;
            }

            async _doInitialize() {
                try {
                    console.log('[OCR] Starting initialization...');
                    const { createWorker } = require('tesseract.js');
                    
                    this.worker = await createWorker({
                        logger: m => console.log('[OCR Progress]', m),
                        errorHandler: err => console.error('[OCR Error]', err)
                    });

                    // 加载中文语言包
                    await this.worker.loadLanguage('chi_sim');
                    await this.worker.initialize('chi_sim');
                    
                    console.log('[OCR] Successfully initialized with chi_sim');
                } catch (error) {
                    console.error('[OCR] Initialization failed:', error);
                    throw error;
                }
            }

            async recognize(imagePath, languages = 'chi_sim') {
                try {
                    await this.initialize();
                    
                    // 确保语言参数格式正确
                    if (Array.isArray(languages)) {
                        languages = languages.join('+');
                    }
                    
                    console.log(`[OCR] Starting recognition for: ${imagePath} with languages: ${languages}`);
                    
                    // 设置OCR参数
                    await this.worker.setParameters({
                        tessedit_char_whitelist: '',
                        preserve_interword_spaces: '1',
                        tessedit_pageseg_mode: '1'
                    });

                    const result = await this.worker.recognize(imagePath);
                    
                    console.log(`[OCR] Recognition complete. Confidence: ${result.data.confidence}`);
                    return {
                        text: result.data.text,
                        confidence: result.data.confidence,
                        language: languages
                    };
                } catch (error) {
                    console.error('[OCR] Recognition error:', error);
                    throw error;
                }
            }

            async terminate() {
                if (this.worker) {
                    await this.worker.terminate();
                    this.worker = null;
                    this.isInitialized = false;
                }
            }
        }

        // 创建OCR服务实例
        this.ocrService = new OCRService();
    }

    setupRoutes() {
        // 健康检查
        this.app.get('/health', (req, res) => {
            res.json({ 
                status: 'ok', 
                timestamp: new Date().toISOString(),
                cors: 'enabled',
                ocr: 'ready'
            });
        });

        // 文件上传接口 - 统一为 /api/upload
        this.app.post('/api/upload', this.upload.single('image'), async (req, res) => {
            try {
                console.log('[Upload] Received file upload request');
                
                if (!req.file) {
                    return res.status(400).json({ 
                        success: false, 
                        error: 'No file uploaded' 
                    });
                }

                const fileUrl = `/uploads/${req.file.filename}`;
                console.log(`[Upload] File saved: ${fileUrl}`);
                
                res.json({
                    success: true,
                    url: fileUrl,
                    filename: req.file.filename,
                    originalName: req.file.originalname,
                    size: req.file.size
                });
            } catch (error) {
                console.error('[Upload] Error:', error);
                res.status(500).json({ 
                    success: false, 
                    error: error.message 
                });
            }
        });

        // OCR识别接口
        this.app.post('/api/ocr', async (req, res) => {
            try {
                console.log('[OCR API] Received OCR request');
                const { image, language = 'chi_sim' } = req.body;
                
                if (!image) {
                    return res.status(400).json({ 
                        success: false, 
                        error: 'No image provided' 
                    });
                }

                // 处理base64图片
                let imagePath;
                if (image.startsWith('data:')) {
                    const base64Data = image.replace(/^data:image\/\w+;base64,/, '');
                    const buffer = Buffer.from(base64Data, 'base64');
                    const filename = `ocr-${Date.now()}-${uuidv4()}.png`;
                    imagePath = path.join(__dirname, 'uploads', filename);
                    
                    await fs.mkdir(path.dirname(imagePath), { recursive: true });
                    await fs.writeFile(imagePath, buffer);
                    console.log(`[OCR API] Saved base64 image to: ${imagePath}`);
                } else if (image.startsWith('/uploads/')) {
                    imagePath = path.join(__dirname, image);
                    console.log(`[OCR API] Using uploaded image: ${imagePath}`);
                } else {
                    imagePath = image;
                }

                // 检查文件是否存在
                try {
                    await fs.access(imagePath);
                } catch (err) {
                    console.error(`[OCR API] Image file not found: ${imagePath}`);
                    return res.status(404).json({ 
                        success: false, 
                        error: 'Image file not found' 
                    });
                }

                // 执行OCR识别
                const result = await this.ocrService.recognize(imagePath, language);
                
                res.json({
                    success: true,
                    text: result.text,
                    confidence: result.confidence,
                    language: result.language
                });

                // 清理临时文件
                if (image.startsWith('data:')) {
                    setTimeout(async () => {
                        try {
                            await fs.unlink(imagePath);
                            console.log(`[OCR API] Cleaned up temp file: ${imagePath}`);
                        } catch (err) {
                            console.error(`[OCR API] Failed to clean up: ${err.message}`);
                        }
                    }, 5000);
                }
            } catch (error) {
                console.error('[OCR API] Error:', error);
                res.status(500).json({ 
                    success: false, 
                    error: error.message 
                });
            }
        });

        // OCR recognize接口（兼容性）
        this.app.post('/api/ocr/recognize', async (req, res) => {
            console.log('[OCR] Redirecting to /api/ocr');
            return this.app._router.handle(
                Object.assign(req, { url: '/api/ocr', path: '/api/ocr' }), 
                res
            );
        });

        // 笔记相关API
        this.app.get('/api/notes', async (req, res) => {
            try {
                const notesPath = path.join(__dirname, 'data', 'notes.json');
                try {
                    await fs.access(notesPath);
                    const data = await fs.readFile(notesPath, 'utf8');
                    res.json(JSON.parse(data));
                } catch (err) {
                    res.json([]);
                }
            } catch (error) {
                console.error('[Notes] Error reading notes:', error);
                res.status(500).json({ error: error.message });
            }
        });

        this.app.post('/api/notes', async (req, res) => {
            try {
                const notesPath = path.join(__dirname, 'data', 'notes.json');
                const dataDir = path.dirname(notesPath);
                
                await fs.mkdir(dataDir, { recursive: true });
                
                let notes = [];
                try {
                    const data = await fs.readFile(notesPath, 'utf8');
                    notes = JSON.parse(data);
                } catch (err) {
                    // File doesn't exist, start with empty array
                }

                const newNote = {
                    id: uuidv4(),
                    ...req.body,
                    createdAt: new Date().toISOString()
                };
                
                notes.push(newNote);
                await fs.writeFile(notesPath, JSON.stringify(notes, null, 2));
                
                res.json(newNote);
            } catch (error) {
                console.error('[Notes] Error saving note:', error);
                res.status(500).json({ error: error.message });
            }
        });

        // 主题相关API
        this.app.get('/api/themes', async (req, res) => {
            try {
                const themesPath = path.join(__dirname, 'data', 'themes.json');
                try {
                    await fs.access(themesPath);
                    const data = await fs.readFile(themesPath, 'utf8');
                    res.json(JSON.parse(data));
                } catch (err) {
                    res.json({});
                }
            } catch (error) {
                console.error('[Themes] Error reading themes:', error);
                res.status(500).json({ error: error.message });
            }
        });

        this.app.post('/api/themes', async (req, res) => {
            try {
                const themesPath = path.join(__dirname, 'data', 'themes.json');
                const dataDir = path.dirname(themesPath);
                
                await fs.mkdir(dataDir, { recursive: true });
                await fs.writeFile(themesPath, JSON.stringify(req.body, null, 2));
                
                res.json({ success: true });
            } catch (error) {
                console.error('[Themes] Error saving themes:', error);
                res.status(500).json({ error: error.message });
            }
        });

        // 捕获所有未处理的路由
        this.app.use('*', (req, res) => {
            console.log(`[404] Not found: ${req.method} ${req.originalUrl}`);
            res.status(404).json({ 
                error: 'Not found',
                path: req.originalUrl,
                method: req.method
            });
        });

        // 错误处理中间件
        this.app.use((err, req, res, next) => {
            console.error('[Error]', err);
            res.status(500).json({ 
                error: 'Internal server error',
                message: err.message 
            });
        });
    }

    async initializeData() {
        try {
            const dirs = [
                path.join(__dirname, 'data'),
                path.join(__dirname, 'uploads'),
                path.join(__dirname, 'public'),
                path.join(__dirname, 'public', 'images')
            ];

            for (const dir of dirs) {
                await fs.mkdir(dir, { recursive: true });
                console.log(`[Init] Ensured directory: ${dir}`);
            }

            // 初始化OCR服务
            console.log('[Init] Pre-initializing OCR service...');
            await this.ocrService.initialize().catch(err => {
                console.error('[Init] OCR pre-initialization failed:', err);
            });
        } catch (error) {
            console.error('[Init] Error creating directories:', error);
        }
    }

    start() {
        this.app.listen(this.PORT, '0.0.0.0', () => {
            console.log(`[Server] Smart Note Collector running on port ${this.PORT}`);
            console.log(`[Server] CORS: Enabled for all origins`);
            console.log(`[Server] OCR: Ready with chi_sim (Chinese)`);
            console.log(`[Server] Upload endpoint: /api/upload`);
            console.log(`[Server] OCR endpoint: /api/ocr`);
        });
    }
}

// 启动服务器
const server = new SmartNoteServer();
server.start();

// 优雅关闭
process.on('SIGTERM', async () => {
    console.log('[Server] SIGTERM received, shutting down gracefully...');
    if (server.ocrService) {
        await server.ocrService.terminate();
    }
    process.exit(0);
});

process.on('SIGINT', async () => {
    console.log('[Server] SIGINT received, shutting down gracefully...');
    if (server.ocrService) {
        await server.ocrService.terminate();
    }
    process.exit(0);
});
