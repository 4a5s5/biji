// Background script loader - 确保配置管理器在 service worker 中可用
// 由于 service worker 的限制，需要特殊处理配置管理器的加载

// 导入配置管理器代码
importScripts('config.js');

// 初始化配置管理器
let configManager = new ConfigManager();
