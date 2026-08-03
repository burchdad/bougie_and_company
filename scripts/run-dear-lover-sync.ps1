$ErrorActionPreference = "Stop"

$ProjectRoot = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
$LogDirectory = Join-Path $ProjectRoot "logs"
$Node = "C:\Program Files\nodejs\node.exe"
$Timestamp = Get-Date -Format "yyyyMMdd-HHmmss"
$LogPath = Join-Path $LogDirectory "dear-lover-sync-$Timestamp.log"

New-Item -ItemType Directory -Force -Path $LogDirectory | Out-Null
Set-Location $ProjectRoot

& $Node "scripts\dear-lover-sync-agent.mjs" `
  --from=1 `
  --to=193 `
  --publish `
  --batch-size=4 `
  *> $LogPath

exit $LASTEXITCODE
