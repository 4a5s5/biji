// 修复配置脚本
const Store = require('electron-store');
const path = require('path');
const fs = require('fs');

console.log('==========================================');
console.log('   Smart Note Collector 配置修复工具');
console.log('==========================================\n');

// 创建store实例
const store = new Store();

// 正确的服务器地址
const CORRECT_SERVER_URL = 'https://xhbahrcgycil.ap-northeast-1.clawcloudrun.com';

console.log('1. 检查当前配置...');
console.log('   配置文件路径:', store.path);

// 获取所有配置
const allConfig = store.store;
console.log('\n2. 当前所有配置:');
Object.keys(allConfig).forEach(key => {
    console.log(`   ${key}: ${JSON.stringify(allConfig[key])}`);
});

// 清理错误的服务器地址
console.log('\n3. 清理错误配置...');

// 强制设置正确的服务器地址
store.set('serverUrl', CORRECT_SERVER_URL);
console.log('   ✅ 已设置正确的服务器地址:', CORRECT_SERVER_URL);

// 清理可能存在的其他错误配置
const keysToCheck = ['apiUrl', 'baseUrl', 'server', 'endpoint'];
keysToCheck.forEach(key => {
    if (store.has(key)) {
        console.log(`   ⚠️ 发现可疑配置 "${key}": ${store.get(key)}`);
        store.delete(key);
        console.log(`   ✅ 已删除 "${key}"`);
    }
});

// 验证配置
console.log('\n4. 验证新配置...');
const newServerUrl = store.get('serverUrl');
console.log('   当前服务器地址:', newServerUrl);

if (newServerUrl === CORRECT_SERVER_URL) {
    console.log('   ✅ 配置修复成功！');
} else {
    console.log('   ❌ 配置修复失败，请手动检查');
}

// 显示配置文件内容
console.log('\n5. 配置文件内容:');
try {
    const configContent = fs.readFileSync(store.path, 'utf-8');
    console.log(configContent);
} catch (error) {
    console.log('   无法读取配置文件:', error.message);
}

console.log('\n==========================================');
console.log('修复完成！请重新启动应用程序。');
console.log('==========================================');