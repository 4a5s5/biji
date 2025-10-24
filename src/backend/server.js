const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs-extra');

// 导入路由
const notesRoutes = require('./routes/notes');
const themesRoutes = require('./routes/themes');
const aiPresetsRoutes = require('./routes/ai-presets');

// 导入配置
const config = require('../../config/app.json');

const app = express();
const PORT = process.env.PORT || config.app.port || 3000;

// 中间件
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// 静态文件服务
app.use(express.static(path.join(__dirname, '../frontend')));
app.use('/images', express.static(path.join(__dirname, '../../data/images')));

// API路由
app.use('/api/notes', notesRoutes);
app.use('/api/themes', themesRoutes);
app.use('/api/ai-presets', aiPresetsRoutes);

// 根路由 - 返回主页面
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, '../frontend/index.html'));
});

// 健康检查接口
app.get('/api/health', (req, res) => {
    res.json({
        status: 'ok',
        timestamp: new Date().toISOString(),
        version: config.app.version
    });
});

// 错误处理中间件
app.use((err, req, res, next) => {
    console.error('Error:', err);
    res.status(500).json({
        error: 'Internal Server Error',
        message: err.message
    });
});

// 404处理
app.use((req, res) => {
    res.status(404).json({
        error: 'Not Found',
        message: 'The requested resource was not found'
    });
});

// 确保数据目录存在
async function ensureDataDirectories() {
    try {
        await fs.ensureDir(config.storage.dataPath);
        await fs.ensureDir(config.storage.imagesPath);
        
        // 确保数据文件存在
        const notesFile = config.storage.notesFile;
        const themesFile = config.storage.themesFile;
        
        if (!await fs.pathExists(notesFile)) {
            await fs.writeJson(notesFile, { notes: [] });
        }
        
        if (!await fs.pathExists(themesFile)) {
            const defaultThemes = {
                themes: [
                    {
                        id: "default",
                        name: "默认主题",
                        color: "#3498db",
                        icon: "default",
                        created_at: new Date().toISOString(),
                        note_count: 0
                    }
                ]
            };
            await fs.writeJson(themesFile, defaultThemes);
        }
        
        console.log('Data directories and files initialized successfully');
    } catch (error) {
        console.error('Error initializing data directories:', error);
    }
}

// 启动服务器
async function startServer() {
    try {
        await ensureDataDirectories();
        
        app.listen(PORT, '0.0.0.0', () => {
            console.log(`Smart Note Collector Server is running on http://0.0.0.0:${PORT}`);
            console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
        });
    } catch (error) {
        console.error('Failed to start server:', error);
        process.exit(1);
    }
}

// 优雅关闭
process.on('SIGTERM', () => {
    console.log('SIGTERM received, shutting down gracefully');
    process.exit(0);
});

process.on('SIGINT', () => {
    console.log('SIGINT received, shutting down gracefully');
    process.exit(0);
});

startServer();

module.exports = app;
