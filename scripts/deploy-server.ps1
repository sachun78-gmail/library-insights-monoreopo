param(
  [string]$Remote = "sachun78@163.245.214.222",
  [string]$RemotePath = "/opt/bookReserch",
  [string]$ProcessManager = "none",
  [string]$CopyMode = "auto",
  [switch]$UseSudo
)

$ErrorActionPreference = "Stop"
$RemoteUser = ($Remote -split "@")[0]

function Require-Command {
  param([string]$Name)
  if (-not (Get-Command $Name -ErrorAction SilentlyContinue)) {
    throw "Required command not found: $Name"
  }
}

function Invoke-Native {
  param(
    [Parameter(Mandatory = $true)]
    [string]$Command,
    [Parameter(Mandatory = $true)]
    [string[]]$Args
  )

  & $Command @Args
  if ($LASTEXITCODE -ne 0) {
    throw "Command failed ($LASTEXITCODE): $Command $($Args -join ' ')"
  }
}

function Invoke-Remote {
  param(
    [Parameter(Mandatory = $true)]
    [string]$RemoteHost,
    [Parameter(Mandatory = $true)]
    [string]$RemoteCommand
  )

  if ($UseSudo) {
    Invoke-Native -Command "ssh" -Args @("-tt", $RemoteHost, $RemoteCommand)
  } else {
    Invoke-Native -Command "ssh" -Args @($RemoteHost, $RemoteCommand)
  }
}

Require-Command "ssh"

Write-Output "Preparing remote path: ${Remote}:$RemotePath"
$mkdirCmd = if ($UseSudo) { "sudo mkdir -p $RemotePath && sudo chown -R ${RemoteUser}:$RemoteUser $RemotePath" } else { "mkdir -p $RemotePath" }
Invoke-Remote -RemoteHost $Remote -RemoteCommand $mkdirCmd

$remoteTarget = "${Remote}:$RemotePath"

$hasRsync = [bool](Get-Command "rsync" -ErrorAction SilentlyContinue)
$hasScp = [bool](Get-Command "scp" -ErrorAction SilentlyContinue)
$hasTar = [bool](Get-Command "tar" -ErrorAction SilentlyContinue)

if ($CopyMode -eq "auto") {
  if ($hasRsync) {
    $CopyMode = "rsync"
  } elseif ($hasScp -and $hasTar) {
    $CopyMode = "scp"
  } else {
    throw "No supported copy method found. Install rsync, or ensure scp and tar are available."
  }
}

if ($CopyMode -eq "rsync") {
  if (-not $hasRsync) {
    throw "CopyMode is rsync, but rsync is not installed."
  }
  Write-Output "Syncing project with rsync (server-focused)..."
  Invoke-Native -Command "rsync" -Args @(
    "-avz",
    "--exclude", ".git",
    "--exclude", "node_modules",
    "--exclude", "apps/web",
    "--exclude", ".astro",
    "--exclude", "dist",
    "./",
    $remoteTarget
  )
} elseif ($CopyMode -eq "scp") {
  if (-not ($hasScp -and $hasTar)) {
    throw "CopyMode is scp, but scp and/or tar are not installed."
  }
  Write-Output "Syncing project with tar+scp (server-focused)..."
  $archiveName = "bookreserch-deploy-$([Guid]::NewGuid().ToString('N')).tar"
  $archivePath = Join-Path (Get-Location) $archiveName
  try {
    Invoke-Native -Command "tar" -Args @(
      "-cf", $archiveName,
      "--exclude=.git",
      "--exclude=node_modules",
      "--exclude=apps/web",
      "--exclude=.astro",
      "--exclude=dist",
      "--exclude=$archiveName",
      "."
    )
    $remoteArchive = "/tmp/$archiveName"
    Invoke-Native -Command "scp" -Args @($archiveName, "${Remote}:$remoteArchive")
    $extractCmd = if ($UseSudo) {
      "sudo mkdir -p $RemotePath && sudo tar -xf $remoteArchive -C $RemotePath && sudo chown -R ${RemoteUser}:$RemoteUser $RemotePath && rm -f $remoteArchive"
    } else {
      "mkdir -p $RemotePath && tar -xf $remoteArchive -C $RemotePath && rm -f $remoteArchive"
    }
    Invoke-Remote -RemoteHost $Remote -RemoteCommand $extractCmd
  } finally {
    if (Test-Path $archivePath) {
      Remove-Item -Force $archivePath
    }
  }
} else {
  throw "Unsupported CopyMode: $CopyMode. Use auto, rsync, or scp."
}

Write-Output "Installing and building server on remote..."
$buildCmd = @"
set -e
cd $RemotePath
npm install
npm run build -w @bookreserch/server
"@
if ($UseSudo) {
  $buildCmd = @"
set -e
cd $RemotePath
npm install
npm run build -w @bookreserch/server
"@
}
Invoke-Remote -RemoteHost $Remote -RemoteCommand $buildCmd

if ($ProcessManager -eq "pm2") {
  Write-Output "Restarting server with pm2..."
  $pm2Cmd = @"
set -e
cd $RemotePath
pm2 describe bookreserch-server >/dev/null 2>&1 && pm2 restart bookreserch-server || pm2 start "npm -- run start -w @bookreserch/server" --name bookreserch-server
pm2 save
"@
  if ($UseSudo) {
    $pm2Cmd = @"
set -e
cd $RemotePath
pm2 describe bookreserch-server >/dev/null 2>&1 && pm2 restart bookreserch-server || pm2 start "npm -- run start -w @bookreserch/server" --name bookreserch-server
pm2 save
"@
  }
  Invoke-Remote -RemoteHost $Remote -RemoteCommand $pm2Cmd
} else {
  Write-Output "Deployment done. Start server manually on remote:"
  Write-Output "cd $RemotePath && npm run start -w @bookreserch/server"
}

Write-Output "DEPLOY_SERVER_OK"
