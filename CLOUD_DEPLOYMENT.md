# 🌩️ 云服务器部署指导

## 修复内容概述

针对Chrome扩展截图功能、OCR识别和图片显示问题，我们进行了以下修复：

### 🔧 主要修复文件

1. **cloud-server-fixes.js** - 云服务器专用修复模块
2. **full-server.js** - 集成了云服务器修复的主服务器文件
3. **src/chrome-extension/config.js** - 修复了默认服务器地址
4. **src/chrome-extension/content.js** - 修复了主题加载服务器地址
5. **src/core/OCRService.js** - 增强了路径处理和错误处理

### 📋 部署步骤

#### 1. 上传修复文件到云服务器

将以下文件上传到你的 `123.254.104.172:10467` 服务器：

```bash
# 主要文件
cloud-server-fixes.js
full-server.js (已修改)
src/core/OCRService.js (已修改)
src/chrome-extension/config.js (已修改)
src/chrome-extension/content.js (已修改)
```

#### 2. 重启服务器

在云服务器上执行：

```bash
# 停止当前服务器进程
pm2 stop all  # 如果使用PM2
# 或者找到Node进程并杀死

# 重新启动服务器
node full-server.js
# 或者使用PM2
pm2 start full-server.js --name "smart-notes"
```

#### 3. 验证部署

1. **测试服务器连接**：
   - 访问: http://123.254.104.172:10467/api/health
   - 应该返回JSON响应

2. **测试图片目录**：
   - 访问: http://123.254.104.172:10467/api/debug/images
   - 查看图片目录状态

3. **使用测试页面**：
   - 将 `test-chrome-extension.html` 上传到服务器
   - 访问进行功能测试

### 🎯 解决的问题

#### 1. 图片无法显示问题
- **原因**: 静态文件服务路径配置不正确
- **解决**: 
  - 增加多个静态路径映射
  - 确保图片同时保存到 `uploads` 和 `data/images` 目录
  - 支持 `/uploads/`, `/data/images/`, `/images/` 等多种访问路径

#### 2. OCR识别失败问题
- **原因**: OCR服务无法找到上传的图片文件
- **解决**:
  - 改进路径解析逻辑，支持多种路径格式
  - 增加文件查找的fallback机制
  - 添加详细的调试日志
  - 改进OCR服务初始化逻辑

#### 3. CORS跨域问题
- **原因**: Chrome扩展从网页发起请求时遇到CORS限制
- **解决**: 
  - 配置更宽松的CORS策略
  - 支持所有来源的请求（适合开发环境）

### 🧪 测试方法

#### 1. 基本连接测试
```bash
curl -I http://123.254.104.172:10467/api/health
```

#### 2. 图片目录测试
```bash
curl http://123.254.104.172:10467/api/debug/images
```

#### 3. Chrome扩展功能测试
1. 打开测试页面: `test-chrome-extension.html`
2. 测试服务器连接
3. 进行截图功能测试
4. 测试OCR识别功能
5. 测试文字选择功能

### 📝 预期结果

修复后的功能应该：

1. ✅ **截图能正常保存到笔记**
2. ✅ **保存的图片能在笔记中正确显示**
3. ✅ **OCR识别不再返回502错误**
4. ✅ **Chrome扩展能正常连接服务器**
5. ✅ **主题选择对话框能正常加载**

### 🛠️ 故障排查

如果问题仍然存在：

1. **检查服务器日志**: 查看 `full-server.js` 的控制台输出
2. **检查图片目录**: 访问 `/api/debug/images` 确认目录状态
3. **检查文件权限**: 确保 `uploads` 和 `data/images` 目录有写权限
4. **检查OCR依赖**: 确认 `tesseract.js` 库能正常工作

### 📞 技术支持

如果部署过程中遇到问题：

1. 检查服务器控制台日志
2. 使用浏览器开发者工具查看网络请求
3. 确认所有修复文件都已正确上传
4. 验证服务器端口10467是否正常监听

---

**部署完成后，请测试所有功能确保正常工作！** 🚀
