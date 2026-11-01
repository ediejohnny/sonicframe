# Lists the source and test files longer than -Lines (400 by default), longest
# first, to review: could the file be smaller and still make sense? Information
# only: it never fails the check.
#
# Usage: powershell -NoProfile -ExecutionPolicy Bypass -File scripts\big-files.ps1 [-Lines 400]

param([int] $Lines = 400)

$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path -Parent $PSScriptRoot

$big = foreach ($folder in 'src', 'test') {
    Get-ChildItem (Join-Path $projectRoot $folder) -Recurse -File -Filter *.ts | ForEach-Object {
        $count = (Get-Content $_.FullName -Encoding UTF8).Count
        if ($count -gt $Lines) {
            [pscustomobject]@{
                Path = $_.FullName.Substring($projectRoot.Length + 1).Replace('\', '/')
                Lines = $count
            }
        }
    }
}

if ($null -eq $big) {
    Write-Host "No file is longer than $Lines lines."
    exit 0
}

Write-Host "Files longer than $Lines lines (information, never a failure):"
foreach ($file in $big | Sort-Object Lines -Descending) {
    Write-Host ('  {0,5}  {1}' -f $file.Lines, $file.Path)
}

exit 0
