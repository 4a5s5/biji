// 极简CORS测试服务器
const express = require('express');
const app = express();

// 最强制的CORS设置 - 必须在最前面
app.use((req, res, next) => {
    console.log(`[CORS TEST] ${req.method} ${req.path} from ${req.headers.origin || 'no-origin'}`);
    
    // 无条件设置CORS头
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Methods', '*');
    res.header('Access-Control-Allow-Headers', '*');
    res.header('Access-Control-Allow-Credentials', 'true');
    
    // OPTIONS请求直接返回
    if (req.method === 'OPTIONS') {
        console.log('[CORS TEST] Handling OPTIONS request');
        return res.sendStatus(200);
    }
    
    next();
});

// 测试端点
app.get('/test', (req, res) => {
    res.json({ message: 'CORS is working!', timestamp: new Date().toISOString() });
});

app.get('/api/themes', (req, res) => {
    res.json([
        { id: 1, name: 'default', color: '#4CAF50' },
        { id: 2, name: 'work', color: '#2196F3' }
    ]);
});

const PORT = 3001;
app.listen(PORT, () => {
    console.log(`Test CORS server running on port ${PORT}`);
    console.log('Test with:');
    console.log(`  curl -X OPTIONS http://localhost:${PORT}/test -H "Origin: http://example.com" -v`);
    console.log(`  curl http://localhost:${PORT}/test`);
});
