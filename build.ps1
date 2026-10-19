# Crea i pacchetti di rilascio in dist/:
#   LinkeMap-<versione>-test.zip   cartella LinkeMap-<versione>/ + LEGGIMI.txt, da mandare ai tester
#   LinkeMap-<versione>-store.zip  manifest.json alla radice, da caricare sul Chrome Web Store
# Uso: powershell -ExecutionPolicy Bypass -File build.ps1   (su macOS/Linux: sh build.sh)

$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.IO.Compression, System.IO.Compression.FileSystem

$root = $PSScriptRoot
$version = (Get-Content -Raw -Encoding UTF8 (Join-Path $root 'manifest.json') | ConvertFrom-Json).version

# Solo ciò che serve all'estensione, elencato in build-files.txt (condiviso con build.sh).
$files = @()
foreach ($line in Get-Content -Encoding UTF8 (Join-Path $root 'build-files.txt')) {
  $entry = $line.Trim()
  if (-not $entry -or $entry.StartsWith('#')) { continue }
  $path = Join-Path $root $entry
  if ($entry.EndsWith('/') -and (Test-Path $path)) {
    $files += Get-ChildItem -Recurse -File $path |
      ForEach-Object { $_.FullName.Substring($root.Length + 1) -replace '\\', '/' }
  } else {
    $files += $entry
  }
}

$missing = $files | Where-Object { -not (Test-Path (Join-Path $root $_)) }
if ($missing) { throw "File mancanti: $($missing -join ', ')" }

$dist = Join-Path $root 'dist'
New-Item -ItemType Directory -Force $dist | Out-Null

function New-Zip($zipPath, $entries) {
  if (Test-Path $zipPath) { Remove-Item $zipPath -Force }
  $zip = [System.IO.Compression.ZipFile]::Open($zipPath, 'Create')
  try {
    foreach ($e in $entries) {
      # Separatore "/" obbligatorio: con "\" lo zip non si apre bene su Mac/Linux né sullo store.
      [System.IO.Compression.ZipFileExtensions]::CreateEntryFromFile(
        $zip, (Join-Path $root $e.Source), $e.Name, 'Optimal') | Out-Null
    }
  } finally {
    $zip.Dispose()
  }
}

$folder = "LinkeMap-$version"
$testEntries = @($files | ForEach-Object { @{ Source = $_; Name = "$folder/$_" } })
$testEntries += @{ Source = 'LEGGIMI.txt'; Name = "$folder/LEGGIMI.txt" }
$storeEntries = @($files | ForEach-Object { @{ Source = $_; Name = $_ } })

$testZip = Join-Path $dist "LinkeMap-$version-test.zip"
$storeZip = Join-Path $dist "LinkeMap-$version-store.zip"
New-Zip $testZip $testEntries
New-Zip $storeZip $storeEntries

Write-Host "Versione $version - $($files.Count) file"
Get-Item $testZip, $storeZip | ForEach-Object { '{0}  ({1:N0} KB)' -f $_.FullName, ($_.Length / 1KB) }
