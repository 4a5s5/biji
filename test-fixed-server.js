// 测试修复后的服务器
const axios = require('axios');
const FormData = require('form-data');
const fs = require('fs');
const path = require('path');

const SERVER_URL = 'http://localhost:8964';

// 颜色输出
const colors = {
    green: '\x1b[32m',
    red: '\x1b[31m',
    yellow: '\x1b[33m',
    blue: '\x1b[34m',
    reset: '\x1b[0m'
};

function log(message, color = 'reset') {
    console.log(`${colors[color]}${message}${colors.reset}`);
}

// 测试CORS预检请求
async function testCORSPreflight() {
    log('\n=== 测试CORS预检请求 ===', 'blue');
    
    try {
        const response = await axios({
            method: 'OPTIONS',
            url: `${SERVER_URL}/api/ocr`,
            headers: {
                'Origin': 'https://www.xinhuanet.com',
                'Access-Control-Request-Method': 'POST',
                'Access-Control-Request-Headers': 'content-type'
            }
        });
        
        log('✓ OPTIONS预检请求成功', 'green');
        log(`  状态码: ${response.status}`, 'green');
        log(`  CORS头:`, 'green');
        log(`    Access-Control-Allow-Origin: ${response.headers['access-control-allow-origin']}`, 'green');
        log(`    Access-Control-Allow-Methods: ${response.headers['access-control-allow-methods']}`, 'green');
        return true;
    } catch (error) {
        log('✗ OPTIONS预检请求失败', 'red');
        log(`  错误: ${error.message}`, 'red');
        if (error.response) {
            log(`  响应状态: ${error.response.status}`, 'red');
        }
        return false;
    }
}

// 测试健康检查
async function testHealth() {
    log('\n=== 测试健康检查 ===', 'blue');
    
    try {
        const response = await axios.get(`${SERVER_URL}/health`);
        log('✓ 健康检查成功', 'green');
        log(`  响应: ${JSON.stringify(response.data, null, 2)}`, 'green');
        return true;
    } catch (error) {
        log('✗ 健康检查失败', 'red');
        log(`  错误: ${error.message}`, 'red');
        return false;
    }
}

// 测试跨域POST请求
async function testCORSPost() {
    log('\n=== 测试跨域POST请求 ===', 'blue');
    
    try {
        const response = await axios({
            method: 'POST',
            url: `${SERVER_URL}/api/ocr`,
            headers: {
                'Origin': 'chrome-extension://abcdefghijklmnop',
                'Content-Type': 'application/json'
            },
            data: {
                image: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==',
                language: 'chi_sim'
            }
        });
        
        log('✓ 跨域POST请求成功', 'green');
        log(`  状态码: ${response.status}`, 'green');
        log(`  CORS头: ${response.headers['access-control-allow-origin']}`, 'green');
        return true;
    } catch (error) {
        log('✗ 跨域POST请求失败', 'red');
        log(`  错误: ${error.message}`, 'red');
        if (error.response) {
            log(`  响应状态: ${error.response.status}`, 'red');
            log(`  响应数据: ${JSON.stringify(error.response.data)}`, 'red');
        }
        return false;
    }
}

// 创建测试图片
async function createTestImage() {
    const testImagePath = path.join(__dirname, 'test-chinese.png');
    
    // 创建一个简单的测试图片（1x1像素）
    const buffer = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==', 'base64');
    
    fs.writeFileSync(testImagePath, buffer);
    return testImagePath;
}

// 测试文件上传
async function testFileUpload() {
    log('\n=== 测试文件上传 ===', 'blue');
    
    try {
        const imagePath = await createTestImage();
        const form = new FormData();
        form.append('image', fs.createReadStream(imagePath));
        
        const response = await axios.post(`${SERVER_URL}/api/upload`, form, {
            headers: {
                ...form.getHeaders(),
                'Origin': 'http://localhost:3000'
            }
        });
        
        log('✓ 文件上传成功', 'green');
        log(`  响应: ${JSON.stringify(response.data, null, 2)}`, 'green');
        
        // 清理测试文件
        fs.unlinkSync(imagePath);
        
        return response.data.url;
    } catch (error) {
        log('✗ 文件上传失败', 'red');
        log(`  错误: ${error.message}`, 'red');
        if (error.response) {
            log(`  响应状态: ${error.response.status}`, 'red');
            log(`  响应数据: ${JSON.stringify(error.response.data)}`, 'red');
        }
        return null;
    }
}

// 测试OCR识别
async function testOCR(imageUrl) {
    log('\n=== 测试OCR识别 ===', 'blue');
    
    try {
        const response = await axios.post(`${SERVER_URL}/api/ocr`, {
            image: imageUrl || 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==',
            language: 'chi_sim'
        }, {
            headers: {
                'Origin': 'https://www.xinhuanet.com'
            }
        });
        
        log('✓ OCR识别成功', 'green');
        log(`  响应: ${JSON.stringify(response.data, null, 2)}`, 'green');
        return true;
    } catch (error) {
        log('✗ OCR识别失败', 'red');
        log(`  错误: ${error.message}`, 'red');
        if (error.response) {
            log(`  响应状态: ${error.response.status}`, 'red');
            log(`  响应数据: ${JSON.stringify(error.response.data)}`, 'red');
        }
        return false;
    }
}

// 主测试函数
async function runTests() {
    log('开始测试修复后的服务器...', 'yellow');
    log(`服务器地址: ${SERVER_URL}`, 'yellow');
    
    let results = {
        health: false,
        corsPreflight: false,
        corsPost: false,
        upload: false,
        ocr: false
    };
    
    // 等待服务器启动
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // 运行测试
    results.health = await testHealth();
    results.corsPreflight = await testCORSPreflight();
    results.corsPost = await testCORSPost();
    
    const uploadedUrl = await testFileUpload();
    results.upload = !!uploadedUrl;
    
    if (uploadedUrl) {
        results.ocr = await testOCR(uploadedUrl);
    } else {
        results.ocr = await testOCR();
    }
    
    // 显示测试结果
    log('\n=== 测试结果汇总 ===', 'blue');
    Object.entries(results).forEach(([test, passed]) => {
        log(`${passed ? '✓' : '✗'} ${test}: ${passed ? '通过' : '失败'}`, passed ? 'green' : 'red');
    });
    
    const allPassed = Object.values(results).every(r => r);
    log(`\n总体结果: ${allPassed ? '全部通过 ✓' : '存在失败 ✗'}`, allPassed ? 'green' : 'red');
    
    if (allPassed) {
        log('\n恭喜！服务器CORS和OCR功能都正常工作！', 'green');
        log('现在可以将 full-server-fixed.js 替换原来的 full-server.js 使用了。', 'green');
    } else {
        log('\n还有一些问题需要解决，请检查服务器日志。', 'yellow');
    }
}

// 运行测试
runTests().catch(error => {
    log(`测试运行失败: ${error.message}`, 'red');
    console.error(error);
});
