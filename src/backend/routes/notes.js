const express = require('express');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');
const fs = require('fs-extra');
const path = require('path');
const multer = require('multer');

const config = require('../../../config/app.json');
const { readNotesData, writeNotesData, updateThemeCount } = require('../utils/dataManager');

// 配置multer用于图片上传
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, config.storage.imagesPath);
    },
    filename: (req, file, cb) => {
        const ext = path.extname(file.originalname);
        const filename = `${uuidv4()}${ext}`;
        cb(null, filename);
    }
});

const upload = multer({
    storage: storage,
    limits: {
        fileSize: 5 * 1024 * 1024 // 5MB
    },
    fileFilter: (req, file, cb) => {
        const allowedTypes = /jpeg|jpg|png|gif|bmp|webp/;
        const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
        const mimetype = allowedTypes.test(file.mimetype);
        
        if (mimetype && extname) {
            return cb(null, true);
        } else {
            cb(new Error('只支持图片文件格式'));
        }
    }
});

// 获取所有笔记
router.get('/', async (req, res) => {
    try {
        const { theme, theme_id, search, page = 1, limit = 20 } = req.query;
        const data = await readNotesData();
        let notes = data.notes;
        
        // 按主题筛选 - 支持两种参数名
        const themeFilter = theme_id || theme;
        if (themeFilter && themeFilter !== 'all') {
            notes = notes.filter(note => note.theme === themeFilter);
        }
        
        // 搜索功能
        if (search) {
            const searchLower = search.toLowerCase();
            notes = notes.filter(note => 
                note.title.toLowerCase().includes(searchLower) ||
                note.content.toLowerCase().includes(searchLower) ||
                (note.tags && note.tags.some(tag => tag.toLowerCase().includes(searchLower)))
            );
        }
        
        // 排序（按创建时间倒序）
        notes.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
        
        // 分页
        const startIndex = (page - 1) * limit;
        const endIndex = startIndex + parseInt(limit);
        const paginatedNotes = notes.slice(startIndex, endIndex);
        
        res.json({
            notes: paginatedNotes,
            total: notes.length,
            page: parseInt(page),
            totalPages: Math.ceil(notes.length / limit)
        });
    } catch (error) {
        console.error('Error fetching notes:', error);
        res.status(500).json({ error: '获取笔记失败' });
    }
});

// 获取单个笔记
router.get('/:id', async (req, res) => {
    try {
        const data = await readNotesData();
        const note = data.notes.find(n => n.id === req.params.id);
        
        if (!note) {
            return res.status(404).json({ error: '笔记不存在' });
        }
        
        res.json(note);
    } catch (error) {
        console.error('Error fetching note:', error);
        res.status(500).json({ error: '获取笔记失败' });
    }
});

// 创建新笔记
router.post('/', upload.single('image'), async (req, res) => {
    try {
        const { title, content, theme, tags, source } = req.body;
        
        if (!title || !content) {
            return res.status(400).json({ error: '标题和内容不能为空' });
        }
        
        const newNote = {
            id: uuidv4(),
            title: title.trim(),
            content: content.trim(),
            type: req.file ? 'image' : 'text',
            theme: theme || 'default',
            source: source ? JSON.parse(source) : null,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
            tags: tags ? JSON.parse(tags) : [],
            image_path: req.file ? `images/${req.file.filename}` : null
        };
        
        const data = await readNotesData();
        data.notes.push(newNote);
        await writeNotesData(data);
        
        // 更新主题计数
        await updateThemeCount(newNote.theme, 1);
        
        res.status(201).json(newNote);
    } catch (error) {
        console.error('Error creating note:', error);
        res.status(500).json({ error: '创建笔记失败' });
    }
});

// 更新笔记
router.put('/:id', upload.single('image'), async (req, res) => {
    try {
        const { title, content, theme, tags } = req.body;
        const data = await readNotesData();
        const noteIndex = data.notes.findIndex(n => n.id === req.params.id);
        
        if (noteIndex === -1) {
            return res.status(404).json({ error: '笔记不存在' });
        }
        
        const oldNote = data.notes[noteIndex];
        const oldTheme = oldNote.theme;
        
        // 更新笔记信息
        data.notes[noteIndex] = {
            ...oldNote,
            title: title ? title.trim() : oldNote.title,
            content: content ? content.trim() : oldNote.content,
            theme: theme || oldNote.theme,
            tags: tags ? JSON.parse(tags) : oldNote.tags,
            updated_at: new Date().toISOString(),
            image_path: req.file ? `images/${req.file.filename}` : oldNote.image_path,
            type: req.file ? 'image' : oldNote.type
        };
        
        // 如果有新图片，删除旧图片
        if (req.file && oldNote.image_path) {
            const oldImagePath = path.join(config.storage.dataPath, oldNote.image_path);
            try {
                await fs.remove(oldImagePath);
            } catch (err) {
                console.warn('Failed to delete old image:', err);
            }
        }
        
        await writeNotesData(data);
        
        // 更新主题计数
        if (oldTheme !== data.notes[noteIndex].theme) {
            await updateThemeCount(oldTheme, -1);
            await updateThemeCount(data.notes[noteIndex].theme, 1);
        }
        
        res.json(data.notes[noteIndex]);
    } catch (error) {
        console.error('Error updating note:', error);
        res.status(500).json({ error: '更新笔记失败' });
    }
});

// 删除笔记
router.delete('/:id', async (req, res) => {
    try {
        const data = await readNotesData();
        const noteIndex = data.notes.findIndex(n => n.id === req.params.id);
        
        if (noteIndex === -1) {
            return res.status(404).json({ error: '笔记不存在' });
        }
        
        const note = data.notes[noteIndex];
        
        // 删除关联的图片文件
        if (note.image_path) {
            const imagePath = path.join(config.storage.dataPath, note.image_path);
            try {
                await fs.remove(imagePath);
            } catch (err) {
                console.warn('Failed to delete image file:', err);
            }
        }
        
        // 从数组中移除笔记
        data.notes.splice(noteIndex, 1);
        await writeNotesData(data);
        
        // 更新主题计数
        await updateThemeCount(note.theme, -1);
        
        res.json({ message: '笔记删除成功' });
    } catch (error) {
        console.error('Error deleting note:', error);
        res.status(500).json({ error: '删除笔记失败' });
    }
});

module.exports = router;
