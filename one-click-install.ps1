# Smart Note Collector - One-Click Context Menu Installer
# Copy and paste this entire script into an Administrator PowerShell window

Write-Host "Smart Note Collector - One-Click Context Menu Installer" -ForegroundColor Cyan
Write-Host "=======================================================" -ForegroundColor Cyan
Write-Host ""

# Check if running as administrator
$isAdmin = ([Security.Principal.WindowsPrincipal] [Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole] "Administrator")

if (-not $isAdmin) {
    Write-Host "ERROR: This script must be run as Administrator" -ForegroundColor Red
    Write-Host "Please open PowerShell as Administrator and run this script again" -ForegroundColor Yellow
    return
}

# Set project path
$projectPath = "C:\Users\ghc\Desktop\新建文件夹 (5)\笔记"
$handlerPath = "$projectPath\src\system\context-menu\context-handler.bat"

Write-Host "Project path: $projectPath" -ForegroundColor Yellow
Write-Host "Handler path: $handlerPath" -ForegroundColor Yellow
Write-Host ""

# Check if handler file exists
if (-not (Test-Path $handlerPath)) {
    Write-Host "ERROR: Handler file not found: $handlerPath" -ForegroundColor Red
    Write-Host "Please make sure the project files are in the correct location" -ForegroundColor Yellow
    return
}

Write-Host "Installing context menu entries..." -ForegroundColor Yellow
Write-Host ""

try {
    # Create file right-click menu
    Write-Host "Creating file context menu..." -ForegroundColor Gray
    New-Item -Path "HKCR:\*\shell\SmartNoteCollector" -Force | Out-Null
    Set-ItemProperty -Path "HKCR:\*\shell\SmartNoteCollector" -Name "(Default)" -Value "Add to Notes"
    New-Item -Path "HKCR:\*\shell\SmartNoteCollector\command" -Force | Out-Null
    Set-ItemProperty -Path "HKCR:\*\shell\SmartNoteCollector\command" -Name "(Default)" -Value "`"$handlerPath`" `"%1`""
    
    # Create folder right-click menu
    Write-Host "Creating folder context menu..." -ForegroundColor Gray
    New-Item -Path "HKCR:\Directory\shell\SmartNoteCollector" -Force | Out-Null
    Set-ItemProperty -Path "HKCR:\Directory\shell\SmartNoteCollector" -Name "(Default)" -Value "Add to Notes"
    New-Item -Path "HKCR:\Directory\shell\SmartNoteCollector\command" -Force | Out-Null
    Set-ItemProperty -Path "HKCR:\Directory\shell\SmartNoteCollector\command" -Name "(Default)" -Value "`"$handlerPath`" `"%1`""
    
    # Create desktop background right-click menu
    Write-Host "Creating desktop background context menu..." -ForegroundColor Gray
    New-Item -Path "HKCR:\DesktopBackground\Shell\SmartNoteCollector" -Force | Out-Null
    Set-ItemProperty -Path "HKCR:\DesktopBackground\Shell\SmartNoteCollector" -Name "(Default)" -Value "Add to Notes"
    New-Item -Path "HKCR:\DesktopBackground\Shell\SmartNoteCollector\command" -Force | Out-Null
    Set-ItemProperty -Path "HKCR:\DesktopBackground\Shell\SmartNoteCollector\command" -Name "(Default)" -Value "`"$handlerPath`" `"%V`""
    
    Write-Host ""
    Write-Host "SUCCESS: Context menu installed successfully!" -ForegroundColor Green
    Write-Host ""
    
    # Verify installation
    Write-Host "Verifying installation..." -ForegroundColor Yellow
    $fileMenu = Get-ItemProperty -Path "HKCR:\*\shell\SmartNoteCollector" -Name "(Default)" -ErrorAction SilentlyContinue
    $desktopMenu = Get-ItemProperty -Path "HKCR:\DesktopBackground\Shell\SmartNoteCollector" -Name "(Default)" -ErrorAction SilentlyContinue
    
    if ($fileMenu -and $desktopMenu) {
        Write-Host "✓ Registry entries created successfully" -ForegroundColor Green
    } else {
        Write-Host "⚠ Warning: Some registry entries may not have been created" -ForegroundColor Yellow
    }
    
    Write-Host ""
    Write-Host "NEXT STEPS:" -ForegroundColor Cyan
    Write-Host "1. Restart Windows Explorer:" -ForegroundColor White
    Write-Host "   - Press Ctrl+Shift+Esc to open Task Manager" -ForegroundColor Gray
    Write-Host "   - Find 'Windows Explorer' and click 'Restart'" -ForegroundColor Gray
    Write-Host ""
    Write-Host "2. Start the Smart Note Collector server:" -ForegroundColor White
    Write-Host "   - Open Command Prompt in project folder" -ForegroundColor Gray
    Write-Host "   - Run: node simple-server.js" -ForegroundColor Gray
    Write-Host ""
    Write-Host "3. Test the context menu:" -ForegroundColor White
    Write-Host "   - Right-click on desktop or any file" -ForegroundColor Gray
    Write-Host "   - Look for 'Add to Notes' option" -ForegroundColor Gray
    Write-Host ""
    
} catch {
    Write-Host "ERROR: Failed to install context menu" -ForegroundColor Red
    Write-Host "Error details: $($_.Exception.Message)" -ForegroundColor Red
    Write-Host ""
    Write-Host "Try running this script again, or check the manual installation guide" -ForegroundColor Yellow
}

Write-Host "Installation script completed." -ForegroundColor Cyan
