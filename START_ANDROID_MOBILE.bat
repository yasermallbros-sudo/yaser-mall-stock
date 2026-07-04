@echo off
cd /d "%~dp0"
echo Starting Yaser Mall Stock for Android phones...
echo.
echo Keep this window open.
echo Open http://YOUR-COMPUTER-IP:3000/employee on the Android phone.
echo.
npm run dev:mobile
pause
