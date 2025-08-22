// 简化版服务器 - 用于测试基础功能（不依赖外部包）
const http = require('http');
const fs = require('fs');
const path = require('path');
const url = require('url');

const PORT = 3000;
const HOST = 'localhost';

// MIME类型映射
const mimeTypes = {
    '.html': 'text/html',
    '.css': 'text/css',
    '.js': 'application/javascript',
    '.json': 'application/json',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.gif': 'image/gif',
    '.svg': 'image/svg+xml',
    '.ico': 'image/x-icon'
};

// 确保数据目录和文件存在
function ensureDataFiles() {
    const dataDir = path.join(__dirname, 'data');
    const imagesDir = path.join(dataDir, 'images');
    
    if (!fs.existsSync(dataDir)) {
        fs.mkdirSync(dataDir, { recursive: true });
    }
    
    if (!fs.existsSync(imagesDir)) {
        fs.mkdirSync(imagesDir, { recursive: true });
    }
    
    const notesFile = path.join(dataDir, 'notes.json');
    if (!fs.existsSync(notesFile)) {
        fs.writeFileSync(notesFile, JSON.stringify({ notes: [] }, null, 2));
    }
    
    const themesFile = path.join(dataDir, 'themes.json');
    if (!fs.existsSync(themesFile)) {
        const defaultThemes = {
            themes: [
                {
                    id: "default",
                    name: "默认主题",
                    color: "#3498db",
                    icon: "default",
                    created_at: new Date().toISOString(),
                    note_count: 0
                },
                {
                    id: "work",
                    name: "工作笔记",
                    color: "#e74c3c",
                    icon: "work",
                    created_at: new Date().toISOString(),
                    note_count: 0
                },
                {
                    id: "study",
                    name: "学习资料",
                    color: "#2ecc71",
                    icon: "study",
                    created_at: new Date().toISOString(),
                    note_count: 0
                }
            ]
        };
        fs.writeFileSync(themesFile, JSON.stringify(defaultThemes, null, 2));
    }
}

// 读取文件内容
function readFile(filePath) {
    try {
        return fs.readFileSync(filePath, 'utf8');
    } catch (error) {
        return null;
    }
}

// 写入文件内容
function writeFile(filePath, content) {
    try {
        fs.writeFileSync(filePath, content, 'utf8');
        return true;
    } catch (error) {
        console.error('写入文件失败:', error);
        return false;
    }
}

// 更新主题笔记计数
function updateThemeCount(themeId, delta) {
    try {
        const themesFile = path.join(__dirname, 'data', 'themes.json');
        const themesData = JSON.parse(readFile(themesFile) || '{"themes":[]}');
        const themeIndex = themesData.themes.findIndex(t => t.id === themeId);

        if (themeIndex !== -1) {
            themesData.themes[themeIndex].note_count = Math.max(0,
                (themesData.themes[themeIndex].note_count || 0) + delta);
            writeFile(themesFile, JSON.stringify(themesData, null, 2));
        }
    } catch (error) {
        console.error('更新主题计数失败:', error);
    }
}

// 处理静态文件请求
function serveStaticFile(req, res, filePath) {
    const ext = path.extname(filePath);
    const contentType = mimeTypes[ext] || 'application/octet-stream';
    
    fs.readFile(filePath, (err, data) => {
        if (err) {
            res.writeHead(404, { 'Content-Type': 'text/plain' });
            res.end('File not found');
            return;
        }
        
        res.writeHead(200, { 'Content-Type': contentType });
        res.end(data);
    });
}

// 处理API请求
function handleApiRequest(req, res, pathname) {
    // 设置CORS头
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    
    if (req.method === 'OPTIONS') {
        res.writeHead(200);
        res.end();
        return;
    }
    
    // 健康检查
    if (pathname === '/api/health') {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
            status: 'ok',
            timestamp: new Date().toISOString(),
            version: '1.0.0'
        }));
        return;
    }
    
    // 主题API
    if (pathname === '/api/themes' && req.method === 'GET') {
        const themesData = readFile(path.join(__dirname, 'data', 'themes.json'));
        if (themesData) {
            const themes = JSON.parse(themesData);
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify(themes.themes));
        } else {
            res.writeHead(500, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: '读取主题数据失败' }));
        }
        return;
    }
    
    // 笔记API
    if (pathname === '/api/notes' && req.method === 'GET') {
        const notesData = readFile(path.join(__dirname, 'data', 'notes.json'));
        if (notesData) {
            const notes = JSON.parse(notesData);
            let filteredNotes = notes.notes;

            // 解析查询参数
            const parsedUrl = url.parse(req.url, true);
            const query = parsedUrl.query;

            // 按主题筛选
            if (query.theme && query.theme !== 'all') {
                filteredNotes = filteredNotes.filter(note => note.theme === query.theme);
            }

            // 搜索功能
            if (query.search) {
                const searchLower = query.search.toLowerCase();
                filteredNotes = filteredNotes.filter(note =>
                    note.title.toLowerCase().includes(searchLower) ||
                    note.content.toLowerCase().includes(searchLower) ||
                    (note.tags && note.tags.some(tag => tag.toLowerCase().includes(searchLower)))
                );
            }

            // 排序（按创建时间倒序）
            filteredNotes.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

            const response = {
                notes: filteredNotes,
                total: filteredNotes.length,
                page: 1,
                totalPages: 1
            };
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify(response));
        } else {
            res.writeHead(500, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: '读取笔记数据失败' }));
        }
        return;
    }
    
    // 创建笔记API
    if (pathname === '/api/notes' && req.method === 'POST') {
        let body = '';
        req.on('data', chunk => {
            body += chunk.toString();
        });

        req.on('end', () => {
            try {
                const noteData = JSON.parse(body);

                // 验证必填字段
                if (!noteData.title || !noteData.content) {
                    res.writeHead(400, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ error: '标题和内容不能为空' }));
                    return;
                }

                const notesFile = path.join(__dirname, 'data', 'notes.json');
                const notesData = JSON.parse(readFile(notesFile) || '{"notes":[]}');

                // 处理标签
                let tags = [];
                if (noteData.tags) {
                    if (typeof noteData.tags === 'string') {
                        tags = JSON.parse(noteData.tags);
                    } else {
                        tags = noteData.tags;
                    }
                }

                const newNote = {
                    id: Date.now().toString(),
                    title: noteData.title.trim(),
                    content: noteData.content.trim(),
                    type: 'text',
                    theme: noteData.theme || 'default',
                    created_at: new Date().toISOString(),
                    updated_at: new Date().toISOString(),
                    tags: tags,
                    source: null
                };

                notesData.notes.push(newNote);

                if (writeFile(notesFile, JSON.stringify(notesData, null, 2))) {
                    // 更新主题计数
                    updateThemeCount(newNote.theme, 1);

                    res.writeHead(201, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify(newNote));
                } else {
                    res.writeHead(500, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ error: '保存笔记失败' }));
                }
            } catch (error) {
                console.error('创建笔记错误:', error);
                res.writeHead(400, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: '无效的请求数据: ' + error.message }));
            }
        });
        return;
    }

    // 创建主题API
    if (pathname === '/api/themes' && req.method === 'POST') {
        let body = '';
        req.on('data', chunk => {
            body += chunk.toString();
        });

        req.on('end', () => {
            try {
                const themeData = JSON.parse(body);

                // 验证必填字段
                if (!themeData.name) {
                    res.writeHead(400, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ error: '主题名称不能为空' }));
                    return;
                }

                const themesFile = path.join(__dirname, 'data', 'themes.json');
                const themesData = JSON.parse(readFile(themesFile) || '{"themes":[]}');

                // 检查主题名称是否已存在
                const existingTheme = themesData.themes.find(t => t.name === themeData.name.trim());
                if (existingTheme) {
                    res.writeHead(400, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ error: '主题名称已存在' }));
                    return;
                }

                const newTheme = {
                    id: Date.now().toString(),
                    name: themeData.name.trim(),
                    color: themeData.color || '#3498db',
                    icon: themeData.icon || 'default',
                    created_at: new Date().toISOString(),
                    note_count: 0
                };

                themesData.themes.push(newTheme);

                if (writeFile(themesFile, JSON.stringify(themesData, null, 2))) {
                    res.writeHead(201, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify(newTheme));
                } else {
                    res.writeHead(500, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ error: '保存主题失败' }));
                }
            } catch (error) {
                console.error('创建主题错误:', error);
                res.writeHead(400, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: '无效的请求数据: ' + error.message }));
            }
        });
        return;
    }

    // 删除笔记API
    if (pathname.startsWith('/api/notes/') && req.method === 'DELETE') {
        const noteId = pathname.split('/')[3];

        try {
            const notesFile = path.join(__dirname, 'data', 'notes.json');
            const notesData = JSON.parse(readFile(notesFile) || '{"notes":[]}');
            const noteIndex = notesData.notes.findIndex(n => n.id === noteId);

            if (noteIndex === -1) {
                res.writeHead(404, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: '笔记不存在' }));
                return;
            }

            const note = notesData.notes[noteIndex];
            notesData.notes.splice(noteIndex, 1);

            if (writeFile(notesFile, JSON.stringify(notesData, null, 2))) {
                // 更新主题计数
                updateThemeCount(note.theme, -1);

                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ message: '笔记删除成功' }));
            } else {
                res.writeHead(500, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: '删除笔记失败' }));
            }
        } catch (error) {
            console.error('删除笔记错误:', error);
            res.writeHead(500, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: '删除笔记失败: ' + error.message }));
        }
        return;
    }

    // 删除主题API
    if (pathname.startsWith('/api/themes/') && req.method === 'DELETE') {
        const themeId = pathname.split('/')[3];

        // 不允许删除默认主题
        if (themeId === 'default') {
            res.writeHead(400, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: '不能删除默认主题' }));
            return;
        }

        try {
            const themesFile = path.join(__dirname, 'data', 'themes.json');
            const themesData = JSON.parse(readFile(themesFile) || '{"themes":[]}');
            const themeIndex = themesData.themes.findIndex(t => t.id === themeId);

            if (themeIndex === -1) {
                res.writeHead(404, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: '主题不存在' }));
                return;
            }

            // 将该主题下的所有笔记移动到默认主题
            const notesFile = path.join(__dirname, 'data', 'notes.json');
            const notesData = JSON.parse(readFile(notesFile) || '{"notes":[]}');
            let movedCount = 0;

            notesData.notes.forEach(note => {
                if (note.theme === themeId) {
                    note.theme = 'default';
                    movedCount++;
                }
            });

            if (movedCount > 0) {
                writeFile(notesFile, JSON.stringify(notesData, null, 2));
            }

            // 删除主题
            themesData.themes.splice(themeIndex, 1);

            if (writeFile(themesFile, JSON.stringify(themesData, null, 2))) {
                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({
                    message: '主题删除成功',
                    movedNotes: movedCount
                }));
            } else {
                res.writeHead(500, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: '删除主题失败' }));
            }
        } catch (error) {
            console.error('删除主题错误:', error);
            res.writeHead(500, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: '删除主题失败: ' + error.message }));
        }
        return;
    }

    // 快速导入API
    if (pathname === '/api/quick-import' && req.method === 'POST') {
        let body = '';
        req.on('data', chunk => {
            body += chunk.toString();
        });

        req.on('end', () => {
            try {
                const importData = JSON.parse(body);

                // 验证必填字段
                if (!importData.content) {
                    res.writeHead(400, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ error: '内容不能为空' }));
                    return;
                }

                const notesFile = path.join(__dirname, 'data', 'notes.json');
                const notesData = JSON.parse(readFile(notesFile) || '{"notes":[]}');

                const newNote = {
                    id: Date.now().toString(),
                    title: importData.title || '快速导入笔记',
                    content: importData.content.trim(),
                    type: 'text',
                    theme: importData.theme || 'default',
                    created_at: new Date().toISOString(),
                    updated_at: new Date().toISOString(),
                    tags: importData.tags || [],
                    source: importData.source || null
                };

                notesData.notes.push(newNote);

                if (writeFile(notesFile, JSON.stringify(notesData, null, 2))) {
                    // 更新主题计数
                    updateThemeCount(newNote.theme, 1);

                    res.writeHead(201, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify(newNote));
                } else {
                    res.writeHead(500, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ error: '保存笔记失败' }));
                }
            } catch (error) {
                console.error('快速导入错误:', error);
                res.writeHead(400, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: '无效的请求数据: ' + error.message }));
            }
        });
        return;
    }

    // AI配置API
    if (pathname === '/api/config/ai' && req.method === 'GET') {
        try {
            const configFile = path.join(__dirname, 'config', 'app.json');
            const configData = readFile(configFile);
            
            if (configData) {
                const config = JSON.parse(configData);
                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify(config.ai || {}));
            } else {
                res.writeHead(500, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: '读取配置失败' }));
            }
        } catch (error) {
            console.error('获取AI配置错误:', error);
            res.writeHead(500, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: '获取AI配置失败: ' + error.message }));
        }
        return;
    }

    // 默认404响应
    res.writeHead(404, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'API endpoint not found' }));
}

// 创建HTTP服务器
const server = http.createServer((req, res) => {
    const parsedUrl = url.parse(req.url, true);
    const pathname = parsedUrl.pathname;
    
    console.log(`${req.method} ${pathname}`);
    
    // API请求
    if (pathname.startsWith('/api/')) {
        handleApiRequest(req, res, pathname);
        return;
    }
    
    // 根路径重定向到index.html
    if (pathname === '/') {
        const indexPath = path.join(__dirname, 'src', 'frontend', 'index.html');
        serveStaticFile(req, res, indexPath);
        return;
    }

    // 快速导入页面
    if (pathname === '/quick-import') {
        const quickImportPath = path.join(__dirname, 'src', 'frontend', 'quick-import.html');
        serveStaticFile(req, res, quickImportPath);
        return;
    }
    
    // 图片文件
    if (pathname.startsWith('/images/')) {
        const imagePath = path.join(__dirname, 'data', pathname);
        serveStaticFile(req, res, imagePath);
        return;
    }
    
    // 静态文件
    const filePath = path.join(__dirname, 'src', 'frontend', pathname);
    
    // 检查文件是否存在
    fs.access(filePath, fs.constants.F_OK, (err) => {
        if (err) {
            res.writeHead(404, { 'Content-Type': 'text/plain' });
            res.end('File not found');
            return;
        }
        
        serveStaticFile(req, res, filePath);
    });
});

// 启动服务器
ensureDataFiles();

server.listen(PORT, HOST, () => {
    console.log('Smart Note Collector Server is running on http://localhost:' + PORT);
    console.log('Environment: development (simplified)');
    console.log('Press Ctrl+C to stop the server');
});

// 优雅关闭
process.on('SIGTERM', () => {
    console.log('SIGTERM received, shutting down gracefully');
    server.close(() => {
        process.exit(0);
    });
});

process.on('SIGINT', () => {
    console.log('\nSIGINT received, shutting down gracefully');
    server.close(() => {
        process.exit(0);
    });
});
