$ErrorActionPreference = "Stop"
Set-Location $PSScriptRoot
Write-Host "Preparing Yaser Mall Stock ready app..." -ForegroundColor Green
if (-not (Test-Path .env)) { Copy-Item .env.example .env }
if (-not (Test-Path node_modules)) { npm install }
npx prisma migrate dev --name add-product-categories
npm run db:seed
Write-Host "Ready." -ForegroundColor Green
Write-Host "Employee app: http://localhost:3000/employee"
Write-Host "Admin plan:   http://localhost:3000/admin/items"
Write-Host "Employee login: employee@yasermall.local / YaserMall@2026"
Write-Host "Admin login:    admin@yasermall.local / YaserMall@2026"
npm run dev
