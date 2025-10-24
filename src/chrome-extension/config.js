// Smart Note Collector - Configuration Manager
// 统一管理插件配置，包括服务器地址

class ConfigManager {
    constructor() {
        this.defaultConfig = {
            serverUrl: 'http://localhost:3000', // 默认本地地址，用户可通过设置修改
            autoSave: true,
            showNotifications: true
        };
    }

    // 获取配置
    async getConfig() {
        try {
            const result = await chrome.storage.local.get(['config']);
            return { ...this.defaultConfig, ...result.config };
        } catch (error) {
            console.error('Failed to get config:', error);
            return this.defaultConfig;
        }
    }

    // 保存配置
    async saveConfig(config) {
        try {
            await chrome.storage.local.set({ config: config });
            return true;
        } catch (error) {
            console.error('Failed to save config:', error);
            return false;
        }
    }

    // 获取服务器地址
    async getServerUrl() {
        const config = await this.getConfig();
        return config.serverUrl;
    }

    // 设置服务器地址
    async setServerUrl(url) {
        const config = await this.getConfig();
        config.serverUrl = url;
        return await this.saveConfig(config);
    }

    // 验证服务器地址格式
    validateServerUrl(url) {
        try {
            const urlObj = new URL(url);
            return urlObj.protocol === 'http:' || urlObj.protocol === 'https:';
        } catch (error) {
            return false;
        }
    }

    // 测试服务器连接
    async testServerConnection(url = null) {
        const serverUrl = url || await this.getServerUrl();
        try {
            const response = await fetch(`${serverUrl}/api/health`, {
                method: 'GET',
                timeout: 5000
            });
            return response.ok;
        } catch (error) {
            console.error('Server connection test failed:', error);
            return false;
        }
    }
}

// 创建全局配置管理器实例（避免重复声明）
if (typeof configManager === 'undefined') {
    var configManager = new ConfigManager();
}

// 导出给其他脚本使用
if (typeof module !== 'undefined' && module.exports) {
    module.exports = ConfigManager;
} else if (typeof window !== 'undefined') {
    // 浏览器环境
    window.ConfigManager = ConfigManager;
    window.configManager = configManager;
} else {
    // Service Worker 环境
    self.ConfigManager = ConfigManager;
    self.configManager = configManager;
}
