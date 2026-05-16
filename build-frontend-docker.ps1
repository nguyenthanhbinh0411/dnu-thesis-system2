# Build frontend Docker image locally
# Run this script from the project root

$ErrorActionPreference = "Stop"

$ScriptDir = $PSScriptRoot
$FrontendDir = Join-Path $ScriptDir "thesis-frontend"
$DockerContext = Join-Path $ScriptDir "frontend-docker"

Write-Host "=== Cleaning up previous Docker context ===" -ForegroundColor Cyan
if (Test-Path $DockerContext) {
    Remove-Item -Path $DockerContext -Recurse -Force
}
New-Item -ItemType Directory -Path $DockerContext -Force | Out-Null

Write-Host "=== Preparing Docker context ===" -ForegroundColor Cyan

# Copy built dist files
Copy-Item -Path (Join-Path $FrontendDir "dist\*") -Destination $DockerContext -Recurse -Force

# Copy Dockerfile and nginx config
Copy-Item -Path (Join-Path $FrontendDir "Dockerfile") -Destination $DockerContext -Force
Copy-Item -Path (Join-Path $FrontendDir "nginx.conf") -Destination $DockerContext -Force

# Copy source files needed for build
$configFiles = @(
    "package.json",
    "package-lock.json",
    "tsconfig.json",
    "tsconfig.app.json",
    "tsconfig.node.json",
    "vite.config.ts",
    "index.html",
    "tailwind.config.js",
    "postcss.config.js",
    "eslint.config.js"
)

foreach ($file in $configFiles) {
    $srcPath = Join-Path $FrontendDir $file
    if (Test-Path $srcPath) {
        Copy-Item -Path $srcPath -Destination $DockerContext -Force
    }
}

# Copy source directories
Copy-Item -Path (Join-Path $FrontendDir "src") -Destination $DockerContext -Recurse -Force
Copy-Item -Path (Join-Path $FrontendDir "public") -Destination $DockerContext -Recurse -Force

Write-Host "=== Docker context prepared ===" -ForegroundColor Green
Get-ChildItem -Path $DockerContext

Write-Host ""
Write-Host "=== Building frontend Docker image ===" -ForegroundColor Cyan
docker build `
    --tag graduation-thesis-web:local `
    --file (Join-Path $DockerContext "Dockerfile") `
    $DockerContext

Write-Host ""
Write-Host "=== Build completed ===" -ForegroundColor Green
docker images | Select-String "graduation-thesis-web"
