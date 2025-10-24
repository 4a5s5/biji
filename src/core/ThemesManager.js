// Smart Note Collector - Themes Manager
// 主题管理核心模块

const fs = require('fs').promises;
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const DatabaseManager = require('./DatabaseManager');

class ThemesManager {
    constructor() {
        this.db = new DatabaseManager();
        this.initialized = false;
        this.useDatabase = true;
        this.dataDir = path.join(__dirname, '../../data');
        this.themesFile = path.join(this.dataDir, 'themes.json');
    }

    async ensureInitialized() {
        if (!this.initialized) {
            try {
                await this.db.initialize();
                this.useDatabase = true;
                this.initialized = true;
                console.log('✅ Using SQLite database for themes');
            } catch (error) {
                console.error('Database initialization failed, falling back to JSON mode');
                this.useDatabase = false;
                this.initialized = true;
                await this.ensureThemesFile();
                console.log('⚠️ Using JSON files for themes (fallback mode)');
            }
        }
    }

    async ensureThemesFile() {
        try {
            await fs.mkdir(this.dataDir, { recursive: true });
            
            try {
                await fs.access(this.themesFile);
            } catch (error) {
                const defaultThemes = {
                    themes: [
                        {
                            id: 'default',
                            name: '默认',
                            description: '默认主题',
                            color: '#007bff',
                            createdAt: new Date().toISOString(),
                            updatedAt: new Date().toISOString()
                        }
                    ]
                };
                await fs.writeFile(this.themesFile, JSON.stringify(defaultThemes, null, 2));
            }
        } catch (error) {
            console.error('Failed to ensure themes file:', error);
        }
    }
    
    async ensureDataDirectory() {
        try {
            await fs.mkdir(this.dataDir, { recursive: true });
            
            // 确保主题文件存在
            try {
                await fs.access(this.themesFile);
            } catch (error) {
                const defaultThemes = {
                    themes: [
                        {
                            id: 'default',
                            name: '默认主题',
                            description: '系统默认主题',
                            color: '#007bff',
                            createdAt: new Date().toISOString(),
                            isDefault: true
                        }
                    ]
                };
                await fs.writeFile(this.themesFile, JSON.stringify(defaultThemes, null, 2));
            }
        } catch (error) {
            console.error('Failed to ensure data directory:', error);
        }
    }
    
    async readThemesData() {
        try {
            const data = await fs.readFile(this.themesFile, 'utf-8');
            return JSON.parse(data);
        } catch (error) {
            console.error('Error reading themes data:', error);
            return { themes: [] };
        }
    }
    
    async writeThemesData(data) {
        try {
            await fs.writeFile(this.themesFile, JSON.stringify(data, null, 2));
        } catch (error) {
            console.error('Error writing themes data:', error);
            throw new Error('保存主题数据失败');
        }
    }
    
    async getAllThemes() {
        try {
            await this.ensureInitialized();
            return await this.db.getAllThemes();
        } catch (error) {
            console.error('Failed to get all themes:', error);
            return [];
        }
    }
    
    async getThemes() {
        try {
            await this.ensureInitialized();
            if (this.useDatabase) {
                const themes = await this.db.getAllThemes();
                // 为每个主题添加笔记数量
                for (const theme of themes) {
                    const notes = await this.db.getAllNotes({ theme: theme.id });
                    theme.noteCount = notes.length;
                }
                return themes;
            } else {
                const data = await this.readThemesData();
                return data.themes || [];
            }
        } catch (error) {
            console.error('Error getting themes:', error);
            throw new Error('获取主题失败');
        }
    }
    
    async getThemeById(id) {
        try {
            await this.ensureInitialized();
            return await this.db.getThemeById(id);
        } catch (error) {
            console.error('Failed to get theme by id:', error);
            return null;
        }
    }
    
    async createTheme(themeData) {
        try {
            await this.ensureInitialized();
            
            if (this.useDatabase) {
                // 检查主题名称是否已存在
                const themes = await this.db.getAllThemes();
                const existingTheme = themes.find(theme => theme.name === themeData.name);
                if (existingTheme) {
                    throw new Error('主题名称已存在');
                }
                
                const theme = {
                    id: uuidv4(),
                    name: themeData.name,
                    description: themeData.description || '',
                    color: themeData.color || '#007bff'
                };
                
                await this.db.insertTheme(theme);
                return await this.db.getThemeById(theme.id);
            } else {
                // JSON模式处理
                const data = await this.readThemesData();
                const existingTheme = data.themes.find(theme => theme.name === themeData.name);
                if (existingTheme) {
                    throw new Error('主题名称已存在');
                }
                
                const theme = {
                    id: uuidv4(),
                    name: themeData.name,
                    description: themeData.description || '',
                    color: themeData.color || '#007bff',
                    createdAt: new Date().toISOString(),
                    updatedAt: new Date().toISOString()
                };
                
                data.themes.push(theme);
                await this.writeThemesData(data);
                return theme;
            }
        } catch (error) {
            console.error('Failed to create theme:', error);
            throw error;
        }
    }
    
    async updateTheme(id, updateData) {
        try {
            await this.ensureInitialized();
            
            if (this.useDatabase) {
                // 如果更新名称，检查是否与其他主题重复
                if (updateData.name) {
                    const themes = await this.db.getAllThemes();
                    const existingTheme = themes.find(theme => 
                        theme.name === updateData.name && theme.id !== id
                    );
                    if (existingTheme) {
                        throw new Error('主题名称已存在');
                    }
                }
                
                await this.db.updateTheme(id, updateData);
                return await this.db.getThemeById(id);
            } else {
                // JSON模式处理
                const data = await this.readThemesData();
                const themeIndex = data.themes.findIndex(theme => theme.id === id);
                
                if (themeIndex === -1) {
                    throw new Error('主题不存在');
                }
                
                // 检查名称重复
                if (updateData.name) {
                    const existingTheme = data.themes.find(theme => 
                        theme.name === updateData.name && theme.id !== id
                    );
                    if (existingTheme) {
                        throw new Error('主题名称已存在');
                    }
                }
                
                const theme = data.themes[themeIndex];
                Object.assign(theme, updateData, { updatedAt: new Date().toISOString() });
                
                await this.writeThemesData(data);
                return theme;
            }
        } catch (error) {
            console.error('Failed to update theme:', error);
            throw error;
        }
    }
    
    async deleteTheme(id) {
        try {
            // 不允许删除默认主题
            if (id === 'default') {
                throw new Error('不能删除默认主题');
            }
            
            await this.ensureInitialized();
            
            if (this.useDatabase) {
                const theme = await this.db.getThemeById(id);
                if (!theme) {
                    throw new Error('主题不存在');
                }
                
                // 检查是否有笔记使用此主题
                const notesWithTheme = await this.db.getAllNotes({ theme: id });
                if (notesWithTheme.length > 0) {
                    throw new Error(`无法删除主题，还有 ${notesWithTheme.length} 条笔记使用此主题`);
                }
                
                await this.db.deleteTheme(id);
                return true;
            } else {
                // JSON模式处理
                const data = await this.readThemesData();
                const themeIndex = data.themes.findIndex(theme => theme.id === id);
                
                if (themeIndex === -1) {
                    throw new Error('主题不存在');
                }
                
                data.themes.splice(themeIndex, 1);
                await this.writeThemesData(data);
                return true;
            }
        } catch (error) {
            console.error('Error deleting theme:', error);
            throw new Error(error.message || '删除主题失败');
        }
    }
    
    async getThemeStats() {
        try {
            const themes = await this.getThemes();
            const notesManager = require('./NotesManager');
            const nm = new notesManager();
            const allNotes = await nm.getNotes();
            
            const stats = {
                total: themes.length,
                withNotes: themes.filter(theme => theme.noteCount > 0).length,
                mostUsed: themes
                    .filter(theme => theme.noteCount > 0)
                    .sort((a, b) => b.noteCount - a.noteCount)
                    .slice(0, 5)
                    .map(theme => ({
                        id: theme.id,
                        name: theme.name,
                        noteCount: theme.noteCount
                    }))
            };
            
            return stats;
        } catch (error) {
            console.error('Error getting theme stats:', error);
            throw new Error('获取主题统计失败');
        }
    }
}

module.exports = ThemesManager;
