param(
  [ValidateSet('setup', 'start', 'stop', 'status', 'remove')]
  [string]$Action = 'status'
)

$ErrorActionPreference = 'Stop'

$PostgresVersion = '16.14-2'
$DatabaseName = 'tamagotchi'
$DatabaseUser = 'tamagotchi'
$DatabasePassword = 'tamagotchi'
$DatabasePort = 5432
$DownloadUrl = "https://get.enterprisedb.com/postgresql/postgresql-$PostgresVersion-windows-x64-binaries.zip"

$RepoRoot = [System.IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..\..'))
$LocalRoot = [System.IO.Path]::GetFullPath((Join-Path $RepoRoot '.local'))
$ArchivePath = Join-Path $LocalRoot "postgresql-$PostgresVersion-windows-x64-binaries.zip"
$InstallRoot = Join-Path $LocalRoot 'postgresql'
$DataRoot = Join-Path $LocalRoot 'postgresql-data'
$LogPath = Join-Path $LocalRoot 'postgresql.log'

function Get-PostgresBin {
  $candidates = @(
    (Join-Path $InstallRoot 'pgsql\bin'),
    (Join-Path $InstallRoot 'bin')
  )

  foreach ($candidate in $candidates) {
    if (Test-Path (Join-Path $candidate 'pg_ctl.exe')) {
      return $candidate
    }
  }

  if (Test-Path $InstallRoot) {
    $initDb = Get-ChildItem -Path $InstallRoot -Filter 'initdb.exe' -Recurse |
      Select-Object -First 1
    if ($initDb) {
      return $initDb.DirectoryName
    }
  }

  throw "PostgreSQL binaries were not found in $InstallRoot"
}

function Test-PostgresRunning {
  $pidPath = Join-Path $DataRoot 'postmaster.pid'
  if (-not (Test-Path $pidPath)) {
    return $false
  }

  try {
    $pgBin = Get-PostgresBin
    $serverPid = [int](Get-Content $pidPath -TotalCount 1)
    $serverProcess = Get-Process -Id $serverPid -ErrorAction Stop
    $expectedPath = [System.IO.Path]::GetFullPath((Join-Path $pgBin 'postgres.exe'))
    $actualPath = [System.IO.Path]::GetFullPath($serverProcess.Path)

    return $actualPath.Equals(
      $expectedPath,
      [System.StringComparison]::OrdinalIgnoreCase
    )
  } catch {
    return $false
  }
}

function Start-LocalPostgres {
  $pgBin = Get-PostgresBin
  if (-not (Test-Path $DataRoot)) {
    throw 'PostgreSQL is not initialized. Run npm run db:local:setup first.'
  }

  if (Test-PostgresRunning) {
    Write-Host "PostgreSQL is already running on 127.0.0.1:$DatabasePort"
    return
  }

  & (Join-Path $pgBin 'pg_ctl.exe') start `
    -D $DataRoot `
    -l $LogPath `
    -o "-p $DatabasePort -h 127.0.0.1" `
    -w

  if ($LASTEXITCODE -ne 0) {
    throw "PostgreSQL failed to start. See $LogPath"
  }

  Write-Host "PostgreSQL started on 127.0.0.1:$DatabasePort"
}

function Stop-LocalPostgres {
  if (-not (Test-PostgresRunning)) {
    Write-Host 'PostgreSQL is not running.'
    return
  }

  $pgBin = Get-PostgresBin
  & (Join-Path $pgBin 'pg_ctl.exe') stop -D $DataRoot -m fast -w
  if ($LASTEXITCODE -ne 0) {
    throw 'PostgreSQL failed to stop.'
  }

  Write-Host 'PostgreSQL stopped.'
}

function Setup-LocalPostgres {
  New-Item -ItemType Directory -Path $LocalRoot -Force | Out-Null

  if (-not (Test-Path $InstallRoot)) {
    if (-not (Test-Path $ArchivePath)) {
      Write-Host "Downloading PostgreSQL $PostgresVersion..."
      Invoke-WebRequest -Uri $DownloadUrl -OutFile $ArchivePath -UseBasicParsing
    }

    Write-Host 'Extracting PostgreSQL...'
    Expand-Archive -Path $ArchivePath -DestinationPath $InstallRoot
    Remove-Item -LiteralPath $ArchivePath -Force
  }

  $pgBin = Get-PostgresBin

  if (-not (Test-Path (Join-Path $DataRoot 'PG_VERSION'))) {
    $passwordFile = Join-Path $LocalRoot 'postgres-password.txt'
    Set-Content -Path $passwordFile -Value $DatabasePassword -NoNewline
    try {
      & (Join-Path $pgBin 'initdb.exe') `
        -D $DataRoot `
        -U $DatabaseUser `
        "--pwfile=$passwordFile" `
        '--auth=scram-sha-256' `
        '--encoding=UTF8' `
        '--locale=C'

      if ($LASTEXITCODE -ne 0) {
        throw 'PostgreSQL cluster initialization failed.'
      }
    } finally {
      Remove-Item -LiteralPath $passwordFile -Force -ErrorAction SilentlyContinue
    }
  }

  Start-LocalPostgres

  $previousPassword = $env:PGPASSWORD
  $env:PGPASSWORD = $DatabasePassword
  try {
    $databaseExists = & (Join-Path $pgBin 'psql.exe') `
      -h 127.0.0.1 `
      -p $DatabasePort `
      -U $DatabaseUser `
      -d postgres `
      -tAc "SELECT 1 FROM pg_database WHERE datname = '$DatabaseName'"

    if ($LASTEXITCODE -ne 0) {
      throw 'Could not query the local PostgreSQL server.'
    }

    if (($databaseExists | Out-String).Trim() -ne '1') {
      & (Join-Path $pgBin 'createdb.exe') `
        -h 127.0.0.1 `
        -p $DatabasePort `
        -U $DatabaseUser `
        $DatabaseName

      if ($LASTEXITCODE -ne 0) {
        throw "Could not create database $DatabaseName."
      }
    }
  } finally {
    $env:PGPASSWORD = $previousPassword
  }

  Write-Host "Database is ready: postgresql://${DatabaseUser}:${DatabasePassword}@localhost:${DatabasePort}/${DatabaseName}"
}

function Show-LocalPostgresStatus {
  if (Test-PostgresRunning) {
    Write-Host "PostgreSQL is running on 127.0.0.1:$DatabasePort"
  } elseif (Test-Path $DataRoot) {
    Write-Host 'PostgreSQL is installed but stopped.'
  } else {
    Write-Host 'PostgreSQL is not installed locally.'
  }
}

function Remove-LocalPostgres {
  Stop-LocalPostgres

  $expectedLocalRoot = [System.IO.Path]::GetFullPath((Join-Path $RepoRoot '.local'))
  if ($LocalRoot -ne $expectedLocalRoot -or -not $LocalRoot.StartsWith($RepoRoot + [System.IO.Path]::DirectorySeparatorChar)) {
    throw "Refusing to remove unexpected path: $LocalRoot"
  }

  if (Test-Path $LocalRoot) {
    Remove-Item -LiteralPath $LocalRoot -Recurse -Force
  }

  Write-Host "Removed local PostgreSQL files from $LocalRoot"
}

switch ($Action) {
  'setup' { Setup-LocalPostgres }
  'start' { Start-LocalPostgres }
  'stop' { Stop-LocalPostgres }
  'status' { Show-LocalPostgresStatus }
  'remove' { Remove-LocalPostgres }
}
