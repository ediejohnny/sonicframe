# Runs every quality check before a commit: formatting and lint, type checks,
# copied code, the test suite, a library build, its size and its web
# addresses, then lists the big files to review. Exits non-zero on the first
# failure; the list of big files is information and never fails.
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

Write-Host '[1/8] Format and lint'
& .\node_modules\.bin\vp.cmd check
Assert-Success 'vp check'

Write-Host '[2/8] Types'
& .\node_modules\.bin\tsc.cmd --noEmit
Assert-Success 'tsc'

# A stretch of 50 tokens or more found twice in the library fails: what repeats
# becomes one shared piece. A repetition kept on purpose is wrapped in
# `jscpd:ignore-start` / `jscpd:ignore-end` comments that say why.
Write-Host '[3/8] Copied code'
& .\node_modules\.bin\jscpd.cmd src --format typescript --min-tokens 50 --exit-code 1 --no-colors
Assert-Success 'jscpd'

Write-Host '[4/8] Tests'
& .\node_modules\.bin\vp.cmd test run
Assert-Success 'vp test'

Write-Host '[5/8] Library build'
& .\node_modules\.bin\vp.cmd pack
Assert-Success 'vp pack'

Write-Host '[6/8] Bundle size and dependency guard'
& powershell -NoProfile -ExecutionPolicy Bypass -File (Join-Path $PSScriptRoot 'size.ps1')
Assert-Success 'size guard'

Write-Host '[7/8] Web addresses in the package'
& powershell -NoProfile -ExecutionPolicy Bypass -File (Join-Path $PSScriptRoot 'addresses.ps1')
Assert-Success 'address guard'

Write-Host '[8/8] Big files to review'
& powershell -NoProfile -ExecutionPolicy Bypass -File (Join-Path $PSScriptRoot 'big-files.ps1')

$seconds = [Math]::Round($started.Elapsed.TotalSeconds, 1)
Write-Host "All checks passed in $seconds s." -ForegroundColor Green
