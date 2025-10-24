// Smart Note Collector - Notes Manager
// 笔记管理核心模块

const { v4: uuidv4 } = require('uuid');
const DatabaseManager = require('./DatabaseManager');
const JSONNotesManager = require('./JSONNotesManager');

class NotesManager {
    constructor() {
        this.db = new DatabaseManager();
        this.jsonManager = new JSONNotesManager();
        this.initialized = false;
        this.useDatabase = true;
    }

    async ensureInitialized() {
        if (!this.initialized) {
            try {
                await this.db.initialize();
                this.useDatabase = true;
                this.initialized = true;
                console.log('✅ Using SQLite database for notes');
            } catch (error) {
                console.error('Database initialization failed, falling back to JSON mode');
                this.useDatabase = false;
                this.initialized = true;
                console.log('⚠️ Using JSON files for notes (fallback mode)');
            }
        }
    }
    
    
    async getAllNotes(options = {}) {
        try {
            await this.ensureInitialized();
            if (this.useDatabase) {
                return await this.db.getAllNotes(options);
            } else {
                return await this.jsonManager.getAllNotes(options);
            }
        } catch (error) {
            console.error('Failed to get all notes:', error);
            return [];
        }
    }
    
    async getNotes(options = {}) {
        try {
            await this.ensureInitialized();
            let notes = await this.getAllNotes(options);
            
            // 按主题过滤
            if (options.theme && options.theme !== 'all') {
                notes = notes.filter(note => (note.theme || note.theme_id) === options.theme);
            }
            
            // 搜索过滤
            if (options.search) {
                const searchTerm = options.search.toLowerCase();
                notes = notes.filter(note =>
                    (note.title || '').toLowerCase().includes(searchTerm) ||
                    (note.content || '').toLowerCase().includes(searchTerm) ||
                    (note.tags && Array.isArray(note.tags) && note.tags.some(tag => tag.toLowerCase().includes(searchTerm)))
                );
            }

            // 标签筛选
            if (options.tags) {
                const filterTags = options.tags.split(',').map(tag => tag.trim()).filter(tag => tag);
                if (filterTags.length > 0) {
                    notes = notes.filter(note => {
                        if (!note.tags) return false;
                        const noteTags = Array.isArray(note.tags) ? note.tags : 
                                        typeof note.tags === 'string' ? note.tags.split(',') : [];
                        return filterTags.some(filterTag =>
                            noteTags.some(noteTag => noteTag.toLowerCase().includes(filterTag.toLowerCase()))
                        );
                    });
                }
            }
            
            // 排序（最新的在前）
            notes.sort((a, b) => {
                const dateA = new Date(a.created_at || a.createdAt || 0);
                const dateB = new Date(b.created_at || b.createdAt || 0);
                return dateB - dateA;
            });
            
            // 分页处理
            const page = parseInt(options.page) || 1;
            const limit = parseInt(options.limit) || 20;
            const offset = (page - 1) * limit;
            
            const paginatedNotes = notes.slice(offset, offset + limit);
            
            return {
                notes: paginatedNotes,
                total: notes.length,
                page,
                limit,
                totalPages: Math.ceil(notes.length / limit)
            };
        } catch (error) {
            console.error('Error getting notes:', error);
            throw new Error('获取笔记失败');
        }
    }
    
    async getNoteById(id) {
        try {
            await this.ensureInitialized();
            if (this.useDatabase) {
                return await this.db.getNoteById(id);
            } else {
                return await this.jsonManager.getNoteById(id);
            }
        } catch (error) {
            console.error('Failed to get note by id:', error);
            return null;
        }
    }
    
    async createNote(noteData) {
        try {
            await this.ensureInitialized();
            
            const note = {
                id: uuidv4(),
                title: noteData.title || '无标题',
                content: noteData.content || '',
                theme: noteData.theme || 'default',
                tags: noteData.tags || [],
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString()
            };
            
            if (this.useDatabase) {
                await this.db.insertNote(note);
                return await this.db.getNoteById(note.id);
            } else {
                return await this.jsonManager.createNote(note);
            }
        } catch (error) {
            console.error('Failed to create note:', error);
            throw error;
        }
    }
    
    async updateNote(id, updateData) {
        try {
            await this.ensureInitialized();
            
            const updates = {
                ...updateData,
                updated_at: new Date().toISOString()
            };
            
            if (this.useDatabase) {
                await this.db.updateNote(id, updates);
                return await this.db.getNoteById(id);
            } else {
                return await this.jsonManager.updateNote(id, updates);
            }
        } catch (error) {
            console.error('Failed to update note:', error);
            throw error;
        }
    }
    
    async deleteNote(id) {
        try {
            await this.ensureInitialized();
            
            if (this.useDatabase) {
                const note = await this.db.getNoteById(id);
                if (!note) {
                    throw new Error('Note not found');
                }
                await this.db.deleteNote(id);
                return note;
            } else {
                return await this.jsonManager.deleteNote(id);
            }
        } catch (error) {
            console.error('Failed to delete note:', error);
            throw error;
        }
    }
    
    async searchNotes(query, options = {}) {
        try {
            await this.ensureInitialized();
            const notes = await this.getAllNotes(options);
            
            if (!query) {
                return notes;
            }
            
            const searchTerm = query.toLowerCase();
            
            return notes.filter(note => {
                return note.title.toLowerCase().includes(searchTerm) ||
                       note.content.toLowerCase().includes(searchTerm) ||
                       (note.tags && note.tags.some(tag => tag.toLowerCase().includes(searchTerm)));
            });
        } catch (error) {
            console.error('Failed to search notes:', error);
            return [];
        }
    }
    
    async getTotalCount(options = {}) {
        try {
            await this.ensureInitialized();
            const notes = await this.getAllNotes(options);
            
            // 按主题过滤
            if (options.theme) {
                notes = notes.filter(note => note.theme === options.theme);
            }

            // 搜索过滤
            if (options.search) {
                const searchTerm = options.search.toLowerCase();
                notes = notes.filter(note =>
                    note.title.toLowerCase().includes(searchTerm) ||
                    note.content.toLowerCase().includes(searchTerm) ||
                    (note.tags && note.tags.some(tag => tag.toLowerCase().includes(searchTerm)))
                );
            }

            // 标签筛选
            if (options.tags) {
                const filterTags = options.tags.split(',').map(tag => tag.trim()).filter(tag => tag);
                console.log('标签筛选条件 (getTotalCount):', filterTags);
                if (filterTags.length > 0) {
                    const beforeFilter = notes.length;
                    notes = notes.filter(note => {
                        if (!note.tags || !Array.isArray(note.tags)) return false;
                        // 检查笔记是否包含筛选标签中的至少一个（OR逻辑）
                        const hasMatchingTag = filterTags.some(filterTag =>
                            note.tags.some(noteTag => noteTag.toLowerCase().includes(filterTag.toLowerCase()))
                        );
                        return hasMatchingTag;
                    });
                    console.log(`标签筛选结果 (getTotalCount): ${beforeFilter} -> ${notes.length} 条笔记`);
                }
            }

            return notes.length;
        } catch (error) {
            console.error('Error getting total count:', error);
            return 0;
        }
    }
    
    async getNotesStats() {
        try {
            await this.ensureInitialized();
            return await this.db.getStats();
        } catch (error) {
            console.error('Failed to get notes stats:', error);
            return { total: 0, byTheme: {}, recent: [] };
        }
    }
}

module.exports = NotesManager;
