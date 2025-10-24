// API端点探测工具
const axios = require('axios');

async function probeApiEndpoints() {
    console.log('==========================================');
    console.log('   API端点探测工具');
    console.log('==========================================\n');

    const baseUrl = 'https://xhbahrcgycil.ap-northeast-1.clawcloudrun.com';

    // 常见的API端点模式
    const possibleEndpoints = [
        // 上传相关
        '/api/upload/image',
        '/api/upload',
        '/api/files/upload',
        '/api/media/upload',
        '/api/images/upload',
        '/upload/image',
        '/upload',

        // 笔记相关
        '/api/quick-import',
        '/api/notes',
        '/api/note',
        '/api/import',
        '/api/save',
        '/notes',
        '/import',

        // 其他可能的端点
        '/api/themes',
        '/api/export',
        '/api/statistics',
        '/api',
        '/'
    ];

    console.log('正在探测可能的API端点...\n');

    const results = [];

    for (const endpoint of possibleEndpoints) {
        try {
            const url = `${baseUrl}${endpoint}`;
            const response = await axios.get(url, {
                timeout: 5000,
                validateStatus: () => true // 接受所有状态码
            });

            const result = {
                endpoint,
                status: response.status,
                success: response.status < 400
            };

            if (response.data && typeof response.data === 'object') {
                result.data = response.data;
            }

            results.push(result);

            const statusIcon = response.status < 400 ? '✅' : response.status === 404 ? '❌' : '⚠️';
            console.log(`${statusIcon} ${endpoint} - HTTP ${response.status}`);

            if (response.data && response.status < 400) {
                console.log(`   📄 数据:`, JSON.stringify(response.data).substring(0, 100) + '...');
            }

        } catch (error) {
            const result = {
                endpoint,
                status: 'ERROR',
                error: error.message,
                success: false
            };
            results.push(result);
            console.log(`❌ ${endpoint} - 错误: ${error.message}`);
        }
    }

    // 总结有效端点
    console.log('\n==========================================');
    console.log('有效的API端点:');
    console.log('==========================================');

    const validEndpoints = results.filter(r => r.success);
    if (validEndpoints.length > 0) {
        validEndpoints.forEach(endpoint => {
            console.log(`✅ ${endpoint.endpoint} (HTTP ${endpoint.status})`);
        });
    } else {
        console.log('❌ 未找到有效的API端点');
    }

    // 特别检查POST方法
    console.log('\n==========================================');
    console.log('测试POST方法 (笔记保存):');
    console.log('==========================================');

    const postEndpoints = ['/api/quick-import', '/api/notes', '/api/import', '/notes'];

    for (const endpoint of postEndpoints) {
        try {
            const url = `${baseUrl}${endpoint}`;
            const testData = {
                title: '测试笔记',
                content: '这是一个测试笔记',
                theme: 'default'
            };

            const response = await axios.post(url, testData, {
                timeout: 5000,
                validateStatus: () => true,
                headers: {
                    'Content-Type': 'application/json'
                }
            });

            const statusIcon = response.status < 400 ? '✅' : response.status === 404 ? '❌' : '⚠️';
            console.log(`${statusIcon} POST ${endpoint} - HTTP ${response.status}`);

        } catch (error) {
            console.log(`❌ POST ${endpoint} - 错误: ${error.message}`);
        }
    }
}

probeApiEndpoints().catch(console.error);