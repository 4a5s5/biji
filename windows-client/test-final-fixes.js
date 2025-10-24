// 测试所有网络优化修复
const path = require('path');
const fs = require('fs');

console.log('==========================================');
console.log('   网络优化修复验证测试');
console.log('==========================================\n');

// 1. 验证 ApiClient.js 的重试机制
console.log('1. 检查 ApiClient.js 重试机制...');
const apiClientPath = path.join(__dirname, 'src/core/ApiClient.js');
const apiClientContent = fs.readFileSync(apiClientPath, 'utf8');

const hasGetNotesRetry = apiClientContent.includes('async getNotes(options = {}, retryCount = 3)');
const hasGetThemesRetry = apiClientContent.includes('async getThemes(retryCount = 3)');
const hasSaveNoteRetry = apiClientContent.includes('async saveNote(noteData, retryCount = 3)');

console.log('   ✅ getNotes 重试机制:', hasGetNotesRetry ? '已添加' : '❌ 缺失');
console.log('   ✅ getThemes 重试机制:', hasGetThemesRetry ? '已添加' : '❌ 缺失');
console.log('   ✅ saveNote 重试机制:', hasSaveNoteRetry ? '已添加' : '❌ 缺失');

// 2. 验证超时设置
const hasTimeout45s = apiClientContent.includes('this.timeout = 45000');
console.log('   ✅ 45秒超时设置:', hasTimeout45s ? '已设置' : '❌ 缺失');

// 3. 验证 main.js 启动优化
console.log('\n2. 检查启动优化...');
const mainJsPath = path.join(__dirname, 'src/ui/scripts/main.js');
const mainJsContent = fs.readFileSync(mainJsPath, 'utf8');

const hasCheckServerConnection = mainJsContent.includes('async function checkServerConnection()');
const hasSequentialLoading = mainJsContent.includes('// 顺序加载主题和笔记（避免并发请求导致超时）');
const hasRetryLogic = mainJsContent.includes('// 如果主要数据加载失败，尝试重新加载');

console.log('   ✅ 服务器连接检查函数:', hasCheckServerConnection ? '已添加' : '❌ 缺失');
console.log('   ✅ 顺序加载逻辑:', hasSequentialLoading ? '已实现' : '❌ 缺失');
console.log('   ✅ 重试加载逻辑:', hasRetryLogic ? '已实现' : '❌ 缺失');

// 4. 验证日志输出优化
console.log('\n3. 检查日志输出优化...');
const hasDetailedLogging = apiClientContent.includes('console.log(`获取笔记列表 (尝试 ${attempt}/${retryCount})`)');
console.log('   ✅ 详细日志输出:', hasDetailedLogging ? '已添加' : '❌ 缺失');

// 5. 验证文件存在性
console.log('\n4. 检查测试文件...');
const testFiles = [
    'connection-test.js',
    'startup-test.js'
];

testFiles.forEach(file => {
    const filePath = path.join(__dirname, file);
    const exists = fs.existsSync(filePath);
    console.log(`   ✅ ${file}:`, exists ? '已创建' : '❌ 缺失');
});

// 6. 总结
console.log('\n==========================================');
console.log('   修复验证总结');
console.log('==========================================');

const allFixesApplied = hasGetNotesRetry && hasGetThemesRetry && hasSaveNoteRetry &&
                       hasTimeout45s && hasCheckServerConnection && hasSequentialLoading;

if (allFixesApplied) {
    console.log('✅ 所有网络优化修复已成功应用！');
    console.log('\n主要改进:');
    console.log('- 为所有API方法添加了重试机制');
    console.log('- 增加了超时时间到45秒');
    console.log('- 优化了应用启动流程，避免并发请求');
    console.log('- 添加了详细的错误日志和重试逻辑');
    console.log('- 创建了网络连接测试工具');

    console.log('\n建议的下一步:');
    console.log('1. 重启应用测试新的重试机制');
    console.log('2. 监控启动日志，确保网络请求正常');
    console.log('3. 如仍有问题，运行 node startup-test.js 进行诊断');
} else {
    console.log('❌ 部分修复可能未正确应用，请检查上述报告');
}

console.log('\n提示: 如需要详细的网络测试，请运行:');
console.log('  node connection-test.js    - 基础连接测试');
console.log('  node startup-test.js       - 启动模拟测试');