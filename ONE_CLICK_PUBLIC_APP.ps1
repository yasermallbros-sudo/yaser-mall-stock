Set-Location $PSScriptRoot
$ErrorActionPreference = "Continue"
$Host.UI.RawUI.WindowTitle = "Yaser Mall Stock - Public Mobile Link"

function Has-Command($name) {
  return [bool](Get-Command $name -ErrorAction SilentlyContinue)
}

function Show-Links($publicUrl) {
  $employee = "$publicUrl/employee"
  $admin = "$publicUrl/admin/items"
  $dashboard = "$publicUrl/dashboard"
  Write-Host ""
  Write-Host "PUBLIC LINKS READY" -ForegroundColor Green
  Write-Host "Employee:  $employee" -ForegroundColor Cyan
  Write-Host "Admin:     $admin" -ForegroundColor Cyan
  Write-Host "Dashboard: $dashboard" -ForegroundColor Cyan
  Write-Host ""
  Write-Host "Employee login: employee@yasermall.local / Employee123!"
  Write-Host "Admin login:    admin@yasermall.local / Admin123!"
  Write-Host ""
  try {
    $clip = "Employee: $employee" + [Environment]::NewLine + "Admin: $admin" + [Environment]::NewLine + "Dashboard: $dashboard" + [Environment]::NewLine + "Employee login: employee@yasermall.local / Employee123!" + [Environment]::NewLine + "Admin login: admin@yasermall.local / Admin123!"
    Set-Clipboard $clip
    Write-Host "I copied the links to the clipboard." -ForegroundColor Green
  } catch {}
  Write-Host "Keep this window open while employees use the app." -ForegroundColor Yellow
}

Clear-Host
Write-Host "Yaser Mall Stock" -ForegroundColor Green
Write-Host "One-click public mobile link" -ForegroundColor Green
Write-Host ""
Write-Host "IMPORTANT: Do not open 0.0.0.0 on mobile. Use the HTTPS link this window creates." -ForegroundColor Yellow
Write-Host ""

$toolsDir = Join-Path $PSScriptRoot ".tools"
$localCloudflared = Join-Path $toolsDir "cloudflared.exe"
$cloudflaredExe = $null

if (Has-Command "cloudflared") {
  $cloudflaredExe = "cloudflared"
} elseif (Test-Path $localCloudflared) {
  $cloudflaredExe = $localCloudflared
} else {
  Write-Host "Downloading public-link tool. One time only..." -ForegroundColor Cyan
  New-Item -ItemType Directory -Force -Path $toolsDir | Out-Null
  try {
    [Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
    Invoke-WebRequest -Uri "https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-windows-amd64.exe" -OutFile $localCloudflared
  } catch {
    Write-Host "Could not download Cloudflare Tunnel automatically." -ForegroundColor Red
    Write-Host "Please open this page and download cloudflared for Windows:" -ForegroundColor Yellow
    Write-Host "https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/downloads/"
    Start-Process "https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/downloads/"
    Read-Host "Press Enter after installing, then run this file again"
    exit
  }
  $cloudflaredExe = $localCloudflared
}

Write-Host "Starting the Yaser app..." -ForegroundColor Cyan
$appCommand = "Set-Location -LiteralPath '" + $PSScriptRoot + "'; if (Test-Path .next\BUILD_ID) { npm run serve:mobile } else { npm run dev:mobile }"
Start-Process powershell -ArgumentList "-NoExit", "-Command", $appCommand
Start-Sleep -Seconds 8

Write-Host "Creating public HTTPS link..." -ForegroundColor Cyan
Write-Host "Please wait. This can take 10-20 seconds."
Write-Host ""

$psi = New-Object System.Diagnostics.ProcessStartInfo
$psi.FileName = $cloudflaredExe
$psi.Arguments = "tunnel --url http://localhost:3000"
$psi.RedirectStandardOutput = $true
$psi.RedirectStandardError = $true
$psi.UseShellExecute = $false
$psi.CreateNoWindow = $true
$proc = New-Object System.Diagnostics.Process
$proc.StartInfo = $psi
$null = $proc.Start()

$publicUrl = $null
$deadline = (Get-Date).AddSeconds(60)
while ((Get-Date) -lt $deadline -and -not $proc.HasExited) {
  $line = $proc.StandardError.ReadLine()
  if (-not $line) { Start-Sleep -Milliseconds 200; continue }
  Write-Host $line
  if ($line -match "https://[-a-zA-Z0-9]+\.trycloudflare\.com") {
    $publicUrl = $Matches[0]
    break
  }
}

if ($publicUrl) {
  Show-Links $publicUrl
  Write-Host ""
  Write-Host "Use that HTTPS Employee link on mobile data / outside Wi-Fi." -ForegroundColor Green
  Write-Host "Do not use localhost, 0.0.0.0, or 192.168 links." -ForegroundColor Yellow
  while (-not $proc.HasExited) { Start-Sleep -Seconds 2 }
} else {
  Write-Host "Could not read the public link automatically." -ForegroundColor Yellow
  Write-Host "Opening tunnel in a visible window. Copy the https://...trycloudflare.com link and add /employee."
  $cmd = "& '" + $cloudflaredExe + "' tunnel --url http://localhost:3000"
  Start-Process powershell -ArgumentList "-NoExit", "-Command", $cmd
  Read-Host "Press Enter to close this helper window"
}
