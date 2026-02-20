param(
  [string]$ServerBaseUrl = "http://127.0.0.1:8080"
)

$ErrorActionPreference = "Stop"

function Get-EnvValueFromFile {
  param(
    [string]$Path,
    [string]$Key
  )

  if (-not (Test-Path $Path)) {
    return $null
  }

  $pattern = "^\s*$Key\s*=\s*(.+)\s*$"
  foreach ($line in Get-Content $Path) {
    if ($line -match "^\s*#") { continue }
    if ($line -match $pattern) {
      return $matches[1].Trim('"').Trim("'").Trim()
    }
  }
  return $null
}

$secret = Get-EnvValueFromFile -Path "apps/server/.env" -Key "PROXY_SHARED_SECRET"
if (-not $secret) {
  throw "Cannot find PROXY_SHARED_SECRET in apps/server/.env"
}

$health = Invoke-RestMethod "$ServerBaseUrl/healthz"
if (-not $health.ok) {
  throw "Server healthz returned invalid response"
}

$headers = @{ "x-proxy-key" = $secret }
$resp = Invoke-WebRequest "$ServerBaseUrl/v1/srchBooks?keyword=test&pageNo=1&pageSize=1" -Headers $headers -UseBasicParsing
if ($resp.StatusCode -ne 200) {
  throw "Proxy endpoint returned non-200 status: $($resp.StatusCode)"
}

Write-Output "SERVER_CHECK_OK"
