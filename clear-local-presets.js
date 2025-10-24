// 清除本地存储中的预设数据的脚本
// 在浏览器控制台中运行此脚本

function clearLocalPresets() {
    try {
        // 获取当前的本地配置
        const localConfig = localStorage.getItem('aiConfig');
        if (localConfig) {
            const parsed = JSON.parse(localConfig);
            console.log('当前本地配置:', parsed);
            
            // 移除预设相关数据
            if (parsed.presets) {
                console.log('发现本地预设数据，正在清除...', parsed.presets);
                delete parsed.presets;
            }
            
            if (parsed.defaultPreset) {
                console.log('发现本地默认预设，正在清除...', parsed.defaultPreset);
                delete parsed.defaultPreset;
            }
            
            // 保存清理后的配置
            localStorage.setItem('aiConfig', JSON.stringify(parsed));
            console.log('本地预设数据已清除，新配置:', parsed);
        } else {
            console.log('未发现本地配置');
        }
        
        // 刷新页面以重新加载
        console.log('请刷新页面以重新从数据库加载预设');
        return true;
    } catch (error) {
        console.error('清除本地预设失败:', error);
        return false;
    }
}

// 执行清除
clearLocalPresets();
