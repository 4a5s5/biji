# 📦 最终部署文件清单

## ✅ 需要部署的文件

### 1. 服务器端文件
**`full-server.js`**
- 路径：`/app/full-server.js`（Docker容器中）
- 修改内容：
  - ✅ CORS配置（双重配置，最宽松）
  - ✅ 静态文件服务（多路径支持）
  - ✅ 图片上传API（`/api/upload`）
  - ✅ OCR API（`/api/ocr` 和 `/api/ocr/recognize`）
  - ✅ OCR延迟初始化（避免启动错误）

**`src/core/OCRService.js`**
- 路径：`/app/src/core/OCRService.js`
- 修改内容：
  - ✅ 优化中文识别参数
  - ✅ 错误处理增强

### 2. Chrome扩展文件
**`src/chrome-extension/background.js`**
- 路径：Chrome扩展目录
- 修改内容：
  - ✅ 上传端点统一为 `/api/upload`
  - ✅ OCR端点使用 `/api/ocr`

**`src/chrome-extension/offscreen.js`**
- 路径：Chrome扩展目录
- 修改内容：
  - ✅ 修复devicePixelRatio截图区域问题

### 3. 前端文件
**`public/js/markdown-renderer.js`**
- 路径：`/app/public/js/markdown-renderer.js`
- 新增文件，用于渲染Markdown内容中的图片

**`public/js/notes.js`**
- 路径：`/app/public/js/notes.js`
- 修改内容：
  - ✅ 使用markdown-renderer处理笔记内容

**`public/index.html`**
- 路径：`/app/public/index.html`
- 修改内容：
  - ✅ 引入markdown-renderer.js脚本

## 📋 API端点统一

### 上传图片
- **端点**: `/api/upload`
- **方法**: POST
- **参数**: FormData with `image` field
- **返回**: 
```json
{
  "success": true,
  "url": "/uploads/filename.png",
  "filename": "upload-xxx.png",
  "originalName": "screenshot.png",
  "size": 12345
}
```

### OCR识别
- **端点**: `/api/ocr` 或 `/api/ocr/recognize`
- **方法**: POST
- **参数**: 
```json
{
  "imageUrl": "/uploads/filename.png",
  "language": "chi_sim"  // 可选，默认chi_sim
}
```
- **返回**:
```json
{
  "success": true,
  "text": "识别的文字",
  "confidence": 80,
  "language": "chi_sim",
  "processingTime": 1234
}
```

### OCR状态
- **端点**: `/api/ocr/status`
- **方法**: GET
- **返回**:
```json
{
  "success": true,
  "status": {
    "initialized": true,
    "currentLanguage": "chi_sim",
    "worker": "ready"
  }
}
```

## 🚀 部署步骤

### 1. 服务器端部署
```bash
# 1. 上传修改后的文件到服务器
- full-server.js
- src/core/OCRService.js
- public/js/markdown-renderer.js
- public/js/notes.js
- public/index.html

# 2. 重启Docker容器（会自动运行full-server.js）
```

### 2. Chrome扩展更新
```bash
# 1. 更新扩展文件
- src/chrome-extension/background.js
- src/chrome-extension/offscreen.js

# 2. 在Chrome扩展管理页面重新加载扩展
chrome://extensions/ -> 点击"重新加载"
```

## ✅ 验证清单

### 服务器启动验证
```bash
# 应该看到以下日志
🌐 Applying ULTIMATE CORS configuration...
✅ CORS configuration applied
🔍 OCR service will be initialized on first use
🚀 Server is running on http://0.0.0.0:3000
```

### 功能测试
1. **文字收集**: 应该正常工作 ✅
2. **截图保存**: 
   - 截图上传到 `/api/upload`
   - 返回图片URL
   - 图片以Markdown格式保存在笔记中
3. **OCR识别**:
   - 截图上传到 `/api/upload`
   - OCR调用 `/api/ocr`
   - 识别结果填入笔记内容
   - 中文识别准确度 > 70%

## ⚠️ 注意事项

1. **不要部署测试脚本** - 所有 `test-*.js` 文件仅用于本地测试
2. **不要部署补丁文件** - 所有 `*-fix.js` 和 `*-patch.js` 功能已内联
3. **不要部署Shell脚本** - 所有 `.sh` 文件仅用于Docker管理
4. **OCR首次使用** - 会自动下载语言包，需要等待1-2分钟

## 🎯 最终效果

部署完成后，Chrome扩展应该能够：
- ✅ 正常收集文字
- ✅ 截图并保存
- ✅ OCR识别中文文字
- ✅ 没有CORS错误
- ✅ 没有404错误
