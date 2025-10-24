// Smart Note Collector - JSON Notes Manager (Fallback)
// JSON文件笔记管理模块 - 作为SQLite的备用方案

const fs = require('fs').promises;
const path = require('path');
const { v4: uuidv4 } = require('uuid');

class JSONNotesManager {
    constructor() {
        this.dataDir = path.join(__dirname, '../../data');
        this.notesFile = path.join(this.dataDir, 'notes.json');
        this.ensureDataDirectory();
    }
    
    async ensureDataDirectory() {
        try {
            await fs.mkdir(this.dataDir, { recursive: true });
            
            // 确保笔记文件存在
            try {
                await fs.access(this.notesFile);
            } catch (error) {
                await fs.writeFile(this.notesFile, JSON.stringify({ notes: [] }, null, 2));
            }
        } catch (error) {
            console.error('Failed to ensure data directory:', error);
        }
    }
    
    async readNotesData() {
        try {
            const data = await fs.readFile(this.notesFile, 'utf-8');
            return JSON.parse(data);
        } catch (error) {
            console.error('Error reading notes data:', error);
            return { notes: [] };
        }
    }
    
    async writeNotesData(data) {
        try {
            await fs.writeFile(this.notesFile, JSON.stringify(data, null, 2));
        } catch (error) {
            console.error('Error writing notes data:', error);
            throw new Error('保存笔记数据失败');
        }
    }
    
    async getAllNotes(options = {}) {
        try {
            const data = await this.readNotesData();
            let notes = data.notes || [];
            
            // 按主题过滤
            if (options.theme && options.theme !== 'all') {
                notes = notes.filter(note => note.theme === options.theme);
            }
            
            // 按创建时间排序（最新的在前）
            notes.sort((a, b) => new Date(b.createdAt || b.created_at) - new Date(a.createdAt || a.created_at));
            
            // 限制数量
            if (options.limit) {
                notes = notes.slice(0, options.limit);
            }
            
            return notes;
        } catch (error) {
            console.error('Failed to get all notes:', error);
            return [];
        }
    }
    
    async getNoteById(id) {
        try {
            const data = await this.readNotesData();
            return data.notes.find(note => note.id === id) || null;
        } catch (error) {
            console.error('Failed to get note by id:', error);
            return null;
        }
    }
    
    async createNote(noteData) {
        try {
            const data = await this.readNotesData();
            
            const note = {
                id: uuidv4(),
                title: noteData.title || '无标题',
                content: noteData.content || '',
                theme: noteData.theme || 'default',
                tags: noteData.tags || [],
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString()
            };
            
            data.notes.push(note);
            await this.writeNotesData(data);
            
            return note;
        } catch (error) {
            console.error('Failed to create note:', error);
            throw error;
        }
    }
    
    async updateNote(id, updateData) {
        try {
            const data = await this.readNotesData();
            const noteIndex = data.notes.findIndex(note => note.id === id);
            
            if (noteIndex === -1) {
                throw new Error('Note not found');
            }
            
            const note = data.notes[noteIndex];
            
            // 更新字段
            if (updateData.title !== undefined) note.title = updateData.title;
            if (updateData.content !== undefined) note.content = updateData.content;
            if (updateData.theme !== undefined) note.theme = updateData.theme;
            if (updateData.tags !== undefined) note.tags = updateData.tags;
            note.updatedAt = new Date().toISOString();
            
            await this.writeNotesData(data);
            
            return note;
        } catch (error) {
            console.error('Failed to update note:', error);
            throw error;
        }
    }
    
    async deleteNote(id) {
        try {
            const data = await this.readNotesData();
            const noteIndex = data.notes.findIndex(note => note.id === id);
            
            if (noteIndex === -1) {
                throw new Error('Note not found');
            }
            
            const deletedNote = data.notes.splice(noteIndex, 1)[0];
            await this.writeNotesData(data);
            
            return deletedNote;
        } catch (error) {
            console.error('Failed to delete note:', error);
            throw error;
        }
    }
    
    async getStats() {
        try {
            const notes = await this.getAllNotes();
            const stats = {
                totalNotes: notes.length,
                totalThemes: 0,
                notesByTheme: {},
                recentNotes: notes.slice(0, 5)
            };
            
            // 按主题统计
            notes.forEach(note => {
                const theme = note.theme || 'default';
                if (!stats.notesByTheme[theme]) {
                    stats.notesByTheme[theme] = { name: theme, count: 0 };
                }
                stats.notesByTheme[theme].count++;
            });
            
            stats.totalThemes = Object.keys(stats.notesByTheme).length;
            
            return stats;
        } catch (error) {
            console.error('Failed to get notes stats:', error);
            return { totalNotes: 0, totalThemes: 0, notesByTheme: {}, recentNotes: [] };
        }
    }
}

module.exports = JSONNotesManager;
