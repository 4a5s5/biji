// DNS和网络排查工具
const dns = require('dns');
const { promisify } = require('util');
const axios = require('axios');

const resolve = promisify(dns.resolve);

async function diagnoseNetwork() {
    console.log('==========================================');
    console.log('   网络诊断工具');
    console.log('==========================================\n');

    const targetDomain = 'xhbahrcgycil.ap-northeast-1.clawcloudrun.com';
    const targetUrl = 'https://xhbahrcgycil.ap-northeast-1.clawcloudrun.com';

    // 1. DNS解析测试
    console.log('1. DNS解析测试');
    try {
        const addresses = await resolve(targetDomain, 'A');
        console.log(`   ✅ DNS解析成功: ${targetDomain}`);
        addresses.forEach(ip => {
            console.log(`   📍 IP地址: ${ip}`);
        });
    } catch (error) {
        console.log(`   ❌ DNS解析失败: ${error.message}`);
    }

    // 2. 系统DNS配置
    console.log('\n2. 系统DNS配置');
    try {
        const servers = dns.getServers();
        console.log('   当前DNS服务器:');
        servers.forEach(server => {
            console.log(`   📍 ${server}`);
        });
    } catch (error) {
        console.log(`   ❌ 获取DNS服务器失败: ${error.message}`);
    }

    // 3. 代理设置检查
    console.log('\n3. 代理设置检查');
    const proxyEnvs = ['HTTP_PROXY', 'HTTPS_PROXY', 'http_proxy', 'https_proxy', 'ALL_PROXY'];
    let hasProxy = false;
    proxyEnvs.forEach(env => {
        if (process.env[env]) {
            console.log(`   ⚠️ 发现代理设置 ${env}: ${process.env[env]}`);
            hasProxy = true;
        }
    });
    if (!hasProxy) {
        console.log('   ✅ 未发现环境变量代理设置');
    }

    // 4. 直接连接测试
    console.log('\n4. 直接连接测试');
    try {
        console.log(`   正在测试连接: ${targetUrl}/api/health`);
        const response = await axios.get(`${targetUrl}/api/health`, {
            timeout: 10000,
            headers: {
                'User-Agent': 'Network-Diagnostic-Tool/1.0.0'
            }
        });
        console.log(`   ✅ 连接成功: HTTP ${response.status}`);
        console.log(`   📄 响应数据:`, response.data);
    } catch (error) {
        console.log(`   ❌ 连接失败: ${error.message}`);
        if (error.response) {
            console.log(`   📄 响应状态: ${error.response.status}`);
            console.log(`   📄 响应数据:`, error.response.data);
        }
        if (error.code) {
            console.log(`   📄 错误代码: ${error.code}`);
        }
        if (error.config && error.config.proxy) {
            console.log(`   📄 使用的代理:`, error.config.proxy);
        }
    }

    // 5. 检查可用的API端点
    console.log('\n5. 检查API端点');
    const endpoints = [
        '/api/health',
        '/api/upload/image',
        '/api/upload',
        '/api/quick-import'
    ];

    for (const endpoint of endpoints) {
        try {
            const url = `${targetUrl}${endpoint}`;
            console.log(`   测试: ${endpoint}`);
            const response = await axios.get(url, {
                timeout: 5000,
                validateStatus: () => true // 接受所有状态码
            });
            console.log(`     ✅ 响应: HTTP ${response.status}`);
        } catch (error) {
            console.log(`     ❌ 错误: ${error.message}`);
        }
    }

    console.log('\n==========================================');
    console.log('诊断完成');
    console.log('==========================================');
}

// 运行诊断
diagnoseNetwork().catch(console.error);