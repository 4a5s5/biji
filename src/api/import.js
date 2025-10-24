// Smart Note Collector - Import API
// 导入功能的后端API实现

const fs = require('fs').promises;
const path = require('path');
const multer = require('multer');
// const axios = require('axios');
// const cheerio = require('cheerio');

class ImportAPI {
    constructor(notesManager, themesManager) {
        this.notesManager = notesManager;
        this.themesManager = themesManager;
        
        // 配置文件上传
        this.upload = multer({
            dest: 'uploads/',
            limits: {
                fileSize: 10 * 1024 * 1024, // 10MB
                files: 10 // 最多10个文件
            },
            fileFilter: (req, file, cb) => {
                const allowedTypes = ['.txt', '.md', '.json'];
                const ext = path.extname(file.originalname).toLowerCase();
                
                if (allowedTypes.includes(ext)) {
                    cb(null, true);
                } else {
                    cb(new Error('不支持的文件格式'), false);
                }
            }
        });
    }
    
    // 注册路由
    registerRoutes(app) {
        // 文件导入
        app.post('/api/import/files', this.upload.array('files'), this.handleFileImport.bind(this));
        
        // URL导入
        app.post('/api/import/url', this.handleUrlImport.bind(this));
        
        // 文本导入
        app.post('/api/import/text', this.handleTextImport.bind(this));
        
        // 批量导入
        app.post('/api/import/batch', this.handleBatchImport.bind(this));
        
        // 获取导入历史
        app.get('/api/import/history', this.getImportHistory.bind(this));
    }
    
    // 处理文件导入
    async handleFileImport(req, res) {
        try {
            const files = req.files;
            const { theme, createNewTheme } = req.body;
            
            if (!files || files.length === 0) {
                return res.status(400).json({ error: '没有上传文件' });
            }
            
            const results = [];
            
            for (const file of files) {
                try {
                    const result = await this.processFile(file, theme, createNewTheme === 'true');
                    
                    // 检查是否是备份文件的处理结果
                    if (result && result.type === 'backup') {
                        // 备份文件包含多个结果
                        results.push({
                            filename: file.originalname,
                            status: 'success',
                            data: result,
                            isBackupFile: true,
                            themesProcessed: result.themesProcessed,
                            notesProcessed: result.notesProcessed,
                            summary: result.summary
                        });
                    } else {
                        // 普通文件
                        results.push({
                            filename: file.originalname,
                            status: 'success',
                            data: result
                        });
                    }
                } catch (error) {
                    console.error('File processing error:', error);
                    results.push({
                        filename: file.originalname,
                        status: 'error',
                        error: error.message
                    });
                } finally {
                    // 清理临时文件
                    try {
                        await fs.unlink(file.path);
                    } catch (unlinkError) {
                        console.error('Failed to delete temp file:', unlinkError);
                    }
                }
            }
            
            // 记录导入历史
            await this.recordImportHistory({
                type: 'file',
                fileCount: files.length,
                results: results,
                timestamp: new Date().toISOString()
            });
            
            res.json({
                success: true,
                results: results,
                summary: {
                    total: results.length,
                    success: results.filter(r => r.status === 'success').length,
                    failed: results.filter(r => r.status === 'error').length
                }
            });
            
        } catch (error) {
            console.error('File import error:', error);
            res.status(500).json({ error: '文件导入失败: ' + error.message });
        }
    }
    
    // 处理单个文件
    async processFile(file, themeId, createNewTheme) {
        const content = await fs.readFile(file.path, 'utf-8');
        const extension = path.extname(file.originalname).toLowerCase();
        
        let noteData;
        
        switch (extension) {
            case '.txt':
                noteData = this.parseTxtFile(file.originalname, content);
                break;
            case '.md':
                noteData = this.parseMarkdownFile(file.originalname, content);
                break;
            case '.json':
                noteData = this.parseJsonFile(content);
                break;
            default:
                throw new Error('不支持的文件格式');
        }
        
        // 检查是否是备份文件格式
        if (noteData.isBackupFile) {
            return await this.processBackupFile(noteData);
        }
        
        // 确定主题
        let finalThemeId = themeId;
        if (createNewTheme) {
            const themeName = path.basename(file.originalname, path.extname(file.originalname));
            const newTheme = await this.themesManager.createTheme({ name: themeName });
            finalThemeId = newTheme.id;
        }
        
        // 创建笔记
        if (Array.isArray(noteData)) {
            // 批量笔记
            const results = [];
            for (const note of noteData) {
                const result = await this.notesManager.createNote({
                    ...note,
                    theme: finalThemeId,
                    tags: [...(note.tags || []), '文件导入']
                });
                results.push(result);
            }
            return results;
        } else {
            // 单个笔记
            return await this.notesManager.createNote({
                ...noteData,
                theme: finalThemeId,
                tags: [...(noteData.tags || []), '文件导入']
            });
        }
    }
    
    // 处理备份文件
    async processBackupFile(backupData) {
        const { themes, notes } = backupData;
        const results = [];
        
        // 创建主题名称到ID的映射
        const themeNameToId = new Map();
        
        // 首先处理主题，按名称创建或查找现有主题
        for (const themeData of themes) {
            try {
                // 跳过默认主题
                if (themeData.id === 'default') {
                    themeNameToId.set(themeData.name, 'default');
                    continue;
                }
                
                // 检查是否已存在同名主题
                const existingThemes = await this.themesManager.getAllThemes();
                const existingTheme = existingThemes.find(t => t.name === themeData.name);
                
                if (existingTheme) {
                    // 使用现有主题
                    themeNameToId.set(themeData.name, existingTheme.id);
                    console.log(`使用现有主题: ${themeData.name} (${existingTheme.id})`);
                } else {
                    // 创建新主题，使用原始名称
                    const newTheme = await this.themesManager.createTheme({
                        name: themeData.name,
                        description: themeData.description || '',
                        color: themeData.color || '#007bff'
                    });
                    themeNameToId.set(themeData.name, newTheme.id);
                    console.log(`创建新主题: ${themeData.name} (${newTheme.id})`);
                }
            } catch (error) {
                console.error(`处理主题 ${themeData.name} 时出错:`, error);
                // 如果创建主题失败，使用默认主题
                themeNameToId.set(themeData.name, 'default');
            }
        }
        
        // 创建原始主题ID到新主题ID的映射
        const oldThemeIdToNewId = new Map();
        for (const themeData of themes) {
            const newThemeId = themeNameToId.get(themeData.name);
            if (newThemeId) {
                oldThemeIdToNewId.set(themeData.id, newThemeId);
            }
        }
        
        // 然后处理笔记
        for (const noteData of notes) {
            try {
                // 确定笔记的主题ID
                let finalThemeId = 'default';
                
                // 优先使用theme_id字段
                if (noteData.theme_id && oldThemeIdToNewId.has(noteData.theme_id)) {
                    finalThemeId = oldThemeIdToNewId.get(noteData.theme_id);
                } else if (noteData.theme && oldThemeIdToNewId.has(noteData.theme)) {
                    finalThemeId = oldThemeIdToNewId.get(noteData.theme);
                }
                
                // 创建笔记
                const result = await this.notesManager.createNote({
                    title: noteData.title || '未命名笔记',
                    content: noteData.content || '',
                    theme: finalThemeId,
                    tags: [...(noteData.tags || []), '备份导入']
                });
                
                results.push({
                    title: noteData.title,
                    status: 'success',
                    data: result,
                    theme: finalThemeId
                });
                
            } catch (error) {
                console.error(`处理笔记 ${noteData.title} 时出错:`, error);
                results.push({
                    title: noteData.title || '未命名笔记',
                    status: 'error',
                    error: error.message
                });
            }
        }
        
        return {
            type: 'backup',
            themesProcessed: themes.length,
            notesProcessed: notes.length,
            results: results,
            summary: {
                total: results.length,
                success: results.filter(r => r.status === 'success').length,
                failed: results.filter(r => r.status === 'error').length
            }
        };
    }
    
    // 解析TXT文件
    parseTxtFile(filename, content) {
        const title = path.basename(filename, path.extname(filename));
        return {
            title: title,
            content: content.trim(),
            tags: ['TXT导入']
        };
    }
    
    // 解析Markdown文件
    parseMarkdownFile(filename, content) {
        const lines = content.split('\n');
        let title = path.basename(filename, path.extname(filename));
        let actualContent = content;
        
        // 尝试从第一行提取标题
        if (lines[0] && lines[0].startsWith('# ')) {
            title = lines[0].substring(2).trim();
            actualContent = lines.slice(1).join('\n').trim();
        }
        
        return {
            title: title,
            content: actualContent,
            tags: ['Markdown导入']
        };
    }
    
    // 解析JSON文件
    parseJsonFile(content) {
        try {
            const data = JSON.parse(content);
            
            // 检查是否是完整的备份文件格式
            if (data.themes && data.notes && Array.isArray(data.themes) && Array.isArray(data.notes)) {
                // 这是完整的备份文件，需要特殊处理
                return {
                    isBackupFile: true,
                    themes: data.themes,
                    notes: data.notes
                };
            } else if (Array.isArray(data)) {
                // 批量笔记格式
                return data.map(item => ({
                    title: item.title || '未命名笔记',
                    content: item.content || '',
                    tags: [...(item.tags || []), 'JSON导入']
                }));
            } else if (data.title && data.content) {
                // 单个笔记格式
                return {
                    title: data.title,
                    content: data.content,
                    tags: [...(data.tags || []), 'JSON导入']
                };
            } else {
                // 通用JSON格式
                return {
                    title: 'JSON数据导入',
                    content: JSON.stringify(data, null, 2),
                    tags: ['JSON导入', '数据']
                };
            }
        } catch (error) {
            throw new Error('JSON格式错误: ' + error.message);
        }
    }
    
    // 处理URL导入
    async handleUrlImport(req, res) {
        try {
            const { url, theme } = req.body;
            
            if (!url) {
                return res.status(400).json({ error: 'URL不能为空' });
            }
            
            if (!theme) {
                return res.status(400).json({ error: '请选择主题' });
            }
            
            // 抓取网页内容
            const webContent = await this.fetchWebContent(url);
            
            // 创建笔记
            const noteData = {
                title: webContent.title || '网页导入',
                content: `来源: ${url}\n\n${webContent.content}`,
                theme: theme,
                tags: ['URL导入', '网页']
            };
            
            const result = await this.notesManager.createNote(noteData);
            
            // 记录导入历史
            await this.recordImportHistory({
                type: 'url',
                url: url,
                result: result,
                timestamp: new Date().toISOString()
            });
            
            res.json({
                success: true,
                data: result
            });
            
        } catch (error) {
            console.error('URL import error:', error);
            res.status(500).json({ error: 'URL导入失败: ' + error.message });
        }
    }
    
    // 抓取网页内容（简化版本，不依赖axios和cheerio）
    async fetchWebContent(url) {
        try {
            // 由于网络依赖问题，暂时返回模拟数据
            // 在生产环境中，这里应该使用axios和cheerio来抓取实际内容

            return {
                title: `网页内容 - ${new URL(url).hostname}`,
                content: `这是从 ${url} 导入的网页内容。\n\n由于网络依赖限制，当前显示的是模拟内容。在完整版本中，这里会显示实际的网页内容。`,
                url: url
            };

        } catch (error) {
            throw new Error('无法处理该网页URL: ' + error.message);
        }
    }
    
    // 处理文本导入
    async handleTextImport(req, res) {
        try {
            const { title, content, theme, tags } = req.body;
            
            if (!title || !content) {
                return res.status(400).json({ error: '标题和内容不能为空' });
            }
            
            if (!theme) {
                return res.status(400).json({ error: '请选择主题' });
            }
            
            const noteData = {
                title: title,
                content: content,
                theme: theme,
                tags: [...(tags || []), '文本导入']
            };
            
            const result = await this.notesManager.createNote(noteData);
            
            // 记录导入历史
            await this.recordImportHistory({
                type: 'text',
                title: title,
                result: result,
                timestamp: new Date().toISOString()
            });
            
            res.json({
                success: true,
                data: result
            });
            
        } catch (error) {
            console.error('Text import error:', error);
            res.status(500).json({ error: '文本导入失败: ' + error.message });
        }
    }
    
    // 处理批量导入
    async handleBatchImport(req, res) {
        try {
            const { notes, theme } = req.body;
            
            if (!Array.isArray(notes) || notes.length === 0) {
                return res.status(400).json({ error: '没有要导入的笔记' });
            }
            
            if (!theme) {
                return res.status(400).json({ error: '请选择主题' });
            }
            
            const results = [];
            
            for (const noteData of notes) {
                try {
                    const result = await this.notesManager.createNote({
                        ...noteData,
                        theme: theme,
                        tags: [...(noteData.tags || []), '批量导入']
                    });
                    
                    results.push({
                        title: noteData.title,
                        status: 'success',
                        data: result
                    });
                } catch (error) {
                    results.push({
                        title: noteData.title,
                        status: 'error',
                        error: error.message
                    });
                }
            }
            
            // 记录导入历史
            await this.recordImportHistory({
                type: 'batch',
                noteCount: notes.length,
                results: results,
                timestamp: new Date().toISOString()
            });
            
            res.json({
                success: true,
                results: results,
                summary: {
                    total: results.length,
                    success: results.filter(r => r.status === 'success').length,
                    failed: results.filter(r => r.status === 'error').length
                }
            });
            
        } catch (error) {
            console.error('Batch import error:', error);
            res.status(500).json({ error: '批量导入失败: ' + error.message });
        }
    }
    
    // 记录导入历史
    async recordImportHistory(historyData) {
        try {
            const historyFile = path.join(__dirname, '../data/import-history.json');
            
            let history = [];
            try {
                const existingData = await fs.readFile(historyFile, 'utf-8');
                history = JSON.parse(existingData);
            } catch (error) {
                // 文件不存在或格式错误，使用空数组
            }
            
            history.unshift({
                id: Date.now().toString(),
                ...historyData
            });
            
            // 只保留最近100条记录
            history = history.slice(0, 100);
            
            await fs.writeFile(historyFile, JSON.stringify(history, null, 2));
        } catch (error) {
            console.error('Failed to record import history:', error);
        }
    }
    
    // 获取导入历史
    async getImportHistory(req, res) {
        try {
            const historyFile = path.join(__dirname, '../data/import-history.json');
            
            let history = [];
            try {
                const data = await fs.readFile(historyFile, 'utf-8');
                history = JSON.parse(data);
            } catch (error) {
                // 文件不存在，返回空数组
            }
            
            res.json({
                success: true,
                data: history
            });
            
        } catch (error) {
            console.error('Failed to get import history:', error);
            res.status(500).json({ error: '获取导入历史失败' });
        }
    }
}

module.exports = ImportAPI;
