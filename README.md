# Smart Note Collector - 智能笔记收集器

一个轻量级的笔记收集软件，支持从各种应用程序（Word、PDF、浏览器、微信等）快速收集文字和图片内容，并按主题进行分类管理。

## 🌟 主要特性

- **全局右键集成** - 在任何应用程序中选中内容后右键快速导入
- **主题分类管理** - 自定义主题，灵活分类笔记内容
- **美观的界面** - 现代化设计，符合阅读软件风格
- **响应式设计** - 支持移动端访问，自适应各种屏幕尺寸
- **简单存储** - 使用JSON文件存储，无需数据库
- **搜索功能** - 支持全文搜索，快速找到需要的内容
- **图片支持** - 支持图片收集和预览
- **导出功能** - 支持导出为Markdown、JSON格式

## 🚀 快速开始

### 环境要求

- Node.js 14.0 或更高版本
- npm 或 yarn 包管理器

### 安装步骤

1. **克隆项目**
   ```bash
   git clone <repository-url>
   cd smart-note-collector
   ```

2. **安装依赖**
   ```bash
   npm install
   ```

3. **启动应用**
   ```bash
   # 开发模式
   npm run dev
   
   # 生产模式
   npm start
   ```

4. **访问应用**
   
   打开浏览器访问 `http://localhost:3000`

## 📁 项目结构

```
smart-note-collector/
├── src/
│   ├── backend/           # 后端服务
│   │   ├── server.js      # 主服务器
│   │   ├── routes/        # API路由
│   │   │   ├── notes.js   # 笔记相关API
│   │   │   └── themes.js  # 主题相关API
│   │   └── utils/         # 工具函数
│   │       └── dataManager.js # 数据管理
│   ├── frontend/          # 前端界面
│   │   ├── index.html     # 主页面
│   │   ├── css/           # 样式文件
│   │   │   ├── styles.css # 主样式
│   │   │   └── responsive.css # 响应式样式
│   │   └── js/            # JavaScript文件
│   │       ├── api.js     # API管理
│   │       ├── ui.js      # UI工具
│   │       ├── themes.js  # 主题管理
│   │       ├── notes.js   # 笔记管理
│   │       └── app.js     # 主应用
│   └── system/            # 系统集成（待实现）
│       ├── context-menu/  # 右键菜单
│       └── clipboard/     # 剪贴板处理
├── data/
│   ├── notes.json         # 笔记数据
│   ├── themes.json        # 主题配置
│   └── images/            # 图片存储
├── config/
│   └── app.json           # 应用配置
└── package.json
```

## 🎯 功能说明

### 主题管理

- **创建主题**：自定义主题名称、颜色和图标
- **编辑主题**：修改主题属性
- **删除主题**：删除主题时自动将笔记移动到默认主题
- **主题统计**：显示每个主题下的笔记数量

### 笔记管理

- **创建笔记**：支持文字和图片内容
- **编辑笔记**：修改笔记标题、内容、主题和标签
- **删除笔记**：安全删除笔记和关联文件
- **搜索笔记**：支持标题、内容和标签的全文搜索
- **分页显示**：大量笔记时自动分页
- **视图切换**：支持列表和网格视图

### 数据管理

- **JSON存储**：所有数据以JSON格式存储在本地文件中
- **图片管理**：图片文件单独存储，支持多种格式
- **数据备份**：支持导出完整数据备份
- **自动保存**：所有操作自动保存，无需手动保存

## 🔧 API接口

### 笔记接口

- `GET /api/notes` - 获取笔记列表
- `GET /api/notes/:id` - 获取单个笔记
- `POST /api/notes` - 创建笔记
- `PUT /api/notes/:id` - 更新笔记
- `DELETE /api/notes/:id` - 删除笔记

### 主题接口

- `GET /api/themes` - 获取主题列表
- `GET /api/themes/:id` - 获取单个主题
- `POST /api/themes` - 创建主题
- `PUT /api/themes/:id` - 更新主题
- `DELETE /api/themes/:id` - 删除主题
- `GET /api/themes/:id/stats` - 获取主题统计

## ⌨️ 键盘快捷键

- `Ctrl/Cmd + N` - 新建笔记
- `Ctrl/Cmd + Shift + N` - 新建主题
- `Ctrl/Cmd + F` - 聚焦搜索框
- `Ctrl/Cmd + R` - 刷新数据
- `Escape` - 关闭模态框

## 📱 移动端支持

应用采用响应式设计，在移动设备上会自动调整布局：

- **平板设备**：侧边栏缩小，内容区域优化
- **手机设备**：侧边栏变为水平滚动，模态框全屏显示
- **触摸优化**：按钮和交互元素针对触摸操作优化

## 🔮 未来计划

### 第二阶段：系统集成
- [ ] Windows右键菜单注册
- [ ] 剪贴板内容自动捕获
- [ ] 应用程序窗口检测
- [ ] 快捷键全局监听

### 第三阶段：功能增强
- [ ] 云同步支持
- [ ] 多设备协同
- [ ] 插件系统
- [ ] AI内容分析
- [ ] 批量导入功能
- [ ] 笔记分享功能

### 第四阶段：桌面应用
- [ ] Electron打包
- [ ] 系统托盘集成
- [ ] 开机自启动
- [ ] 自动更新机制

## 🛠️ 开发指南

### 本地开发

1. **启动开发服务器**
   ```bash
   npm run dev
   ```

2. **代码结构**
   - 后端代码位于 `src/backend/`
   - 前端代码位于 `src/frontend/`
   - 配置文件位于 `config/`

3. **数据文件**
   - 笔记数据：`data/notes.json`
   - 主题数据：`data/themes.json`
   - 图片文件：`data/images/`

### 添加新功能

1. **后端API**：在 `src/backend/routes/` 中添加新的路由文件
2. **前端功能**：在 `src/frontend/js/` 中添加新的模块文件
3. **样式**：在 `src/frontend/css/` 中添加相应样式

### 测试

目前项目处于开发阶段，测试功能待完善。

## 📄 许可证

MIT License

## 🤝 贡献

欢迎提交Issue和Pull Request来帮助改进这个项目。

## 📞 支持

如果您在使用过程中遇到问题，请：

1. 查看本README文档
2. 检查浏览器控制台是否有错误信息
3. 提交Issue描述问题详情

---

**Smart Note Collector** - 让笔记收集变得简单高效！
