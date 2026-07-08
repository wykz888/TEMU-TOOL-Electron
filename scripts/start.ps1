$ErrorActionPreference = 'Stop'

$projectRoot = Split-Path -Parent $PSScriptRoot
$electronPath = Join-Path $projectRoot 'node_modules\electron\dist\electron.exe'
$pidFilePath = Join-Path $PSScriptRoot '.electron-dev.pid'

function Read-TrackedPid {
  if (-not (Test-Path -LiteralPath $pidFilePath)) {
    return 0
  }

  try {
    $rawValue = (Get-Content -LiteralPath $pidFilePath -Raw).Trim()
    $trackedProcessId = [int]$rawValue
    if ($trackedProcessId -gt 0) {
      return $trackedProcessId
    }
  } catch {}

  return 0
}

function Remove-PidFile {
  try {
    Remove-Item -LiteralPath $pidFilePath -Force -ErrorAction SilentlyContinue
  } catch {}
}

function Stop-TrackedProcess([int]$trackedProcessId) {
  if ($trackedProcessId -le 0) {
    return
  }

  try {
    Stop-Process -Id $trackedProcessId -Force -ErrorAction SilentlyContinue
  } catch {}
}

function Try-ActivateProcessWindow([int]$targetProcessId) {
  if ($targetProcessId -le 0) {
    return $false
  }

  try {
    $shell = New-Object -ComObject WScript.Shell
  } catch {
    return $false
  }

  for ($attempt = 0; $attempt -lt 12; $attempt += 1) {
    Start-Sleep -Milliseconds 350

    try {
      if ($shell.AppActivate($targetProcessId)) {
        return $true
      }
    } catch {}
  }

  return $false
}

if (-not (Test-Path -LiteralPath $electronPath)) {
  throw "Electron binary not found: $electronPath"
}

$trackedPid = Read-TrackedPid
if ($trackedPid -gt 0) {
  Stop-TrackedProcess $trackedPid
  Remove-PidFile
}

Get-CimInstance Win32_Process |
  Where-Object { $_.Name -eq 'electron.exe' -and $_.ExecutablePath -eq $electronPath } |
  ForEach-Object {
    Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue
  }

[Environment]::SetEnvironmentVariable('ELECTRON_RUN_AS_NODE', $null, 'Process')

Write-Output 'Starting Electron app...'
$process = Start-Process -FilePath $electronPath -ArgumentList '.' -WorkingDirectory $projectRoot -PassThru

Set-Content -LiteralPath $pidFilePath -Value $process.Id -NoNewline -Encoding utf8

Start-Sleep -Milliseconds 900

$startedProcess = Get-Process -Id $process.Id -ErrorAction SilentlyContinue
if (-not $startedProcess) {
  Remove-PidFile
  throw 'Electron exited before startup completed.'
}

$activated = Try-ActivateProcessWindow $process.Id

if ($activated) {
  Write-Output "Electron started (PID $($process.Id)) and the app window was brought to the front."
} else {
  Write-Output "Electron started (PID $($process.Id)). If the window is not visible yet, check the taskbar for TEMU TOOLBOX or the login window."
}
