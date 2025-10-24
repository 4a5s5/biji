// 模拟应用启动时的网络请求测试
const axios = require('axios');

async function simulateAppStartup() {
    console.log('==========================================');
    console.log('   应用启动网络请求模拟测试');
    console.log('==========================================\n');

    const serverUrl = 'https://xhbahrcgycil.ap-northeast-1.clawcloudrun.com';
    const client = axios.create({
        baseURL: serverUrl,
        timeout: 45000, // 45秒超时，和应用中一致
        headers: {
            'Content-Type': 'application/json',
            'User-Agent': 'Smart Note Collector Windows Client/1.0.0'
        }
    });

    // 模拟重试机制
    async function requestWithRetry(endpoint, retryCount = 3) {
        let lastError = null;

        for (let attempt = 1; attempt <= retryCount; attempt++) {
            try {
                console.log(`请求 ${endpoint} (尝试 ${attempt}/${retryCount})`);
                const start = Date.now();

                const response = await client.get(endpoint);
                const duration = Date.now() - start;

                console.log(`✅ ${endpoint} 成功 - ${duration}ms`);
                return response.data;

            } catch (error) {
                lastError = error;
                console.warn(`❌ ${endpoint} 失败，尝试 ${attempt}/${retryCount}: ${error.message}`);

                if (attempt === retryCount) {
                    break;
                }

                // 如果是网络超时错误，等待后重试
                if (error.code === 'ETIMEDOUT' || error.code === 'ECONNRESET' ||
                    (error.response && error.response.status >= 500)) {
                    const waitTime = attempt * 1000;
                    console.log(`   等待 ${waitTime}ms 后重试...`);
                    await new Promise(resolve => setTimeout(resolve, waitTime));
                } else {
                    break;
                }
            }
        }

        console.error(`❌ ${endpoint} 最终失败:`, lastError.message);
        throw lastError;
    }

    // 1. 测试健康检查
    console.log('1. 测试健康检查...');
    try {
        await requestWithRetry('/api/health');
    } catch (error) {
        console.log('健康检查失败，应用可能无法启动');
        return false;
    }

    // 2. 模拟应用启动时的并发请求
    console.log('\n2. 模拟应用启动时的并发请求...');
    try {
        const startTime = Date.now();

        const promises = [
            requestWithRetry('/api/themes'),
            requestWithRetry('/api/notes?page=1&limit=20')
        ];

        const results = await Promise.all(promises);
        const totalTime = Date.now() - startTime;

        console.log(`✅ 并发请求全部成功 - 总耗时 ${totalTime}ms`);
        console.log(`   - 主题数量: ${results[0].length}`);
        console.log(`   - 笔记数量: ${results[1].notes?.length || 0}`);

    } catch (error) {
        console.log('❌ 并发请求失败:', error.message);
    }

    // 3. 连续多次启动测试
    console.log('\n3. 连续多次模拟启动测试...');
    let successCount = 0;
    const testCount = 5;

    for (let i = 1; i <= testCount; i++) {
        try {
            console.log(`\n模拟启动 ${i}/${testCount}:`);

            await requestWithRetry('/api/themes');
            await requestWithRetry('/api/notes?page=1&limit=20');

            successCount++;
            console.log(`   ✅ 启动 ${i} 成功`);

        } catch (error) {
            console.log(`   ❌ 启动 ${i} 失败:`, error.message);
        }

        // 等待一下再进行下次测试
        if (i < testCount) {
            await new Promise(resolve => setTimeout(resolve, 2000));
        }
    }

    console.log(`\n==========================================`);
    console.log(`启动成功率: ${successCount}/${testCount} (${Math.round(successCount/testCount*100)}%)`);

    if (successCount === testCount) {
        console.log('✅ 所有启动测试均成功，网络连接稳定');
    } else if (successCount >= testCount * 0.8) {
        console.log('⚠️ 大部分启动测试成功，但有少量失败');
    } else {
        console.log('❌ 启动测试失败率较高，需要检查网络配置');
    }

    return successCount === testCount;
}

// 运行测试
simulateAppStartup().catch(console.error);