# Packs the unpacked Windows build into IT-Dashboard-<version>-portable.zip.
# The zip holds one folder "IT-Dashboard" with the app and an empty "data"
# folder; that folder switches the app into portable mode (see main.js), so
# settings and logins stay next to the exe instead of in %APPDATA%.
#
# Run after `npm run build:win`:  pwsh -File scripts/make-portable.ps1 [-Dist dist]
param([string]$Dist = 'dist')
$ErrorActionPreference = 'Stop'

$root    = Split-Path $PSScriptRoot -Parent
$distDir = Join-Path $root $Dist
$version = (Get-Content (Join-Path $root 'package.json') -Raw | ConvertFrom-Json).version
$src     = Join-Path $distDir 'win-unpacked'
if (-not (Test-Path (Join-Path $src 'IT Dashboard.exe'))) { throw "No build in $src. Run npm run build:win first." }

$stageRoot = Join-Path $distDir 'portable-stage'
$stage     = Join-Path $stageRoot 'IT-Dashboard'
if (Test-Path $stageRoot) { Remove-Item $stageRoot -Recurse -Force }
New-Item -ItemType Directory -Force $stage | Out-Null
Copy-Item (Join-Path $src '*') $stage -Recurse

New-Item -ItemType Directory -Force (Join-Path $stage 'data') | Out-Null
Set-Content (Join-Path $stage 'data/README.txt') @(
  'This folder holds the settings, logins and go2rtc of this portable copy.',
  'Delete it, and the app uses the settings of the installed version in %APPDATA%\it-dashboard instead.'
)

$zip = Join-Path $distDir "IT-Dashboard-$version-portable.zip"
if (Test-Path $zip) { Remove-Item $zip -Force }
Compress-Archive -Path $stage -DestinationPath $zip -CompressionLevel Optimal
Remove-Item $stageRoot -Recurse -Force
Write-Output "Built $zip"
