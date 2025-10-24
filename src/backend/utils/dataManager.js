const fs = require('fs-extra');
const path = require('path');
const config = require('../../../config/app.json');

/**
 * 读取笔记数据
 */
async function readNotesData() {
    try {
        const notesFile = config.storage.notesFile;
        
        // 确保文件存在
        if (!await fs.pathExists(notesFile)) {
            const defaultData = { notes: [] };
            await fs.writeJson(notesFile, defaultData);
            return defaultData;
        }
        
        const data = await fs.readJson(notesFile);
        return data;
    } catch (error) {
        console.error('Error reading notes data:', error);
        throw new Error('读取笔记数据失败');
    }
}

/**
 * 写入笔记数据
 */
async function writeNotesData(data) {
    try {
        const notesFile = config.storage.notesFile;
        await fs.writeJson(notesFile, data, { spaces: 2 });
    } catch (error) {
        console.error('Error writing notes data:', error);
        throw new Error('写入笔记数据失败');
    }
}

/**
 * 读取主题数据
 */
async function readThemesData() {
    try {
        const themesFile = config.storage.themesFile;
        
        // 确保文件存在
        if (!await fs.pathExists(themesFile)) {
            const defaultData = {
                themes: [
                    {
                        id: "default",
                        name: "默认主题",
                        color: "#3498db",
                        icon: "default",
                        created_at: new Date().toISOString(),
                        note_count: 0
                    }
                ]
            };
            await fs.writeJson(themesFile, defaultData);
            return defaultData;
        }
        
        const data = await fs.readJson(themesFile);
        return data;
    } catch (error) {
        console.error('Error reading themes data:', error);
        throw new Error('读取主题数据失败');
    }
}

/**
 * 写入主题数据
 */
async function writeThemesData(data) {
    try {
        const themesFile = config.storage.themesFile;
        await fs.writeJson(themesFile, data, { spaces: 2 });
    } catch (error) {
        console.error('Error writing themes data:', error);
        throw new Error('写入主题数据失败');
    }
}

/**
 * 更新主题的笔记计数
 */
async function updateThemeCount(themeId, delta) {
    try {
        const data = await readThemesData();
        const themeIndex = data.themes.findIndex(t => t.id === themeId);
        
        if (themeIndex !== -1) {
            data.themes[themeIndex].note_count = Math.max(0, data.themes[themeIndex].note_count + delta);
            await writeThemesData(data);
        }
    } catch (error) {
        console.error('Error updating theme count:', error);
        // 不抛出错误，因为这不是关键操作
    }
}

/**
 * 重新计算所有主题的笔记计数
 */
async function recalculateThemeCounts() {
    try {
        const notesData = await readNotesData();
        const themesData = await readThemesData();
        
        // 重置所有主题的计数
        themesData.themes.forEach(theme => {
            theme.note_count = 0;
        });
        
        // 重新计算每个主题的笔记数量
        notesData.notes.forEach(note => {
            const themeIndex = themesData.themes.findIndex(t => t.id === note.theme);
            if (themeIndex !== -1) {
                themesData.themes[themeIndex].note_count++;
            }
        });
        
        await writeThemesData(themesData);
        console.log('Theme counts recalculated successfully');
    } catch (error) {
        console.error('Error recalculating theme counts:', error);
        throw new Error('重新计算主题计数失败');
    }
}

/**
 * 备份数据
 */
async function backupData() {
    try {
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const backupDir = path.join(config.storage.dataPath, 'backups');
        
        await fs.ensureDir(backupDir);
        
        // 备份笔记数据
        const notesBackupFile = path.join(backupDir, `notes-${timestamp}.json`);
        await fs.copy(config.storage.notesFile, notesBackupFile);
        
        // 备份主题数据
        const themesBackupFile = path.join(backupDir, `themes-${timestamp}.json`);
        await fs.copy(config.storage.themesFile, themesBackupFile);
        
        // 清理旧备份（保留最近10个）
        const backupFiles = await fs.readdir(backupDir);
        const sortedBackups = backupFiles
            .filter(file => file.startsWith('notes-') || file.startsWith('themes-'))
            .sort()
            .reverse();
        
        if (sortedBackups.length > 20) { // 10个笔记备份 + 10个主题备份
            const filesToDelete = sortedBackups.slice(20);
            for (const file of filesToDelete) {
                await fs.remove(path.join(backupDir, file));
            }
        }
        
        console.log(`Data backup created: ${timestamp}`);
        return { notesBackup: notesBackupFile, themesBackup: themesBackupFile };
    } catch (error) {
        console.error('Error creating backup:', error);
        throw new Error('创建数据备份失败');
    }
}

/**
 * 获取数据统计信息
 */
async function getDataStats() {
    try {
        const notesData = await readNotesData();
        const themesData = await readThemesData();
        
        const stats = {
            total_notes: notesData.notes.length,
            total_themes: themesData.themes.length,
            text_notes: notesData.notes.filter(note => note.type === 'text').length,
            image_notes: notesData.notes.filter(note => note.type === 'image').length,
            notes_by_theme: {},
            recent_notes: notesData.notes
                .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
                .slice(0, 10)
                .map(note => ({
                    id: note.id,
                    title: note.title,
                    theme: note.theme,
                    created_at: note.created_at
                }))
        };
        
        // 按主题统计笔记数量
        themesData.themes.forEach(theme => {
            stats.notes_by_theme[theme.name] = notesData.notes.filter(note => note.theme === theme.id).length;
        });
        
        return stats;
    } catch (error) {
        console.error('Error getting data stats:', error);
        throw new Error('获取数据统计失败');
    }
}

module.exports = {
    readNotesData,
    writeNotesData,
    readThemesData,
    writeThemesData,
    updateThemeCount,
    recalculateThemeCounts,
    backupData,
    getDataStats
};
