# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 项目概述

Smart Note Collector 是一个智能笔记收集系统，支持通过多种方式（Chrome扩展、Web端、移动端）快速收集和管理笔记内容。系统采用Node.js后端 + 原生JavaScript前端架构，支持SQLite数据库存储（带JSON文件备份方案）。

## 常用开发命令

### 启动和运行
```bash
# 安装依赖
npm install

# 启动完整服务器（包含所有功能）
npm start
# 或
node full-server.js

# 开发模式（同上）
npm run dev
```

### Docker 部署
```bash
# 构建镜像
docker build -t smart-note-collector .

# 使用docker-compose启动
docker-compose up -d

# 更新Docker容器
./update-docker.sh  # Linux/Mac
update-docker.bat   # Windows
```

### Chrome扩展打包
```bash
# 扩展文件位于 src/chrome-extension/
# 直接在Chrome扩展管理页面加载未打包的扩展
# 或使用已有的 chrome-extension.zip
```

## 核心架构

### 后端架构（Node.js + Express）

#### 主服务器入口
- `full-server.js` - 完整功能服务器，包含所有模块集成
  - 端口: 3000（可通过环境变量配置）
  - 支持CORS，允许Chrome扩展和所有来源访问
  - 集成了笔记、主题、导入导出、AI预设等所有功能

#### 核心管理器（src/core/）
- `NotesManager.js` - 笔记管理核心，协调数据库和JSON存储
- `ThemesManager.js` - 主题管理，处理笔记分类
- `DatabaseManager.js` - SQLite数据库管理，包含AI预设功能
- `JSONNotesManager.js` - JSON文件存储备份方案

#### API模块（src/api/）
- `quick-import.js` - 快速导入API，支持Chrome扩展右键菜单
- `import.js` - 文件导入功能（TXT、MD、JSON）
- `export.js` - 导出功能，支持多种格式和批量导出

### 前端架构（原生JavaScript）

#### 页面结构（src/frontend/）
- `index.html` - 主界面，笔记管理和查看
- `import.html` - 导入界面，支持文件和URL导入
- `mobile-test.html` - 移动端测试页面

#### JavaScript模块（src/frontend/js/）
- `app.js` - 主应用逻辑，协调各模块
- `api.js` - API调用封装
- `notes.js` - 笔记UI管理
- `themes.js` - 主题UI管理
- `ui.js` - UI工具函数
- `import.js` - 导入功能前端逻辑

### Chrome扩展（src/chrome-extension/）
- `manifest.json` - 扩展配置（Manifest V3）
- `background.js` - 后台服务，处理右键菜单和通信
- `content.js` - 内容脚本，注入网页处理选中内容
- `popup.js/html` - 扩展弹窗界面
- `config.js` - 配置管理，支持动态服务器地址

## 数据存储策略

### 双重存储模式
1. **主存储**: SQLite数据库（`notes.db`）
   - 笔记、主题、AI预设等核心数据
   - 位于项目根目录

2. **备份存储**: JSON文件
   - `data/notes.json` - 笔记数据
   - `data/themes.json` - 主题数据
   - 数据库不可用时自动切换

3. **文件存储**:
   - `uploads/` - 上传的图片和文件
   - `exports/` - 导出文件临时存储

## API端点概览

### 笔记管理
- `GET /api/notes` - 获取笔记列表（支持分页、搜索、主题筛选）
- `POST /api/notes` - 创建笔记
- `PUT /api/notes/:id` - 更新笔记
- `DELETE /api/notes/:id` - 删除笔记

### 主题管理
- `GET /api/themes` - 获取主题列表
- `POST /api/themes` - 创建主题
- `PUT /api/themes/:id` - 更新主题
- `DELETE /api/themes/:id` - 删除主题

### 导入导出
- `POST /api/quick-import` - Chrome扩展快速导入
- `POST /api/import/:format` - 文件导入（txt/md/json）
- `POST /api/import/url` - URL内容导入
- `GET /api/export/:format` - 导出所有笔记
- `POST /api/export/custom/:format` - 批量导出选中笔记

### AI预设
- `GET /api/ai-presets` - 获取所有预设
- `POST /api/ai-presets` - 创建预设
- `PUT /api/ai-presets/:id/default` - 设置默认预设

## 关键工作流程

### Chrome扩展右键导入流程
1. 用户在网页选中内容并右键
2. `content.js` 捕获选中内容和页面信息
3. `background.js` 接收并调用快速导入API
4. 服务器处理并返回结果
5. 扩展显示通知反馈

### 数据库初始化流程
1. `DatabaseManager` 检查数据库文件
2. 如不存在，创建新数据库和表结构
3. 初始化默认主题和预设
4. 如数据库失败，自动切换到JSON模式

### CORS和跨域处理
- 服务器配置允许所有来源（开发环境）
- 特别支持Chrome扩展的`chrome-extension://`协议
- 支持预检请求（OPTIONS）

## 调试和测试

### Chrome扩展调试
1. 打开Chrome扩展管理页面
2. 开启开发者模式
3. 加载未打包的扩展（选择`src/chrome-extension/`目录）
4. 使用扩展的背景页面查看日志

### 数据库测试
```bash
# 测试数据库初始化
node test-db-init.js

# 清除本地预设（如需要）
node clear-local-presets.js
```

### API测试
```bash
# 健康检查
curl http://localhost:3000/api/health

# 获取笔记
curl http://localhost:3000/api/notes
```

## 注意事项

1. **数据库兼容性**: 系统会自动处理SQLite不可用的情况，切换到JSON存储
2. **Chrome扩展权限**: 需要在manifest.json中配置正确的host_permissions
3. **CORS配置**: 生产环境需要限制允许的来源
4. **文件大小限制**: Express配置了50MB的请求体限制
5. **移动端适配**: 使用响应式CSS，自动适配不同屏幕尺寸

## 项目特色

- **多端支持**: Web端、移动端、Chrome扩展统一后端
- **灵活存储**: SQLite + JSON双重存储策略
- **快速导入**: 右键菜单一键收集网页内容
- **丰富格式**: 支持Markdown、JSON、纯文本等多种导入导出格式
- **主题分类**: 灵活的主题管理系统
- **AI预设**: 支持自定义AI处理预设（预留接口）