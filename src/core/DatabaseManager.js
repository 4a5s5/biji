// Smart Note Collector - Database Manager
// SQLite数据库管理核心模块

const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs').promises;

class DatabaseManager {
    constructor() {
        this.dataDir = path.join(__dirname, '../../data');
        this.dbPath = path.join(this.dataDir, 'notes.db');
        this.db = null;
        this.initialized = false;
    }

    async initialize() {
        if (this.initialized) return;

        try {
            // 确保数据目录存在并有写入权限
            console.log('📁 Creating data directory:', this.dataDir);
            try {
                await fs.mkdir(this.dataDir, { recursive: true });
                await fs.mkdir(path.join(this.dataDir, 'images'), { recursive: true });
            } catch (error) {
                console.error('Failed to create directory:', error.message);
                // 如果目录创建失败，尝试使用临时目录
                this.dataDir = '/tmp/smart-note-data';
                this.dbPath = path.join(this.dataDir, 'notes.db');
                console.log('⚠️ Using temporary directory:', this.dataDir);
                await fs.mkdir(this.dataDir, { recursive: true });
                await fs.mkdir(path.join(this.dataDir, 'images'), { recursive: true });
            }
            
            // 测试目录写入权限
            const testFile = path.join(this.dataDir, 'test.tmp');
            try {
                await fs.writeFile(testFile, 'test');
                await fs.unlink(testFile);
                console.log('✅ Data directory is writable');
            } catch (error) {
                console.error('❌ Data directory is not writable:', error);
                throw new Error('Data directory permission denied');
            }

            // 连接数据库
            console.log('📦 Connecting to database:', this.dbPath);
            this.db = new sqlite3.Database(this.dbPath, sqlite3.OPEN_READWRITE | sqlite3.OPEN_CREATE, (err) => {
                if (err) {
                    console.error('❌ Failed to connect to database:', err);
                    throw err;
                }
                console.log('📦 Connected to SQLite database');
            });

            // 创建表结构
            await this.createTables();

            // 迁移现有JSON数据（如果存在）
            await this.migrateFromJSON();

            this.initialized = true;
            console.log('✅ Database initialized successfully');
        } catch (error) {
            console.error('❌ Failed to initialize database:', error);
            // 如果数据库初始化失败，回退到JSON模式
            this.initialized = false;
            throw error;
        }
    }

    async createTables() {
        return new Promise((resolve, reject) => {
            this.db.serialize(() => {
                // 创建主题表
                this.db.run(`
                    CREATE TABLE IF NOT EXISTS themes (
                        id TEXT PRIMARY KEY,
                        name TEXT NOT NULL UNIQUE,
                        description TEXT,
                        color TEXT DEFAULT '#007bff',
                        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
                    )
                `, (err) => {
                    if (err) {
                        console.error('Error creating themes table:', err);
                        reject(err);
                        return;
                    }
                });

                // 创建笔记表
                this.db.run(`
                    CREATE TABLE IF NOT EXISTS notes (
                        id TEXT PRIMARY KEY,
                        title TEXT NOT NULL,
                        content TEXT NOT NULL,
                        theme_id TEXT,
                        tags TEXT,
                        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
                    )
                `, (err) => {
                    if (err) {
                        console.error('Error creating notes table:', err);
                        reject(err);
                        return;
                    }
                });

                // 创建AI预设表
                this.db.run(`
                    CREATE TABLE IF NOT EXISTS ai_presets (
                        id TEXT PRIMARY KEY,
                        name TEXT NOT NULL,
                        prompt TEXT NOT NULL,
                        is_default INTEGER DEFAULT 0,
                        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
                    )
                `, (err) => {
                    if (err) {
                        console.error('Error creating ai_presets table:', err);
                        reject(err);
                        return;
                    }
                });

                // 创建索引
                this.db.run(`CREATE INDEX IF NOT EXISTS idx_notes_theme ON notes(theme_id)`, (err) => {
                    if (err) console.error('Error creating index idx_notes_theme:', err);
                });
                this.db.run(`CREATE INDEX IF NOT EXISTS idx_notes_created ON notes(created_at)`, (err) => {
                    if (err) console.error('Error creating index idx_notes_created:', err);
                });
                this.db.run(`CREATE INDEX IF NOT EXISTS idx_themes_name ON themes(name)`, (err) => {
                    if (err) console.error('Error creating index idx_themes_name:', err);
                    else resolve();
                });
            });
        });
    }

    async migrateFromJSON() {
        try {
            const notesJsonPath = path.join(this.dataDir, 'notes.json');
            const themesJsonPath = path.join(this.dataDir, 'themes.json');

            // 检查是否已经迁移过
            const existingThemes = await this.getAllThemes();
            
            if (existingThemes.length > 0) {
                console.log('Database already has themes, skipping migration');
                return;
            }

            console.log('🔄 Starting data initialization...');

            // 迁移主题数据
            let themesCreated = false;
            try {
                const themesData = await fs.readFile(themesJsonPath, 'utf-8');
                const themes = JSON.parse(themesData);
                
                if (themes.themes && themes.themes.length > 0) {
                    console.log(`Migrating ${themes.themes.length} themes from JSON...`);
                    for (const theme of themes.themes) {
                        await this.createTheme({
                            id: theme.id,
                            name: theme.name,
                            description: theme.description || '',
                            color: theme.color || '#007bff'
                        });
                    }
                    themesCreated = true;
                }
            } catch (error) {
                console.log('No themes.json found, will create default theme');
            }

            // 如果没有主题数据，创建默认主题
            if (!themesCreated) {
                console.log('Creating default theme...');
                await this.createDefaultTheme();
            }

            // 迁移笔记数据
            try {
                const notesData = await fs.readFile(notesJsonPath, 'utf-8');
                const notes = JSON.parse(notesData);
                
                if (notes.notes && notes.notes.length > 0) {
                    console.log(`Migrating ${notes.notes.length} notes from JSON...`);
                    for (const note of notes.notes) {
                        await this.createNote({
                            id: note.id,
                            title: note.title,
                            content: note.content,
                            theme_id: note.theme || note.theme_id || 'default',
                            tags: Array.isArray(note.tags) ? note.tags.join(',') : (note.tags || '')
                        });
                    }
                }
            } catch (error) {
                console.log('No notes.json found - starting with empty notes');
            }

            console.log('✅ Data initialization completed');
        } catch (error) {
            console.error('❌ Data initialization error:', error);
            // 确保至少有默认主题
            try {
                await this.createDefaultTheme();
                console.log('✅ Created fallback default theme');
            } catch (fallbackError) {
                console.error('❌ Failed to create fallback theme:', fallbackError);
            }
        }
    }

    async getCount(table) {
        return new Promise((resolve, reject) => {
            this.db.get(`SELECT COUNT(*) as count FROM ${table}`, (err, row) => {
                if (err) reject(err);
                else resolve(row.count);
            });
        });
    }

    // 主题相关方法
    async getAllThemes() {
        return new Promise((resolve, reject) => {
            this.db.all('SELECT * FROM themes ORDER BY created_at ASC', (err, rows) => {
                if (err) reject(err);
                else resolve(rows);
            });
        });
    }

    async getThemeById(id) {
        return new Promise((resolve, reject) => {
            this.db.get('SELECT * FROM themes WHERE id = ?', [id], (err, row) => {
                if (err) reject(err);
                else resolve(row);
            });
        });
    }

    async insertTheme(theme) {
        return new Promise((resolve, reject) => {
            const sql = `
                INSERT OR REPLACE INTO themes (id, name, description, color, created_at, updated_at)
                VALUES (?, ?, ?, ?, ?, ?)
            `;
            const now = new Date().toISOString();
            this.db.run(sql, [
                theme.id,
                theme.name,
                theme.description || '',
                theme.color || '#007bff',
                theme.created_at || now,
                now
            ], function(err) {
                if (err) reject(err);
                else resolve({ id: theme.id, changes: this.changes });
            });
        });
    }

    async updateTheme(id, updates) {
        return new Promise((resolve, reject) => {
            const sql = `
                UPDATE themes 
                SET name = ?, description = ?, color = ?, updated_at = ?
                WHERE id = ?
            `;
            this.db.run(sql, [
                updates.name,
                updates.description || '',
                updates.color || '#007bff',
                new Date().toISOString(),
                id
            ], function(err) {
                if (err) reject(err);
                else resolve({ id, changes: this.changes });
            });
        });
    }

    async deleteTheme(id) {
        return new Promise((resolve, reject) => {
            this.db.run('DELETE FROM themes WHERE id = ?', [id], function(err) {
                if (err) reject(err);
                else resolve({ id, changes: this.changes });
            });
        });
    }

    // 笔记相关方法
    async getAllNotes(options = {}) {
        return new Promise((resolve, reject) => {
            let sql = 'SELECT * FROM notes';
            const params = [];

            if (options.theme || options.theme_id) {
                sql += ' WHERE theme_id = ?';
                params.push(options.theme || options.theme_id);
            }

            sql += ' ORDER BY created_at DESC';

            if (options.limit) {
                sql += ' LIMIT ?';
                params.push(options.limit);
            }

            this.db.all(sql, params, (err, rows) => {
                if (err) reject(err);
                else {
                    // 解析tags字段
                    const notes = rows.map(note => {
                        let tags = [];
                        if (note.tags) {
                            try {
                                // 尝试解析JSON格式的tags
                                tags = JSON.parse(note.tags);
                            } catch (e) {
                                // 如果不是JSON格式，按逗号分割
                                tags = note.tags.split(',').map(tag => tag.trim()).filter(tag => tag);
                            }
                        }
                        return {
                            ...note,
                            theme: note.theme_id,
                            tags: tags
                        };
                    });
                    resolve(notes);
                }
            });
        });
    }

    async getNoteById(id) {
        return new Promise((resolve, reject) => {
            this.db.get('SELECT * FROM notes WHERE id = ?', [id], (err, row) => {
                if (err) reject(err);
                else if (row) {
                    let tags = [];
                    if (row.tags) {
                        try {
                            tags = JSON.parse(row.tags);
                        } catch (e) {
                            tags = row.tags.split(',').map(tag => tag.trim()).filter(tag => tag);
                        }
                    }
                    resolve({
                        ...row,
                        theme: row.theme_id,
                        tags: tags
                    });
                } else {
                    resolve(null);
                }
            });
        });
    }

    async insertNote(note) {
        return new Promise((resolve, reject) => {
            const sql = `
                INSERT INTO notes (id, title, content, theme_id, tags, created_at, updated_at)
                VALUES (?, ?, ?, ?, ?, ?, ?)
            `;
            const now = new Date().toISOString();
            this.db.run(sql, [
                note.id,
                note.title,
                note.content,
                note.theme_id || note.theme || 'default',
                typeof note.tags === 'string' ? note.tags : JSON.stringify(note.tags || []),
                note.created_at || now,
                now
            ], function(err) {
                if (err) reject(err);
                else resolve({ id: note.id, changes: this.changes });
            });
        });
    }

    async getNoteById(id) {
        return new Promise((resolve, reject) => {
            this.db.get('SELECT * FROM notes WHERE id = ?', [id], (err, row) => {
                if (err) reject(err);
                else resolve(row);
            });
        });
    }

    async updateNote(id, updates) {
        return new Promise((resolve, reject) => {
            const sql = `
                UPDATE notes 
                SET title = ?, content = ?, theme_id = ?, tags = ?, updated_at = ?
                WHERE id = ?
            `;
            this.db.run(sql, [
                updates.title,
                updates.content,
                updates.theme_id || updates.theme || 'default',
                typeof updates.tags === 'string' ? updates.tags : JSON.stringify(updates.tags || []),
                new Date().toISOString(),
                id
            ], function(err) {
                if (err) reject(err);
                else resolve({ id, changes: this.changes });
            });
        });
    }

    async deleteNote(id) {
        return new Promise((resolve, reject) => {
            this.db.run('DELETE FROM notes WHERE id = ?', [id], function(err) {
                if (err) reject(err);
                else resolve({ id, changes: this.changes });
            });
        });
    }

    // 统计方法
    async getStats() {
        return new Promise((resolve, reject) => {
            this.db.serialize(() => {
                const stats = {};
                
                // 获取总笔记数
                this.db.get('SELECT COUNT(*) as count FROM notes', (err, row) => {
                    if (err) {
                        reject(err);
                        return;
                    }
                    stats.totalNotes = row.count;
                    
                    // 获取总主题数
                    this.db.get('SELECT COUNT(*) as count FROM themes', (err, row) => {
                        if (err) {
                            reject(err);
                            return;
                        }
                        stats.totalThemes = row.count;
                        
                        // 获取每个主题的笔记数
                        this.db.all(`
                            SELECT t.id, t.name, COUNT(n.id) as note_count
                            FROM themes t
                            LEFT JOIN notes n ON t.id = n.theme_id
                            GROUP BY t.id, t.name
                        `, (err, rows) => {
                            if (err) {
                                reject(err);
                                return;
                            }
                            stats.notesByTheme = {};
                            rows.forEach(row => {
                                stats.notesByTheme[row.id] = {
                                    name: row.name,
                                    count: row.note_count
                                };
                            });
                            
                            // 获取最近的笔记
                            this.db.all('SELECT * FROM notes ORDER BY created_at DESC LIMIT 5', (err, rows) => {
                                if (err) {
                                    reject(err);
                                    return;
                                }
                                stats.recentNotes = rows.map(note => ({
                                    ...note,
                                    theme: note.theme_id,
                                    tags: note.tags ? JSON.parse(note.tags) : []
                                }));
                                
                                resolve(stats);
                            });
                        });
                    });
                });
            });
        });
    }

    async createDefaultTheme() {
        try {
            const defaultTheme = {
                id: 'default',
                name: '默认',
                description: '默认主题',
                color: '#007bff'
            };
            
            console.log('Creating default theme:', defaultTheme);
            return await this.insertTheme(defaultTheme);
        } catch (error) {
            console.error('Failed to create default theme:', error);
            throw error;
        }
    }

    async createTheme(themeData) {
        return await this.insertTheme(themeData);
    }

    async createNote(noteData) {
        return new Promise((resolve, reject) => {
            const sql = `
                INSERT INTO notes (id, title, content, theme_id, tags, created_at, updated_at)
                VALUES (?, ?, ?, ?, ?, ?, ?)
            `;
            const now = new Date().toISOString();
            const id = noteData.id || require('uuid').v4();
            
            this.db.run(sql, [
                id,
                noteData.title,
                noteData.content,
                noteData.theme_id || 'default',
                noteData.tags || '',
                noteData.created_at || now,
                now
            ], function(err) {
                if (err) reject(err);
                else resolve({ id, changes: this.changes });
            });
        });
    }

    // AI预设相关方法
    async getAllAIPresets() {
        return new Promise((resolve, reject) => {
            this.db.all('SELECT * FROM ai_presets ORDER BY created_at ASC', (err, rows) => {
                if (err) reject(err);
                else resolve(rows);
            });
        });
    }

    async getAIPresetById(id) {
        return new Promise((resolve, reject) => {
            this.db.get('SELECT * FROM ai_presets WHERE id = ?', [id], (err, row) => {
                if (err) reject(err);
                else resolve(row);
            });
        });
    }

    async createAIPreset(preset) {
        return new Promise((resolve, reject) => {
            const sql = `
                INSERT INTO ai_presets (id, name, prompt, is_default, created_at, updated_at)
                VALUES (?, ?, ?, ?, ?, ?)
            `;
            const now = new Date().toISOString();
            const id = preset.id || require('crypto').randomUUID();
            
            this.db.run(sql, [
                id,
                preset.name,
                preset.prompt,
                preset.is_default ? 1 : 0,
                now,
                now
            ], function(err) {
                if (err) reject(err);
                else resolve({ id, changes: this.changes });
            });
        });
    }

    async updateAIPreset(id, updates) {
        return new Promise((resolve, reject) => {
            const sql = `
                UPDATE ai_presets 
                SET name = ?, prompt = ?, is_default = ?, updated_at = ?
                WHERE id = ?
            `;
            this.db.run(sql, [
                updates.name,
                updates.prompt,
                updates.is_default ? 1 : 0,
                new Date().toISOString(),
                id
            ], function(err) {
                if (err) reject(err);
                else resolve({ id, changes: this.changes });
            });
        });
    }

    async deleteAIPreset(id) {
        return new Promise((resolve, reject) => {
            this.db.run('DELETE FROM ai_presets WHERE id = ?', [id], function(err) {
                if (err) reject(err);
                else resolve({ id, changes: this.changes });
            });
        });
    }

    async setDefaultAIPreset(id) {
        return new Promise((resolve, reject) => {
            this.db.serialize(() => {
                // 先清除所有默认标记
                this.db.run('UPDATE ai_presets SET is_default = 0', (err) => {
                    if (err) {
                        reject(err);
                        return;
                    }
                    
                    // 如果id不为空，设置新的默认预设
                    if (id) {
                        this.db.run('UPDATE ai_presets SET is_default = 1 WHERE id = ?', [id], function(err) {
                            if (err) reject(err);
                            else resolve({ id, changes: this.changes });
                        });
                    } else {
                        resolve({ id: null, changes: 0 });
                    }
                });
            });
        });
    }

    async getDefaultAIPreset() {
        return new Promise((resolve, reject) => {
            this.db.get('SELECT * FROM ai_presets WHERE is_default = 1 LIMIT 1', (err, row) => {
                if (err) reject(err);
                else resolve(row);
            });
        });
    }

    async close() {
        if (this.db) {
            return new Promise((resolve) => {
                this.db.close((err) => {
                    if (err) console.error('Error closing database:', err);
                    else console.log('Database connection closed');
                    resolve();
                });
            });
        }
    }
}

module.exports = DatabaseManager;
