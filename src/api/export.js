// Smart Note Collector - Export API
// 导出功能API模块

const fs = require('fs').promises;
const path = require('path');

class ExportAPI {
    constructor(notesManager, themesManager) {
        this.notesManager = notesManager;
        this.themesManager = themesManager;
        this.exportDir = path.join(__dirname, '../../exports');
        this.ensureExportDirectory();
    }
    
    async ensureExportDirectory() {
        try {
            await fs.mkdir(this.exportDir, { recursive: true });
        } catch (error) {
            console.error('Failed to create export directory:', error);
        }
    }
    
    // 注册路由
    registerRoutes(app) {
        // 导出所有笔记
        app.get('/api/export/all/:format', this.handleExportAll.bind(this));
        
        // 按主题导出
        app.get('/api/export/theme/:themeId/:format', this.handleExportByTheme.bind(this));
        
        // 导出单个笔记
        app.get('/api/export/note/:noteId/:format', this.handleExportNote.bind(this));
        
        // 自定义导出
        app.post('/api/export/custom/:format', this.handleCustomExport.bind(this));
    }
    
    // 导出所有笔记
    async handleExportAll(req, res) {
        try {
            const format = req.params.format.toLowerCase();
            const notes = await this.notesManager.getNotes();
            
            const exportData = await this.formatExportData(notes, format, '所有笔记');
            const filename = `all_notes_${new Date().toISOString().split('T')[0]}.${format}`;
            
            await this.sendExportResponse(res, exportData, filename, format);
            
        } catch (error) {
            console.error('Export all error:', error);
            res.status(500).json({ error: '导出失败: ' + error.message });
        }
    }
    
    // 按主题导出
    async handleExportByTheme(req, res) {
        try {
            const { themeId, format } = req.params;
            const formatLower = format.toLowerCase();
            
            const theme = await this.themesManager.getThemeById(themeId);
            if (!theme) {
                return res.status(404).json({ error: '主题不存在' });
            }
            
            const notes = await this.notesManager.getNotes({ theme: themeId });
            
            const exportData = await this.formatExportData(notes, formatLower, theme.name);
            const filename = `theme_${theme.name}_${new Date().toISOString().split('T')[0]}.${formatLower}`;
            
            await this.sendExportResponse(res, exportData, filename, formatLower);
            
        } catch (error) {
            console.error('Export by theme error:', error);
            res.status(500).json({ error: '导出失败: ' + error.message });
        }
    }
    
    // 导出单个笔记
    async handleExportNote(req, res) {
        try {
            const { noteId, format } = req.params;
            const formatLower = format.toLowerCase();
            
            const note = await this.notesManager.getNoteById(noteId);
            if (!note) {
                return res.status(404).json({ error: '笔记不存在' });
            }
            
            const exportData = await this.formatExportData([note], formatLower, note.title);
            const filename = `note_${note.title.replace(/[^a-zA-Z0-9\u4e00-\u9fa5]/g, '_')}.${formatLower}`;
            
            await this.sendExportResponse(res, exportData, filename, formatLower);
            
        } catch (error) {
            console.error('Export note error:', error);
            res.status(500).json({ error: '导出失败: ' + error.message });
        }
    }
    
    // 自定义导出
    async handleCustomExport(req, res) {
        try {
            const format = req.params.format.toLowerCase();
            const { noteIds, theme, search, title } = req.body;
            
            let notes = [];
            
            if (noteIds && Array.isArray(noteIds)) {
                // 按ID导出指定笔记
                for (const id of noteIds) {
                    const note = await this.notesManager.getNoteById(id);
                    if (note) notes.push(note);
                }
            } else {
                // 按条件导出
                notes = await this.notesManager.getNotes({ theme, search });
            }
            
            const exportTitle = title || '自定义导出';
            const exportData = await this.formatExportData(notes, format, exportTitle);
            const filename = `custom_export_${new Date().toISOString().split('T')[0]}.${format}`;
            
            await this.sendExportResponse(res, exportData, filename, format);
            
        } catch (error) {
            console.error('Custom export error:', error);
            res.status(500).json({ error: '导出失败: ' + error.message });
        }
    }
    
    // 格式化导出数据
    async formatExportData(notes, format, title) {
        switch (format) {
            case 'json':
                return this.formatAsJSON(notes, title);
            case 'txt':
                return this.formatAsText(notes, title);
            case 'md':
            case 'markdown':
                return this.formatAsMarkdown(notes, title);
            default:
                throw new Error('不支持的导出格式');
        }
    }
    
    // JSON格式
    formatAsJSON(notes, title) {
        return JSON.stringify({
            title: title,
            exportDate: new Date().toISOString(),
            totalNotes: notes.length,
            notes: notes.map(note => ({
                id: note.id,
                title: note.title,
                content: note.content,
                theme: note.theme,
                tags: Array.isArray(note.tags) ? note.tags : (typeof note.tags === 'string' ? note.tags.split(',').map(t => t.trim()) : []),
                createdAt: note.createdAt,
                updatedAt: note.updatedAt,
                source: note.source
            }))
        }, null, 2);
    }
    
    // 文本格式
    formatAsText(notes, title) {
        let content = `${title}\n`;
        content += `导出时间: ${new Date().toLocaleString('zh-CN')}\n`;
        content += `笔记数量: ${notes.length}\n`;
        content += '='.repeat(50) + '\n\n';
        
        notes.forEach((note, index) => {
            content += `${index + 1}. ${note.title}\n`;
            content += `创建时间: ${new Date(note.createdAt).toLocaleString('zh-CN')}\n`;
            if (note.tags) {
                const tagsArray = Array.isArray(note.tags) ? note.tags : (typeof note.tags === 'string' ? note.tags.split(',').map(t => t.trim()) : []);
                if (tagsArray.length > 0) {
                    content += `标签: ${tagsArray.join(', ')}\n`;
                }
            }
            content += `主题: ${note.theme}\n`;
            content += '-'.repeat(30) + '\n';
            content += note.content + '\n';
            content += '='.repeat(50) + '\n\n';
        });
        
        return content;
    }
    
    // Markdown格式
    formatAsMarkdown(notes, title) {
        let content = `# ${title}\n\n`;
        content += `**导出时间**: ${new Date().toLocaleString('zh-CN')}  \n`;
        content += `**笔记数量**: ${notes.length}\n\n`;
        content += '---\n\n';
        
        notes.forEach((note, index) => {
            content += `## ${index + 1}. ${note.title}\n\n`;
            content += `**创建时间**: ${new Date(note.createdAt).toLocaleString('zh-CN')}  \n`;
            if (note.tags) {
                const tagsArray = Array.isArray(note.tags) ? note.tags : (typeof note.tags === 'string' ? note.tags.split(',').map(t => t.trim()) : []);
                if (tagsArray.length > 0) {
                    content += `**标签**: ${tagsArray.map(tag => `\`${tag}\``).join(', ')}  \n`;
                }
            }
            content += `**主题**: ${note.theme}\n\n`;
            content += note.content + '\n\n';
            content += '---\n\n';
        });
        
        return content;
    }
    
    // 发送导出响应
    async sendExportResponse(res, data, filename, format) {
        const contentTypes = {
            'json': 'application/json',
            'txt': 'text/plain',
            'md': 'text/markdown',
            'markdown': 'text/markdown'
        };
        
        const contentType = contentTypes[format] || 'text/plain';
        
        res.setHeader('Content-Type', contentType);
        res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(filename)}"`);
        res.setHeader('Cache-Control', 'no-cache');
        
        res.send(data);
    }
}

module.exports = ExportAPI;
