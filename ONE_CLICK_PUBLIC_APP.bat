@echo off
cd /d "%~dp0"
powershell -ExecutionPolicy Bypass -File "%~dp0ONE_CLICK_PUBLIC_APP.ps1"
pause
