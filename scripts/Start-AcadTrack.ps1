param([switch]$Production)
$ErrorActionPreference = 'Stop'
Set-Location -LiteralPath (Split-Path -Parent $PSScriptRoot)
$nodeCommand = Get-Command node -ErrorAction SilentlyContinue
$nodeBinary = if ($nodeCommand) { $nodeCommand.Source } else { Join-Path $env:USERPROFILE '.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe' }
if (-not (Test-Path -LiteralPath $nodeBinary)) { throw 'Install Node.js 22 or later, then run npm install in this project.' }
if (-not (Test-Path -LiteralPath 'node_modules\next\dist\bin\next')) { throw 'Dependencies are missing. Run npm install in this project first.' }
if ($Production) {
    & $nodeBinary 'node_modules/next/dist/bin/next' build --webpack
    if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
    & $nodeBinary 'node_modules/next/dist/bin/next' start --hostname 127.0.0.1
} else {
    & $nodeBinary 'node_modules/next/dist/bin/next' dev --webpack --hostname 127.0.0.1
}
