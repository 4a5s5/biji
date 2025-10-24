const express = require('express');
const router = express.Router();
const DatabaseManager = require('../../core/DatabaseManager');

const dbManager = new DatabaseManager();

// 初始化数据库连接
let dbInitialized = false;
async function ensureDbInitialized() {
    if (!dbInitialized) {
        await dbManager.initialize();
        dbInitialized = true;
    }
}

// 获取所有AI预设
router.get('/', async (req, res) => {
    try {
        await ensureDbInitialized();
        const presets = await dbManager.getAllAIPresets();
        res.json({ presets });
    } catch (error) {
        console.error('获取AI预设失败:', error);
        res.status(500).json({ 
            error: '获取AI预设失败', 
            message: error.message 
        });
    }
});

// 获取默认AI预设
router.get('/default', async (req, res) => {
    try {
        await ensureDbInitialized();
        const defaultPreset = await dbManager.getDefaultAIPreset();
        res.json({ defaultPreset });
    } catch (error) {
        console.error('获取默认AI预设失败:', error);
        res.status(500).json({ 
            error: '获取默认AI预设失败', 
            message: error.message 
        });
    }
});

// 获取单个AI预设
router.get('/:id', async (req, res) => {
    try {
        await ensureDbInitialized();
        const preset = await dbManager.getAIPresetById(req.params.id);
        if (!preset) {
            return res.status(404).json({ error: 'AI预设不存在' });
        }
        res.json({ preset });
    } catch (error) {
        console.error('获取AI预设失败:', error);
        res.status(500).json({ 
            error: '获取AI预设失败', 
            message: error.message 
        });
    }
});

// 创建AI预设
router.post('/', async (req, res) => {
    try {
        await ensureDbInitialized();
        console.log('接收到创建预设请求:', req.body);
        
        const { name, prompt, is_default } = req.body;
        
        if (!name || !prompt) {
            console.error('预设创建失败 - 缺少必要字段:', { name, prompt });
            return res.status(400).json({ 
                error: '缺少必要字段', 
                message: '预设名称和内容不能为空' 
            });
        }

        const presetData = {
            name: name.trim(),
            prompt: prompt.trim(),
            is_default: Boolean(is_default)
        };

        console.log('准备创建预设:', presetData);
        const result = await dbManager.createAIPreset(presetData);
        console.log('预设创建成功:', result);
        
        // 如果设置为默认预设，需要更新其他预设的默认状态
        if (is_default) {
            await dbManager.setDefaultAIPreset(result.id);
        }
        
        res.status(201).json({ 
            message: 'AI预设创建成功', 
            preset: { id: result.id, ...presetData }
        });
    } catch (error) {
        console.error('创建AI预设失败:', error);
        res.status(500).json({ 
            error: '创建AI预设失败', 
            message: error.message 
        });
    }
});

// 更新AI预设
router.put('/:id', async (req, res) => {
    try {
        await ensureDbInitialized();
        const { name, prompt, is_default } = req.body;
        const presetId = req.params.id;
        
        if (!name || !prompt) {
            return res.status(400).json({ 
                error: '缺少必要字段', 
                message: '预设名称和内容不能为空' 
            });
        }

        const updates = {
            name,
            prompt,
            is_default: Boolean(is_default)
        };

        const result = await dbManager.updateAIPreset(presetId, updates);
        
        if (result.changes === 0) {
            return res.status(404).json({ error: 'AI预设不存在' });
        }
        
        // 如果设置为默认预设，需要更新其他预设的默认状态
        if (is_default) {
            await dbManager.setDefaultAIPreset(presetId);
        } else {
            // 如果取消默认，检查是否需要清除默认状态
            const currentPreset = await dbManager.getAIPresetById(presetId);
            if (currentPreset && currentPreset.is_default) {
                await dbManager.setDefaultAIPreset(null);
            }
        }
        
        res.json({ 
            message: 'AI预设更新成功', 
            preset: { id: presetId, ...updates }
        });
    } catch (error) {
        console.error('更新AI预设失败:', error);
        res.status(500).json({ 
            error: '更新AI预设失败', 
            message: error.message 
        });
    }
});

// 设置默认预设
router.put('/:id/default', async (req, res) => {
    try {
        await ensureDbInitialized();
        const presetId = req.params.id;
        
        // 检查预设是否存在
        const preset = await dbManager.getAIPresetById(presetId);
        if (!preset) {
            return res.status(404).json({ error: 'AI预设不存在' });
        }
        
        await dbManager.setDefaultAIPreset(presetId);
        
        res.json({ 
            message: '默认预设设置成功', 
            defaultPresetId: presetId 
        });
    } catch (error) {
        console.error('设置默认预设失败:', error);
        res.status(500).json({ 
            error: '设置默认预设失败', 
            message: error.message 
        });
    }
});

// 清除默认预设
router.delete('/default', async (req, res) => {
    try {
        await ensureDbInitialized();
        await dbManager.setDefaultAIPreset(null);
        
        res.json({ message: '默认预设已清除' });
    } catch (error) {
        console.error('清除默认预设失败:', error);
        res.status(500).json({ 
            error: '清除默认预设失败', 
            message: error.message 
        });
    }
});

// 删除AI预设
router.delete('/:id', async (req, res) => {
    try {
        await ensureDbInitialized();
        const presetId = req.params.id;
        
        const result = await dbManager.deleteAIPreset(presetId);
        
        if (result.changes === 0) {
            return res.status(404).json({ error: 'AI预设不存在' });
        }
        
        res.json({ message: 'AI预设删除成功' });
    } catch (error) {
        console.error('删除AI预设失败:', error);
        res.status(500).json({ 
            error: '删除AI预设失败', 
            message: error.message 
        });
    }
});

module.exports = router;
