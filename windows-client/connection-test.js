// 连接测试和修复工具
const axios = require('axios');

async function testConnection() {
    console.log('==========================================');
    console.log('   连接测试和修复工具');
    console.log('==========================================\n');

    const serverUrl = 'https://xhbahrcgycil.ap-northeast-1.clawcloudrun.com';

    // 1. 基础连接测试
    console.log('1. 测试基础连接...');
    try {
        const response = await axios.get(`${serverUrl}/api/health`, {
            timeout: 15000,
            headers: {
                'User-Agent': 'Smart Note Collector Connection Test/1.0.0'
            }
        });
        console.log('   ✅ 基础连接成功:', response.status, response.data);
    } catch (error) {
        console.log('   ❌ 基础连接失败:', error.message);
        return false;
    }

    // 2. 测试主题API
    console.log('\n2. 测试主题API...');
    try {
        const response = await axios.get(`${serverUrl}/api/themes`, {
            timeout: 15000,
            headers: {
                'User-Agent': 'Smart Note Collector Connection Test/1.0.0'
            }
        });
        console.log('   ✅ 主题API成功:', response.status, '返回', response.data.length, '个主题');
    } catch (error) {
        console.log('   ❌ 主题API失败:', error.message);
    }

    // 3. 测试笔记API
    console.log('\n3. 测试笔记API...');
    try {
        const response = await axios.get(`${serverUrl}/api/notes`, {
            timeout: 15000,
            params: {
                page: 1,
                limit: 5
            },
            headers: {
                'User-Agent': 'Smart Note Collector Connection Test/1.0.0'
            }
        });
        console.log('   ✅ 笔记API成功:', response.status, '返回', response.data.notes?.length || 0, '条笔记');
    } catch (error) {
        console.log('   ❌ 笔记API失败:', error.message);
    }

    // 4. 网络延迟测试
    console.log('\n4. 网络延迟测试...');
    const delays = [];
    for (let i = 1; i <= 3; i++) {
        try {
            const start = Date.now();
            await axios.get(`${serverUrl}/api/health`, {
                timeout: 10000,
                headers: {
                    'User-Agent': 'Smart Note Collector Ping Test/1.0.0'
                }
            });
            const delay = Date.now() - start;
            delays.push(delay);
            console.log(`   测试 ${i}: ${delay}ms`);
        } catch (error) {
            console.log(`   测试 ${i}: 失败 (${error.message})`);
        }
    }

    if (delays.length > 0) {
        const avgDelay = Math.round(delays.reduce((a, b) => a + b, 0) / delays.length);
        console.log(`   平均延迟: ${avgDelay}ms`);

        if (avgDelay > 10000) {
            console.log('   ⚠️ 网络延迟较高，建议增加超时时间');
        } else if (avgDelay > 5000) {
            console.log('   ⚠️ 网络延迟偏高，可能需要优化');
        } else {
            console.log('   ✅ 网络延迟正常');
        }
    }

    return true;
}

// 运行测试
testConnection().catch(console.error);