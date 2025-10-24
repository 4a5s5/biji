# Smart Note Collector - Context Menu Installer (PowerShell)
# This script installs the context menu for Smart Note Collector

Write-Host "Smart Note Collector - Context Menu Installer" -ForegroundColor Cyan
Write-Host "=============================================" -ForegroundColor Cyan
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

# Get the current script directory
$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$regFile = Join-Path $scriptDir "install-context-menu.reg"

# Check if registry file exists
if (-not (Test-Path $regFile)) {
    Write-Host "ERROR: Registry file not found: $regFile" -ForegroundColor Red
    Read-Host "Press Enter to exit"
    exit 1
}

Write-Host "Installing context menu..." -ForegroundColor Yellow

try {
    # Import registry file
    $process = Start-Process -FilePath "regedit" -ArgumentList "/s", "`"$regFile`"" -Wait -PassThru -WindowStyle Hidden
    
    if ($process.ExitCode -eq 0) {
        Write-Host "SUCCESS: Context menu installed successfully!" -ForegroundColor Green
        Write-Host ""
        Write-Host "You can now right-click anywhere and select 'Add to Notes' to quickly collect content." -ForegroundColor White
        Write-Host ""
        Write-Host "Notes:" -ForegroundColor Yellow
        Write-Host "- Make sure Smart Note Collector server is running (http://localhost:3000)" -ForegroundColor White
        Write-Host "- Select text content before using the context menu" -ForegroundColor White
        Write-Host ""
    } else {
        Write-Host "FAILED: Context menu installation failed!" -ForegroundColor Red
        Write-Host "Exit code: $($process.ExitCode)" -ForegroundColor Red
    }
} catch {
    Write-Host "ERROR: Failed to install context menu" -ForegroundColor Red
    Write-Host "Error: $($_.Exception.Message)" -ForegroundColor Red
}

Write-Host ""
Read-Host "Press Enter to exit"
