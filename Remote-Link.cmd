@echo off
echo ========================================================================================================================
echo WARNING: Cloudflare Tunnel!
echo ========================================================================================================================
echo This script downloads and runs the latest cloudflared.exe from Cloudflare to set up an HTTPS tunnel to your exe
echo By continuing you confirm that you're aware of the potential dangers of having a tunnel open and take all responsibility
echo to properly use and secure it!
echo.
echo To abort, press Ctrl+C or close this window now!
echo.
if not exist cloudflared.exe curl -Lo cloudflared.exe https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-windows-amd64.exe
cloudflared.exe tunnel --url localhost:3000
