@echo off
setlocal
cd /d "%~dp0"
echo Preparing Yaser Mall Stock ready app...
if not exist .env copy .env.example .env
if not exist node_modules (
  echo Installing packages...
  call npm install
  if errorlevel 1 goto failed
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
echo Setup failed. Send the error above to Codex.
pause
exit /b 1
