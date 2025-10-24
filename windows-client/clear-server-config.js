// 清理错误的服务器配置
const Store = require('electron-store');
const store = new Store();

// 获取当前配置
const currentServerUrl = store.get('serverUrl');
console.log('当前服务器地址:', currentServerUrl);

// 如果是错误的地址（包含47.79.87.5），清除它
if (currentServerUrl && (currentServerUrl.includes('47.79.87.5') || currentServerUrl === 'http://localhost:3000')) {
    console.log('检测到错误的服务器地址，正在清除...');
    store.delete('serverUrl');
    console.log('✅ 已清除错误的服务器地址配置');
    console.log('应用将使用新的默认地址: https://xhbahrcgycil.ap-northeast-1.clawcloudrun.com');
} else if (currentServerUrl) {
    console.log('当前服务器地址看起来正确，保留配置');
} else {
    console.log('没有找到服务器地址配置，将使用默认地址');
}