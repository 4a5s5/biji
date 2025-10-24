// Smart Note Collector - Quick Import API
// 快速导入API模块

class QuickImportAPI {
    constructor(notesManager, themesManager) {
        this.notesManager = notesManager;
        this.themesManager = themesManager;
    }
    
    // 注册路由
    registerRoutes(app) {
        // 快速导入接口
        app.post('/api/quick-import', this.handleQuickImport.bind(this));
        
        // 批量快速导入
        app.post('/api/quick-import/batch', this.handleBatchQuickImport.bind(this));
    }
    
    // 处理快速导入
    async handleQuickImport(req, res) {
        try {
            const { title, content, theme, tags, source } = req.body;
            
            if (!title || !content) {
                return res.status(400).json({ error: '标题和内容不能为空' });
            }
            
            // 确保主题存在
            let finalTheme = theme || 'default';
            if (theme && theme !== 'default') {
                const existingTheme = await this.themesManager.getThemeById(theme);
                if (!existingTheme) {
                    finalTheme = 'default';
                }
            }
            
            const noteData = {
                title: title,
                content: content,
                theme: finalTheme,
                tags: Array.isArray(tags) ? tags : [],
                source: source || null
            };
            
            const result = await this.notesManager.createNote(noteData);
            
            res.status(201).json({
                success: true,
                id: result.id,
                message: '笔记创建成功',
                data: result
            });
            
        } catch (error) {
            console.error('Quick import error:', error);
            res.status(500).json({ 
                success: false,
                error: error.message || '快速导入失败' 
            });
        }
    }
    
    // 处理批量快速导入
    async handleBatchQuickImport(req, res) {
        try {
            const { notes, theme } = req.body;
            
            if (!Array.isArray(notes) || notes.length === 0) {
                return res.status(400).json({ error: '没有要导入的笔记' });
            }
            
            // 确保主题存在
            let finalTheme = theme || 'default';
            if (theme && theme !== 'default') {
                const existingTheme = await this.themesManager.getThemeById(theme);
                if (!existingTheme) {
                    finalTheme = 'default';
                }
            }
            
            const results = [];
            
            for (const noteData of notes) {
                try {
                    if (!noteData.title || !noteData.content) {
                        results.push({
                            title: noteData.title || '未知',
                            status: 'error',
                            error: '标题和内容不能为空'
                        });
                        continue;
                    }
                    
                    const processedNoteData = {
                        title: noteData.title,
                        content: noteData.content,
                        theme: finalTheme,
                        tags: Array.isArray(noteData.tags) ? noteData.tags : [],
                        source: noteData.source || null
                    };
                    
                    const result = await this.notesManager.createNote(processedNoteData);
                    
                    results.push({
                        title: noteData.title,
                        status: 'success',
                        id: result.id,
                        data: result
                    });
                    
                } catch (error) {
                    results.push({
                        title: noteData.title || '未知',
                        status: 'error',
                        error: error.message
                    });
                }
            }
            
            const summary = {
                total: results.length,
                success: results.filter(r => r.status === 'success').length,
                failed: results.filter(r => r.status === 'error').length
            };
            
            res.json({
                success: true,
                message: `批量导入完成：成功 ${summary.success} 条，失败 ${summary.failed} 条`,
                results: results,
                summary: summary
            });
            
        } catch (error) {
            console.error('Batch quick import error:', error);
            res.status(500).json({ 
                success: false,
                error: error.message || '批量快速导入失败' 
            });
        }
    }
}

module.exports = QuickImportAPI;
