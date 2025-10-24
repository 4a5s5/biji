# 手动安装右键菜单 - 完整指南

## 🚨 问题分析

右键菜单没有出现的可能原因：

1. **路径中的中文字符**导致注册表问题
2. **管理员权限**不足
3. **Windows Explorer**需要重启
4. **注册表项**没有正确创建

## 🔧 手动安装步骤

### 第一步：以管理员身份打开PowerShell

1. 按 `Win + X`
2. 选择 "Windows PowerShell (管理员)" 或 "Windows Terminal (管理员)"
3. 如果提示UAC，点击"是"

### 第二步：导航到项目目录

```powershell
cd "C:\Users\ghc\Desktop\新建文件夹 (5)\笔记"
```

### 第三步：手动创建注册表项

复制并粘贴以下PowerShell命令（一次一行）：

```powershell
# 设置项目路径
$projectPath = "C:\Users\ghc\Desktop\新建文件夹 (5)\笔记"
$handlerPath = "$projectPath\src\system\context-menu\context-handler.bat"

# 创建文件右键菜单
New-Item -Path "HKCR:\*\shell\SmartNoteCollector" -Force
Set-ItemProperty -Path "HKCR:\*\shell\SmartNoteCollector" -Name "(Default)" -Value "Add to Notes"
New-Item -Path "HKCR:\*\shell\SmartNoteCollector\command" -Force
Set-ItemProperty -Path "HKCR:\*\shell\SmartNoteCollector\command" -Name "(Default)" -Value "`"$handlerPath`" `"%1`""

# 创建文件夹右键菜单
New-Item -Path "HKCR:\Directory\shell\SmartNoteCollector" -Force
Set-ItemProperty -Path "HKCR:\Directory\shell\SmartNoteCollector" -Name "(Default)" -Value "Add to Notes"
New-Item -Path "HKCR:\Directory\shell\SmartNoteCollector\command" -Force
Set-ItemProperty -Path "HKCR:\Directory\shell\SmartNoteCollector\command" -Name "(Default)" -Value "`"$handlerPath`" `"%1`""

# 创建桌面背景右键菜单
New-Item -Path "HKCR:\DesktopBackground\Shell\SmartNoteCollector" -Force
Set-ItemProperty -Path "HKCR:\DesktopBackground\Shell\SmartNoteCollector" -Name "(Default)" -Value "Add to Notes"
New-Item -Path "HKCR:\DesktopBackground\Shell\SmartNoteCollector\command" -Force
Set-ItemProperty -Path "HKCR:\DesktopBackground\Shell\SmartNoteCollector\command" -Name "(Default)" -Value "`"$handlerPath`" `"%V`""

Write-Host "Context menu installed successfully!" -ForegroundColor Green
```

### 第四步：重启Windows Explorer

1. 按 `Ctrl + Shift + Esc` 打开任务管理器
2. 找到 "Windows 资源管理器" 进程
3. 右键点击，选择 "重新启动"

### 第五步：验证安装

1. 在桌面空白处右键点击
2. 应该看到 "Add to Notes" 选项
3. 如果没有看到，继续下面的故障排除步骤

## 🔍 故障排除

### 检查注册表项是否创建成功

在PowerShell中运行：

```powershell
# 检查文件右键菜单
Get-ItemProperty -Path "HKCR:\*\shell\SmartNoteCollector" -Name "(Default)" -ErrorAction SilentlyContinue

# 检查桌面右键菜单
Get-ItemProperty -Path "HKCR:\DesktopBackground\Shell\SmartNoteCollector" -Name "(Default)" -ErrorAction SilentlyContinue
```

如果返回结果显示 `(Default) : Add to Notes`，说明注册表项创建成功。

### 检查处理程序文件是否存在

```powershell
Test-Path "C:\Users\ghc\Desktop\新建文件夹 (5)\笔记\src\system\context-menu\context-handler.bat"
```

应该返回 `True`。

### 手动测试处理程序

```powershell
cd "C:\Users\ghc\Desktop\新建文件夹 (5)\笔记"
node src\system\context-menu\context-handler.js "test-file.txt"
```

应该打开浏览器显示快速导入页面。

## 🔄 替代方案：使用不同的注册表位置

如果上述方法不工作，尝试使用用户级注册表：

```powershell
# 用户级文件右键菜单
New-Item -Path "HKCU:\Software\Classes\*\shell\SmartNoteCollector" -Force
Set-ItemProperty -Path "HKCU:\Software\Classes\*\shell\SmartNoteCollector" -Name "(Default)" -Value "Add to Notes"
New-Item -Path "HKCU:\Software\Classes\*\shell\SmartNoteCollector\command" -Force
Set-ItemProperty -Path "HKCU:\Software\Classes\*\shell\SmartNoteCollector\command" -Name "(Default)" -Value "`"$handlerPath`" `"%1`""
```

## 🗑️ 完全卸载（如果需要）

```powershell
# 删除所有注册表项
Remove-Item -Path "HKCR:\*\shell\SmartNoteCollector" -Recurse -Force -ErrorAction SilentlyContinue
Remove-Item -Path "HKCR:\Directory\shell\SmartNoteCollector" -Recurse -Force -ErrorAction SilentlyContinue
Remove-Item -Path "HKCR:\DesktopBackground\Shell\SmartNoteCollector" -Recurse -Force -ErrorAction SilentlyContinue
Remove-Item -Path "HKCU:\Software\Classes\*\shell\SmartNoteCollector" -Recurse -Force -ErrorAction SilentlyContinue

Write-Host "Context menu uninstalled successfully!" -ForegroundColor Green
```

## 📋 完整测试流程

1. **确保服务器运行**：
   ```cmd
   node simple-server.js
   ```

2. **测试右键菜单**：
   - 在桌面右键 → 应该看到 "Add to Notes"
   - 在文件上右键 → 应该看到 "Add to Notes"

3. **测试功能**：
   - 打开记事本，输入文字并选中
   - 右键选择 "Add to Notes"
   - 应该打开快速导入对话框

## 🎯 成功标志

安装成功后您应该看到：
- ✅ PowerShell命令执行无错误
- ✅ 右键菜单出现 "Add to Notes" 选项
- ✅ 点击能打开快速导入对话框
- ✅ 能够成功保存笔记

如果按照这个手动安装指南操作，右键菜单应该能够正常工作！
