$ErrorActionPreference = "Stop"
Set-Location $PSScriptRoot
Write-Host "Yaser Mall Stock - Ready App" -ForegroundColor Green
if (-not (Get-Command node -ErrorAction SilentlyContinue)) { throw "Node.js is not installed. Install Node.js LTS from https://nodejs.org" }
if (-not (Get-Command npm -ErrorAction SilentlyContinue)) { throw "npm is not installed or not in PATH." }
if (-not (Test-Path .env)) { Copy-Item .env.example .env }
if (-not (Test-Path node_modules)) { npm install }
if (Get-Command docker -ErrorAction SilentlyContinue) { docker compose up -d } else { Write-Host "Docker not found. Make sure PostgreSQL is running." -ForegroundColor Yellow }
npx prisma migrate dev --name add-product-categories
npm run db:seed
Write-Host "Ready." -ForegroundColor Green
Write-Host "Employee app: http://localhost:3000/employee"
Write-Host "Admin plan:   http://localhost:3000/admin/items"
Write-Host "Employee login: employee@yasermall.local / YaserMall@2026"
Write-Host "Admin login:    admin@yasermall.local / YaserMall@2026"
npm run dev
