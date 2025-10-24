# Chrome插件图标说明

## 需要的图标尺寸

Chrome插件需要以下尺寸的图标：

- `icon16.png` - 16x16像素（扩展管理页面）
- `icon32.png` - 32x32像素（Windows等系统）
- `icon48.png` - 48x48像素（扩展管理页面）
- `icon128.png` - 128x128像素（Chrome Web Store）

## 图标设计建议

- **主题色彩**：蓝色系（#3498db）
- **图标元素**：笔记本、笔、或者文档图标
- **风格**：简洁、现代、易识别
- **背景**：透明或白色

## 临时解决方案

如果暂时没有图标文件，可以：

1. **使用在线图标生成器**：
   - https://favicon.io/
   - https://www.canva.com/

2. **使用Emoji作为临时图标**：
   - 📝 (记事本)
   - 📋 (剪贴板)
   - 💾 (保存)

3. **下载免费图标**：
   - https://icons8.com/
   - https://www.flaticon.com/

## 快速创建图标

可以使用以下CSS创建简单的图标：

```html
<div style="
    width: 128px; 
    height: 128px; 
    background: linear-gradient(135deg, #3498db, #2980b9);
    border-radius: 20px;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 60px;
    color: white;
">📝</div>
```

然后截图保存为不同尺寸的PNG文件。
