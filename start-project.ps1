[CmdletBinding()]
param(
    [switch]$NoBrowser
)

$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $MyInvocation.MyCommand.Path
$envFile = Join-Path $root '.env'

if (-not (Get-Command pnpm -ErrorAction SilentlyContinue)) {
    throw 'pnpm is not installed or is not available in PATH.'
}

if (-not (Test-Path (Join-Path $root 'package.json'))) {
    throw "Project root was not found: $root"
}

if (-not (Test-Path $envFile)) {
    Write-Warning "No .env file found at $envFile. Firebase requests may fail."
}

Set-Location $root

if (-not (Test-Path (Join-Path $root 'node_modules'))) {
    Write-Host 'Installing workspace dependencies...' -ForegroundColor Cyan
    pnpm install
    if ($LASTEXITCODE -ne 0) {
        throw 'pnpm install failed.'
    }
}

$escapedRoot = $root.Replace("'", "''")
$apiCommand = "Set-Location '$escapedRoot'; `$env:PORT = '8080'; pnpm --filter @workspace/api-server run dev"
$dashboardCommand = "Set-Location '$escapedRoot'; `$env:PORT = '5173'; `$env:BASE_PATH = '/'; pnpm --filter @workspace/msts-dashboard run dev"

Write-Host 'Starting API server on http://localhost:8080 ...' -ForegroundColor Green
Start-Process powershell.exe -WorkingDirectory $root -ArgumentList @(
    '-NoExit',
    '-ExecutionPolicy', 'Bypass',
    '-Command', $apiCommand
)

Write-Host 'Starting dashboard on http://localhost:5173 ...' -ForegroundColor Green
Start-Process powershell.exe -WorkingDirectory $root -ArgumentList @(
    '-NoExit',
    '-ExecutionPolicy', 'Bypass',
    '-Command', $dashboardCommand
)

if (-not $NoBrowser) {
    Start-Process 'http://localhost:5173'
}

Write-Host ''
Write-Host 'Both services were launched in separate PowerShell windows.' -ForegroundColor Green
Write-Host 'Dashboard: http://localhost:5173'
Write-Host 'API health: http://localhost:8080/api/healthz'
Write-Host 'Close both service windows to stop the project.'
