param(
  [string]$WebBaseUrl = "http://127.0.0.1:4321"
)

$ErrorActionPreference = "Stop"

$root = Invoke-WebRequest "$WebBaseUrl/" -UseBasicParsing
if ($root.StatusCode -ne 200) {
  throw "Web root returned non-200 status: $($root.StatusCode)"
}

$api = Invoke-WebRequest "$WebBaseUrl/api/new-arrivals" -UseBasicParsing
if ($api.StatusCode -ne 200) {
  throw "Web API /api/new-arrivals returned non-200 status: $($api.StatusCode)"
}

Write-Output "WEB_CHECK_OK"
