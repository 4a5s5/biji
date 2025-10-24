const express = require('express');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');

const { readThemesData, writeThemesData, readNotesData, writeNotesData } = require('../utils/dataManager');

// 获取所有主题
router.get('/', async (req, res) => {
    try {
        const data = await readThemesData();
        res.json(data.themes);
    } catch (error) {
        console.error('Error fetching themes:', error);
        res.status(500).json({ error: '获取主题失败' });
    }
});

// 获取单个主题
router.get('/:id', async (req, res) => {
    try {
        const data = await readThemesData();
        const theme = data.themes.find(t => t.id === req.params.id);
        
        if (!theme) {
            return res.status(404).json({ error: '主题不存在' });
        }
        
        res.json(theme);
    } catch (error) {
        console.error('Error fetching theme:', error);
        res.status(500).json({ error: '获取主题失败' });
    }
});

// 创建新主题
router.post('/', async (req, res) => {
    try {
        const { name, color, icon } = req.body;
        
        if (!name) {
            return res.status(400).json({ error: '主题名称不能为空' });
        }
        
        const data = await readThemesData();
        
        // 检查主题名称是否已存在
        const existingTheme = data.themes.find(t => t.name === name.trim());
        if (existingTheme) {
            return res.status(400).json({ error: '主题名称已存在' });
        }
        
        const newTheme = {
            id: uuidv4(),
            name: name.trim(),
            color: color || '#3498db',
            icon: icon || 'default',
            created_at: new Date().toISOString(),
            note_count: 0
        };
        
        data.themes.push(newTheme);
        await writeThemesData(data);
        
        res.status(201).json(newTheme);
    } catch (error) {
        console.error('Error creating theme:', error);
        res.status(500).json({ error: '创建主题失败' });
    }
});

// 更新主题
router.put('/:id', async (req, res) => {
    try {
        const { name, color, icon } = req.body;
        const data = await readThemesData();
        const themeIndex = data.themes.findIndex(t => t.id === req.params.id);
        
        if (themeIndex === -1) {
            return res.status(404).json({ error: '主题不存在' });
        }
        
        // 检查新名称是否与其他主题冲突
        if (name) {
            const existingTheme = data.themes.find(t => t.name === name.trim() && t.id !== req.params.id);
            if (existingTheme) {
                return res.status(400).json({ error: '主题名称已存在' });
            }
        }
        
        // 更新主题信息
        data.themes[themeIndex] = {
            ...data.themes[themeIndex],
            name: name ? name.trim() : data.themes[themeIndex].name,
            color: color || data.themes[themeIndex].color,
            icon: icon || data.themes[themeIndex].icon
        };
        
        await writeThemesData(data);
        
        res.json(data.themes[themeIndex]);
    } catch (error) {
        console.error('Error updating theme:', error);
        res.status(500).json({ error: '更新主题失败' });
    }
});

// 删除主题
router.delete('/:id', async (req, res) => {
    try {
        const themeId = req.params.id;
        
        // 不允许删除默认主题
        if (themeId === 'default') {
            return res.status(400).json({ error: '不能删除默认主题' });
        }
        
        const themesData = await readThemesData();
        const themeIndex = themesData.themes.findIndex(t => t.id === themeId);
        
        if (themeIndex === -1) {
            return res.status(404).json({ error: '主题不存在' });
        }
        
        // 将该主题下的所有笔记移动到默认主题
        const notesData = await readNotesData();
        let movedCount = 0;
        
        notesData.notes.forEach(note => {
            if (note.theme === themeId) {
                note.theme = 'default';
                movedCount++;
            }
        });
        
        if (movedCount > 0) {
            await writeNotesData(notesData);
            
            // 更新默认主题的笔记计数
            const defaultThemeIndex = themesData.themes.findIndex(t => t.id === 'default');
            if (defaultThemeIndex !== -1) {
                themesData.themes[defaultThemeIndex].note_count += movedCount;
            }
        }
        
        // 删除主题
        themesData.themes.splice(themeIndex, 1);
        await writeThemesData(themesData);
        
        res.json({ 
            message: '主题删除成功',
            movedNotes: movedCount
        });
    } catch (error) {
        console.error('Error deleting theme:', error);
        res.status(500).json({ error: '删除主题失败' });
    }
});

// 获取主题统计信息
router.get('/:id/stats', async (req, res) => {
    try {
        const themeId = req.params.id;
        const notesData = await readNotesData();
        
        const themeNotes = notesData.notes.filter(note => note.theme === themeId);
        const stats = {
            total_notes: themeNotes.length,
            text_notes: themeNotes.filter(note => note.type === 'text').length,
            image_notes: themeNotes.filter(note => note.type === 'image').length,
            recent_notes: themeNotes
                .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
                .slice(0, 5)
                .map(note => ({
                    id: note.id,
                    title: note.title,
                    created_at: note.created_at
                }))
        };
        
        res.json(stats);
    } catch (error) {
        console.error('Error fetching theme stats:', error);
        res.status(500).json({ error: '获取主题统计失败' });
    }
});

module.exports = router;
