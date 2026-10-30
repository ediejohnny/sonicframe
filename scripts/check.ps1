# Runs every quality check before a commit: formatting and lint, type checks,
# the test suite, a library build, its size and its web addresses. Exits
# non-zero on the first failure.
#
# Usage: powershell -NoProfile -ExecutionPolicy Bypass -File scripts\check.ps1

$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path -Parent $PSScriptRoot
Set-Location $projectRoot

$started = [Diagnostics.Stopwatch]::StartNew()

function Assert-Success([string] $step) {
    if ($LASTEXITCODE -ne 0) {
        Write-Host "FAILED: $step (exit $LASTEXITCODE)" -ForegroundColor Red
        exit $LASTEXITCODE
    }
}

Write-Host '[1/6] Format and lint'
& .\node_modules\.bin\vp.cmd check
Assert-Success 'vp check'

Write-Host '[2/6] Types'
& .\node_modules\.bin\tsc.cmd --noEmit
Assert-Success 'tsc'

Write-Host '[3/6] Tests'
& .\node_modules\.bin\vp.cmd test run
Assert-Success 'vp test'

Write-Host '[4/6] Library build'
& .\node_modules\.bin\vp.cmd pack
Assert-Success 'vp pack'

Write-Host '[5/6] Bundle size and dependency guard'
& powershell -NoProfile -ExecutionPolicy Bypass -File (Join-Path $PSScriptRoot 'size.ps1')
Assert-Success 'size guard'

Write-Host '[6/6] Web addresses in the package'
& powershell -NoProfile -ExecutionPolicy Bypass -File (Join-Path $PSScriptRoot 'addresses.ps1')
Assert-Success 'address guard'

$seconds = [Math]::Round($started.Elapsed.TotalSeconds, 1)
Write-Host "All checks passed in $seconds s." -ForegroundColor Green
