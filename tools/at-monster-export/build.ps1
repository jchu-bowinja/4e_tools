param(
    [string]$Configuration = "Release"
)

$ErrorActionPreference = "Stop"

$projectDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$sourceFile = Join-Path $projectDir "Program.cs"
$outDir = Join-Path $projectDir "bin"
$outExe = Join-Path $outDir "at-monster-export.exe"
$csc = Join-Path $env:WINDIR "Microsoft.NET\Framework\v4.0.30319\csc.exe"

if (-not (Test-Path $csc)) {
    throw "C# compiler not found at $csc. Install .NET Framework 4.x developer tools or use Visual Studio Build Tools."
}

New-Item -ItemType Directory -Force -Path $outDir | Out-Null

$frameworkDir = Split-Path $csc -Parent
$refs = @(
    (Join-Path $frameworkDir "mscorlib.dll"),
    (Join-Path $frameworkDir "System.Core.dll"),
    (Join-Path $frameworkDir "System.dll"),
    (Join-Path $frameworkDir "System.Xml.dll")
)

Write-Host "Compiling at-monster-export..."
& $csc /nologo /platform:x86 /optimize+ /out:$outExe `
    $(foreach ($ref in $refs) { "/reference:`"$ref`"" }) `
    "$sourceFile"

if ($LASTEXITCODE -ne 0) {
    throw "Compilation failed."
}

Write-Host "Built $outExe"
