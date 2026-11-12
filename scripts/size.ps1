# Guards the built package: no runtime dependency leaked into the bundle, no test-only code shipped,
# and each entry within its gzip budget (scripts/size-budget.json). An entry is measured together with
# every chunk it imports (concatenated, then gzipped), so code the bundler moves into a shared chunk is
# still counted. Each entry's minified twin (`player.min.js`) is measured the same way, for information
# only, and must import minified chunks alone. Run after a build (vp pack).
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
# trace of a dev-only tool such as happy-dom. The specifier must look like a real module name (not an
# English word that merely happens to sit before a closing quote in a string).
$externalImport = "(?:from|import|require)\s*\(?\s*['""]([a-zA-Z0-9@][\w@.\-/:]*)['""]"
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
function Get-GzipSize([string[]] $paths) {
    $stream = New-Object IO.MemoryStream
    $gzip = New-Object IO.Compression.GzipStream($stream, [IO.Compression.CompressionLevel]::Optimal)
    foreach ($path in $paths) {
        $bytes = [IO.File]::ReadAllBytes($path)
        $gzip.Write($bytes, 0, $bytes.Length)
    }
    $gzip.Close()
    return $stream.ToArray().Length
}

# The entry and every chunk it imports, directly or through another chunk, each once.
$relativeImport = "(?:from|import)\s*\(?\s*['""](\.{1,2}/[^'""]+)['""]"
function Get-Closure([IO.FileInfo] $entry) {
    $seen = [ordered]@{}
    $queue = New-Object System.Collections.Queue
    $queue.Enqueue($entry.FullName)
    while ($queue.Count -gt 0) {
        $path = [IO.Path]::GetFullPath($queue.Dequeue())
        if ($seen.Contains($path) -or -not (Test-Path $path)) { continue }
        $seen[$path] = $true
        $text = [IO.File]::ReadAllText($path)
        foreach ($match in [regex]::Matches($text, $relativeImport)) {
            $queue.Enqueue((Join-Path (Split-Path $path) $match.Groups[1].Value))
        }
    }
    return [string[]] $seen.Keys
}

$budget = (Get-Content (Join-Path $PSScriptRoot 'size-budget.json') -Raw | ConvertFrom-Json).budget

foreach ($file in $scripts) {
    Write-Host ("  {0,-24} gzip {1,7}" -f $file.Name, (Get-GzipSize @($file.FullName)))
}

foreach ($property in $budget.PSObject.Properties) {
    $entry = $scripts | Where-Object { $_.Name -eq $property.Name } | Select-Object -First 1
    if ($null -eq $entry) {
        $problems += "$($property.Name): has a budget but was not built"
        continue
    }
    $closure = Get-Closure $entry
    $gzip = Get-GzipSize $closure
    $ceiling = [int] $property.Value
    $status = if ($gzip -le $ceiling) { 'ok' } else { 'OVER' }
    Write-Host ("  {0,-24} gzip {1,7} / {2,7}  {3}  (entry + {4} chunk(s))" -f $property.Name, $gzip, $ceiling, $status, ($closure.Count - 1))
    if ($gzip -gt $ceiling) {
        $problems += "$($property.Name): gzip $gzip (with its chunks) exceeds budget $ceiling"
    }

    # The minified twin (player.min.js), shown for information: it must exist and import only minified chunks.
    $minName = $property.Name -replace '\.js$', '.min.js'
    $minEntry = $scripts | Where-Object { $_.Name -eq $minName } | Select-Object -First 1
    if ($null -eq $minEntry) {
        $problems += "${minName}: was not built"
        continue
    }
    $minClosure = Get-Closure $minEntry
    $readable = @($minClosure | Where-Object { $_ -notmatch '\.min\.js$' })
    if ($readable.Count -gt 0) {
        $problems += "${minName}: imports a chunk that is not minified ($(Split-Path -Leaf $readable[0]))"
    }
    Write-Host ("  {0,-24} gzip {1,7}  (information, entry + {2} chunk(s))" -f $minName, (Get-GzipSize $minClosure), ($minClosure.Count - 1))
}

# Every file the package's `exports` names was built.
$exports = (Get-Content (Join-Path $projectRoot 'package.json') -Raw | ConvertFrom-Json).exports
foreach ($subpath in $exports.PSObject.Properties) {
    $targets = if ($subpath.Value -is [string]) { @($subpath.Value) } else { @($subpath.Value.PSObject.Properties | ForEach-Object { $_.Value }) }
    foreach ($target in $targets) {
        if (-not (Test-Path (Join-Path $projectRoot $target))) {
            $problems += "exports '$($subpath.Name)': $target was not built"
        }
    }
}

if ($problems.Count -gt 0) {
    Write-Host 'FAILED: size/dependency guard' -ForegroundColor Red
    $problems | ForEach-Object { Write-Host "  - $_" -ForegroundColor Red }
    exit 1
}
