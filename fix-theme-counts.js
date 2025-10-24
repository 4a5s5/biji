// 修复主题计数问题
const fs = require('fs').promises;
const path = require('path');

async function fixThemeCounts() {
    console.log('🔧 修复主题计数...\n');

    try {
        // 读取笔记数据
        const notesFile = path.join(__dirname, 'data', 'notes.json');
        const notesData = JSON.parse(await fs.readFile(notesFile, 'utf8'));
        
        // 读取主题数据
        const themesFile = path.join(__dirname, 'data', 'themes.json');
        const themesData = JSON.parse(await fs.readFile(themesFile, 'utf8'));

        console.log('📊 当前数据统计:');
        console.log(`总笔记数: ${notesData.notes.length}`);
        console.log(`总主题数: ${themesData.themes.length}`);

        // 统计每个主题的笔记数量
        const themeCounts = {};
        notesData.notes.forEach(note => {
            const theme = note.theme || 'default';
            themeCounts[theme] = (themeCounts[theme] || 0) + 1;
        });

        console.log('\n📈 实际笔记分布:');
        Object.entries(themeCounts).forEach(([themeId, count]) => {
            const theme = themesData.themes.find(t => t.id === themeId);
            const themeName = theme ? theme.name : '未知主题';
            console.log(`${themeName} (${themeId}): ${count} 条笔记`);
        });

        // 更新主题计数
        console.log('\n🔄 更新主题计数...');
        themesData.themes.forEach(theme => {
            const oldCount = theme.note_count || theme.noteCount || 0;
            const newCount = themeCounts[theme.id] || 0;
            
            // 统一使用 noteCount 字段
            theme.noteCount = newCount;
            
            // 保留旧字段以兼容
            theme.note_count = newCount;
            
            if (oldCount !== newCount) {
                console.log(`${theme.name}: ${oldCount} → ${newCount}`);
            }
        });

        // 保存更新后的主题数据
        await fs.writeFile(themesFile, JSON.stringify(themesData, null, 2));

        console.log('\n✅ 主题计数修复完成！');
        
        // 验证修复结果
        console.log('\n📊 修复后的主题统计:');
        themesData.themes.forEach(theme => {
            console.log(`${theme.name}: ${theme.noteCount} 条笔记`);
        });

        const totalNotes = themesData.themes.reduce((sum, theme) => sum + (theme.noteCount || 0), 0);
        console.log(`\n总计: ${totalNotes} 条笔记`);

        if (totalNotes === notesData.notes.length) {
            console.log('✅ 计数验证通过！');
        } else {
            console.log('⚠️ 计数不匹配，可能存在孤立笔记');
        }

    } catch (error) {
        console.error('❌ 修复主题计数失败:', error);
    }
}

// 运行修复
fixThemeCounts();
