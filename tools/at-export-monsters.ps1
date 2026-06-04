param(
    [string]$AdventureTools = "${env:ProgramFiles(x86)}\Wizards of the Coast\Adventure Tools",
    [string]$Output = "",
    [string]$CacheDir = "",
    [int]$Limit = 0,
    [switch]$Force,
    [switch]$SkipEtl
)

$ErrorActionPreference = "Stop"

$repoRoot = Split-Path $PSScriptRoot -Parent
if (-not $Output) { $Output = Join-Path $repoRoot "generated\at-monsters" }
if (-not $CacheDir) { $CacheDir = Join-Path $repoRoot "generated\at-cache" }

$buildScript = Join-Path $PSScriptRoot "at-monster-export\build.ps1"
$exe = Join-Path $PSScriptRoot "at-monster-export\bin\at-monster-export.exe"

& $buildScript

$outputPath = (New-Item -ItemType Directory -Force -Path $Output).FullName
$cachePath = (New-Item -ItemType Directory -Force -Path $CacheDir).FullName

$exportArgs = @(
    "--adventure-tools", $AdventureTools,
    "--output", $outputPath,
    "--cache-dir", $cachePath
)
if ($Limit -gt 0) { $exportArgs += @("--limit", $Limit) }
if ($Force) { $exportArgs += "--force" }

& $exe @exportArgs
if ($LASTEXITCODE -ne 0 -and $LASTEXITCODE -ne 2) {
    exit $LASTEXITCODE
}

if (-not $SkipEtl) {
    $etlOut = Join-Path $repoRoot "generated\monsters"
    python (Join-Path $repoRoot "tools\etl\build_monster_index.py") $outputPath $etlOut
}
