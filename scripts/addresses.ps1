# Fails when the built package holds a web address other than the SVG namespace, which the browser
# needs to create the icons and never fetches. Any other text that looks like an address is a finding.
#
# Usage: powershell -NoProfile -ExecutionPolicy Bypass -File scripts\addresses.ps1

$ErrorActionPreference = 'Stop'
$dist = Join-Path (Split-Path -Parent $PSScriptRoot) 'dist'
$allowed = @('http://www.w3.org/2000/svg')
$found = @()

foreach ($file in Get-ChildItem -Path $dist -Recurse -File) {
    $text = [IO.File]::ReadAllText($file.FullName)

    foreach ($match in [regex]::Matches($text, 'https?://[^\s''"`)<>\]]+')) {
        if ($allowed -notcontains $match.Value) {
            $found += "$($file.Name): $($match.Value)"
        }
    }
}

if ($found.Count -gt 0) {
    Write-Host 'Web addresses in dist (only the SVG namespace may appear):' -ForegroundColor Red
    $found | ForEach-Object { Write-Host "  $_" }
    exit 1
}

Write-Host '  no web address in dist besides the SVG namespace'
