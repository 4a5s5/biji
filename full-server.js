// Smart Note Collector - Full Server with Import Support
// 完整版服务器，支持导入功能

const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs').promises;

// 核心模块
const NotesManager = require('./src/core/NotesManager');
const ThemesManager = require('./src/core/ThemesManager');

// API模块
const QuickImportAPI = require('./src/api/quick-import');
const ExportAPI = require('./src/api/export');
const ImportAPI = require('./src/api/import');

const PORT = process.env.PORT || 3000;
const HOST = process.env.HOST || 'localhost';

class SmartNoteServer {
    constructor() {
        this.app = express();
        this.notesManager = new NotesManager();
        this.themesManager = new ThemesManager();
        
        this.setupMiddleware();
        this.setupAPIs();
        this.setupRoutes();
        this.ensureDirectories();
    }
    
    setupMiddleware() {
        // CORS支持 - 支持Chrome插件和所有来源
        this.app.use(cors({
            origin: function (origin, callback) {
                // 允许没有origin的请求（如移动应用）
                if (!origin) return callback(null, true);

                // 允许的来源列表
                const allowedOrigins = [
                    'http://localhost:3000',
                    'http://127.0.0.1:3000',
                    'https://localhost:3000',
                    'https://127.0.0.1:3000'
                ];

                // 允许Chrome插件
                if (origin.startsWith('chrome-extension://')) {
                    return callback(null, true);
                }

                // 允许本地开发
                if (origin.includes('localhost') || origin.includes('127.0.0.1')) {
                    return callback(null, true);
                }

                // 允许列表中的来源
                if (allowedOrigins.includes(origin)) {
                    return callback(null, true);
                }

                // 对于Chrome插件在网页中的请求，允许所有HTTPS来源
                // 这是因为Chrome插件会从当前网页的上下文发起请求
                if (origin.startsWith('https://')) {
                    return callback(null, true);
                }

                // 允许HTTP来源（开发环境）
                if (origin.startsWith('http://')) {
                    return callback(null, true);
                }

                callback(null, true); // 开发环境允许所有来源
            },
            credentials: true,
            methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
            allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
            optionsSuccessStatus: 200
        }));

        // 额外的CORS处理中间件
        this.app.use((req, res, next) => {
            const origin = req.headers.origin;

            // 设置CORS头部
            if (origin) {
                res.header('Access-Control-Allow-Origin', origin);
            } else {
                res.header('Access-Control-Allow-Origin', '*');
            }

            res.header('Access-Control-Allow-Credentials', 'true');
            res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
            res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With');
            res.header('Access-Control-Max-Age', '86400'); // 24小时

            // 处理预检请求
            if (req.method === 'OPTIONS') {
                res.status(200).end();
                return;
            }

            next();
        });
        
        // JSON解析
        this.app.use(express.json({ limit: '50mb' }));
        this.app.use(express.urlencoded({ extended: true, limit: '50mb' }));
        
        // 静态文件服务
        this.app.use(express.static(path.join(__dirname, 'src/frontend')));
        
        // 上传目录
        this.app.use('/uploads', express.static(path.join(__dirname, 'uploads')));
        
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
        // 健康检查
        this.app.get('/api/health', (req, res) => {
            res.json({ 
                status: 'ok', 
                timestamp: new Date().toISOString(),
                version: '1.0.0'
            });
        });
        
        // 笔记相关API
        this.app.get('/api/notes', async (req, res) => {
            try {
                const { theme, search, tags, limit, offset } = req.query;
                const limitNum = parseInt(limit) || 20;
                const offsetNum = parseInt(offset) || 0;

                const result = await this.notesManager.getNotes({
                    theme,
                    search,
                    tags,
                    limit: limitNum,
                    offset: offsetNum
                });

                // 获取总数用于分页计算
                const totalNotes = await this.notesManager.getTotalCount({ theme, search, tags });
                const totalPages = Math.ceil(totalNotes / limitNum);

                res.json({
                    success: true,
                    notes: result,
                    total: totalNotes,
                    totalPages: totalPages,
                    currentPage: Math.floor(offsetNum / limitNum) + 1,
                    itemsPerPage: limitNum
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
        const dirs = [
            'data',
            'data/images',
            'uploads',
            'exports'
        ];
        
        for (const dir of dirs) {
            try {
                await fs.mkdir(path.join(__dirname, dir), { recursive: true });
            } catch (error) {
                if (error.code !== 'EEXIST') {
                    console.error(`Failed to create directory ${dir}:`, error);
                }
            }
        }
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
            console.log(`🚀 Smart Note Collector Server is running on http://${HOST}:${PORT}`);
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
const server = new SmartNoteServer();
server.start();

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
