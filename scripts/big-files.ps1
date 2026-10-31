# Lists the source and test files longer than -Lines (400 by default), longest
# first, to review: could the file be smaller and still make sense? A source
# file that stays big says why in its head ("it stays one ..."); the list marks
# the ones that do not. Information only: it never fails the check.
#
# Usage: powershell -NoProfile -ExecutionPolicy Bypass -File scripts\big-files.ps1 [-Lines 400]

param([int] $Lines = 400)

$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path -Parent $PSScriptRoot

$big = foreach ($folder in 'src', 'test') {
    Get-ChildItem (Join-Path $projectRoot $folder) -Recurse -File -Filter *.ts | ForEach-Object {
        $text = Get-Content $_.FullName -Encoding UTF8
        if ($text.Count -gt $Lines) {
            $head = ($text | Select-Object -First 30) -join ' '
            [pscustomobject]@{
                Path = $_.FullName.Substring($projectRoot.Length + 1).Replace('\', '/')
                Lines = $text.Count
                Reason = $folder -eq 'test' -or $head -match 'stays? one'
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
    $note = if ($file.Reason) { '' } else { '  (its head does not say why it stays big)' }
    Write-Host ('  {0,5}  {1}{2}' -f $file.Lines, $file.Path, $note)
}

exit 0
