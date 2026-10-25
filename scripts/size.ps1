# Guards the built package: no runtime dependency leaked into the bundle, no test-only code shipped,
# and each file within its gzip budget (scripts/size-budget.json). Run after a build (vp pack).
#
# Usage: powershell -NoProfile -ExecutionPolicy Bypass -File scripts\size.ps1

$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path -Parent $PSScriptRoot
Set-Location $projectRoot

$distDir = Join-Path $projectRoot 'dist'
if (-not (Test-Path $distDir)) {
    Write-Host 'FAILED: dist/ is missing; run a build first.' -ForegroundColor Red
    exit 1
}

$scripts = Get-ChildItem -Path $distDir -Recurse -File -Filter *.js
if ($scripts.Count -eq 0) {
    Write-Host 'FAILED: no JavaScript in dist/.' -ForegroundColor Red
    exit 1
}

$problems = @()

# A neutral, dependency-free build inlines everything: there must be no bare import or require, and no
# trace of a dev-only tool such as happy-dom.
$externalImport = "(?:from|import|require)\s*\(?\s*['""]([^'""./][^'""]*)['""]"
foreach ($file in $scripts) {
    $text = [IO.File]::ReadAllText($file.FullName)

    foreach ($match in [regex]::Matches($text, $externalImport)) {
        $module = $match.Groups[1].Value
        if ($module -notmatch '^node:') {
            $problems += "$($file.Name): imports external module '$module' (the bundle must be self-contained)"
        } else {
            $problems += "$($file.Name): imports Node built-in '$module' (the bundle must run anywhere)"
        }
    }

    if ($text -match 'happy-dom' -or $text -match 'node_modules') {
        $problems += "$($file.Name): contains a reference to a dev-only path (happy-dom/node_modules)"
    }
}

# Gzip size of each .js against its budget.
Add-Type -AssemblyName System.IO.Compression
function Get-GzipSize([string] $path) {
    $bytes = [IO.File]::ReadAllBytes($path)
    $stream = New-Object IO.MemoryStream
    $gzip = New-Object IO.Compression.GzipStream($stream, [IO.Compression.CompressionLevel]::Optimal)
    $gzip.Write($bytes, 0, $bytes.Length)
    $gzip.Close()
    return $stream.ToArray().Length
}

$budget = (Get-Content (Join-Path $PSScriptRoot 'size-budget.json') -Raw | ConvertFrom-Json).budget

foreach ($file in $scripts) {
    $gzip = Get-GzipSize $file.FullName
    $ceiling = $budget.($file.Name)
    if ($null -ne $ceiling) {
        $status = if ($gzip -le $ceiling) { 'ok' } else { 'OVER' }
        Write-Host ("  {0,-16} gzip {1,7} / {2,7}  {3}" -f $file.Name, $gzip, $ceiling, $status)
        if ($gzip -gt $ceiling) {
            $problems += "$($file.Name): gzip $gzip exceeds budget $ceiling"
        }
    } else {
        Write-Host ("  {0,-16} gzip {1,7}  (no budget)" -f $file.Name, $gzip)
    }
}

if ($problems.Count -gt 0) {
    Write-Host 'FAILED: size/dependency guard' -ForegroundColor Red
    $problems | ForEach-Object { Write-Host "  - $_" -ForegroundColor Red }
    exit 1
}
