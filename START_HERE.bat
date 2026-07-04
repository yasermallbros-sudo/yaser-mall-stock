@echo off
setlocal
cd /d "%~dp0"
echo.
echo ========================================
echo  Yaser Mall Stock - Ready App
echo ========================================
echo.
where node >nul 2>nul
if errorlevel 1 (
  echo Node.js is not installed or not in PATH.
  echo Install Node.js LTS from https://nodejs.org then run this file again.
  pause
  exit /b 1
)
where npm >nul 2>nul
if errorlevel 1 (
  echo npm is not installed or not in PATH.
  pause
  exit /b 1
)
if not exist .env copy .env.example .env
if not exist node_modules (
  echo Installing packages...
  call npm install
  if errorlevel 1 goto failed
)
where docker >nul 2>nul
if not errorlevel 1 (
  echo Starting PostgreSQL with Docker...
  docker compose up -d
) else (
  echo Docker was not found. Make sure PostgreSQL is running with the .env DATABASE_URL.
)
echo Applying database migration...
call npx prisma migrate dev --name add-product-categories
if errorlevel 1 goto failed
echo Seeding users and ready products...
call npm run db:seed
if errorlevel 1 goto failed
echo.
echo Ready.
echo Employee app: http://localhost:3000/employee
echo Admin plan:   http://localhost:3000/admin/items
echo.
echo Employee login: employee@yasermall.local / YaserMall@2026
echo Admin login:    admin@yasermall.local / YaserMall@2026
echo.
call npm run dev
exit /b 0
:failed
echo.
echo Setup failed. Copy the error above and send it to Codex.
pause
exit /b 1
