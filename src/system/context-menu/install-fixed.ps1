# Smart Note Collector - Fixed Context Menu Installer
# This script manually creates registry entries to avoid encoding issues

Write-Host "Smart Note Collector - Fixed Context Menu Installer" -ForegroundColor Cyan
Write-Host "====================================================" -ForegroundColor Cyan
Write-Host ""

# Check if running as administrator
$isAdmin = ([Security.Principal.WindowsPrincipal] [Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole] "Administrator")

if (-not $isAdmin) {
    Write-Host "ERROR: Administrator privileges required" -ForegroundColor Red
    Write-Host "Please right-click this file and select 'Run with PowerShell as Administrator'" -ForegroundColor Yellow
    Write-Host ""
    Read-Host "Press Enter to exit"
    exit 1
}

# Get the current script directory and project path
$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$projectPath = Split-Path -Parent (Split-Path -Parent (Split-Path -Parent $scriptDir))
$handlerPath = Join-Path $scriptDir "context-handler.bat"

Write-Host "Project path: $projectPath" -ForegroundColor Yellow
Write-Host "Handler path: $handlerPath" -ForegroundColor Yellow
Write-Host ""

# Check if handler file exists
if (-not (Test-Path $handlerPath)) {
    Write-Host "ERROR: Handler file not found: $handlerPath" -ForegroundColor Red
    Read-Host "Press Enter to exit"
    exit 1
}

Write-Host "Installing context menu entries..." -ForegroundColor Yellow

try {
    # Create registry entries manually
    $registryPaths = @(
        "HKCR:\*\shell\SmartNoteCollector",
        "HKCR:\Directory\shell\SmartNoteCollector", 
        "HKCR:\Directory\Background\shell\SmartNoteCollector",
        "HKCR:\DesktopBackground\Shell\SmartNoteCollector"
    )
    
    $commands = @(
        "`"$handlerPath`" `"%1`"",
        "`"$handlerPath`" `"%1`"",
        "`"$handlerPath`" `"%V`"",
        "`"$handlerPath`" `"%V`""
    )
    
    for ($i = 0; $i -lt $registryPaths.Length; $i++) {
        $regPath = $registryPaths[$i]
        $command = $commands[$i]
        
        Write-Host "Creating: $regPath" -ForegroundColor Gray
        
        # Create main key
        if (-not (Test-Path $regPath)) {
            New-Item -Path $regPath -Force | Out-Null
        }
        Set-ItemProperty -Path $regPath -Name "(Default)" -Value "Add to Notes"
        
        # Create command subkey
        $commandPath = "$regPath\command"
        if (-not (Test-Path $commandPath)) {
            New-Item -Path $commandPath -Force | Out-Null
        }
        Set-ItemProperty -Path $commandPath -Name "(Default)" -Value $command
    }
    
    Write-Host ""
    Write-Host "SUCCESS: Context menu installed successfully!" -ForegroundColor Green
    Write-Host ""
    Write-Host "Next steps:" -ForegroundColor Yellow
    Write-Host "1. Restart Windows Explorer (Ctrl+Shift+Esc -> Restart Windows Explorer)" -ForegroundColor White
    Write-Host "2. Make sure the server is running: node simple-server.js" -ForegroundColor White
    Write-Host "3. Right-click anywhere and look for 'Add to Notes'" -ForegroundColor White
    Write-Host ""
    
} catch {
    Write-Host "ERROR: Failed to install context menu" -ForegroundColor Red
    Write-Host "Error: $($_.Exception.Message)" -ForegroundColor Red
}

Write-Host ""
Read-Host "Press Enter to exit"
