Param(
  [Parameter(Position = 0)]
  [ValidateSet('deploy', 'status', 'logs', 'oneshot', 'push-env', 'init-ssh', 'help')]
  [string]$Command = 'help',

  [Parameter(Position = 1)]
  [string]$Target = 'loic@192.168.1.175',

  [string]$RepoPath = '/opt/naas/stacks/jarvis',

  [int]$Tail = 200,

  [int]$WaitSeconds = 30,

  [string]$EnvPath = ''
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

function Get-SshExe() {
  $sshExe = 'C:\Windows\System32\OpenSSH\ssh.exe'
  if (Test-Path $sshExe) { return $sshExe }
  $cmd = Get-Command ssh.exe -ErrorAction SilentlyContinue
  if ($null -ne $cmd) { return $cmd.Source }
  throw 'OpenSSH ssh.exe not found.'
}

function Invoke-Vm300([string]$RemoteBashCmd) {
  $sshExe = Get-SshExe
  $args = @(
    '-o', 'BatchMode=yes',
    '-o', 'StrictHostKeyChecking=accept-new',
    $Target,
    "tr -d '\r' | bash -s"
  )

  ($RemoteBashCmd + "`n") | & $sshExe @args
  if ($LASTEXITCODE -ne 0) {
    throw "SSH command failed (exit $LASTEXITCODE)."
  }
}

function Ensure-SshConfigAlias {
  $sshDir = Join-Path $HOME '.ssh'
  $configPath = Join-Path $sshDir 'config'
  New-Item -ItemType Directory -Force -Path $sshDir | Out-Null

  $aliasBlock = @(
    'Host vm300',
    '  HostName 192.168.1.175',
    '  User loic',
    '  IdentityFile ~/.ssh/id_ed25519',
    '  IdentitiesOnly yes',
    ''
  ) -join "`n"

  if (Test-Path $configPath) {
    $content = Get-Content $configPath -Raw
    if ($content -match '(?im)^Host\s+vm300\b') {
      Write-Host "OK: SSH alias 'vm300' already exists in $configPath"
      return
    }
    Add-Content -Path $configPath -Value ("`n" + $aliasBlock)
    Write-Host "Added SSH alias 'vm300' to $configPath"
    return
  }

  Set-Content -Path $configPath -Value $aliasBlock
  Write-Host "Created $configPath with SSH alias 'vm300'"
}

function Get-DefaultEnvPath {
  if ($EnvPath.Trim()) { return $EnvPath }
  # scripts/ -> jarvis/.env
  return (Join-Path $PSScriptRoot '..\.env')
}

function Print-Help {
  @'
VM300 remote control (SSH) for Jarvis.

Usage:
  ./scripts/vm300.ps1 help
  ./scripts/vm300.ps1 init-ssh
  ./scripts/vm300.ps1 push-env
  ./scripts/vm300.ps1 deploy
  ./scripts/vm300.ps1 oneshot
  ./scripts/vm300.ps1 status
  ./scripts/vm300.ps1 logs -Tail 200

Defaults:
  Target   = loic@192.168.1.175
  RepoPath = /opt/naas/stacks/jarvis
  EnvPath  = ./jarvis/.env (ignored by git)

Notes:
  - This script never prints your .env contents.
  - .env remains git-ignored on purpose (secrets).
'@ | Write-Host
}

switch ($Command) {
  'help' { Print-Help; break }

  'init-ssh' {
    Ensure-SshConfigAlias
    $sshExe = Get-SshExe
    & $sshExe -o BatchMode=yes -o PreferredAuthentications=publickey -o StrictHostKeyChecking=accept-new $Target 'echo OK_KEY_AUTH'
    if ($LASTEXITCODE -ne 0) { throw 'Key auth test failed.' }
    break
  }

  'push-env' {
    $localEnv = Get-DefaultEnvPath
    if (!(Test-Path $localEnv)) {
      throw "Env file not found: $localEnv (create it from .env.example)"
    }

    $content = Get-Content $localEnv -Raw
    if (!$content.Trim()) { throw "Env file is empty: $localEnv" }

    $sshExe = Get-SshExe
    $args = @(
      '-o', 'BatchMode=yes',
      '-o', 'StrictHostKeyChecking=accept-new',
      $Target,
      "umask 077; mkdir -p $RepoPath; cat > $RepoPath/.env"
    )

    $content | & $sshExe @args
    if ($LASTEXITCODE -ne 0) { throw "Failed to upload .env (exit $LASTEXITCODE)." }

    Write-Host "Uploaded .env to ${Target}:${RepoPath}/.env"
    break
  }

  'deploy' {
    $remote = @(
      'set -euo pipefail',
      'mkdir -p /opt/naas/stacks /opt/naas/appdata/jarvis-vm300',
      "if [ ! -d $RepoPath/.git ]; then git clone https://github.com/abatoretco-coder/jarvis.git $RepoPath; fi",
      "cd $RepoPath",
      'git fetch --all --prune',
      'git pull --ff-only',
      "test -f .env || (echo 'Missing .env (run push-env first)'; exit 2)",
      # Repair placeholder compose if present (older repo versions)
      "if grep -q '<user>' docker-compose.prod.yml 2>/dev/null; then cat > docker-compose.prod.yml <<'YAML'\nservices:\n  jarvis:\n    build:\n      context: .\n    ports:\n      - '8080:8080'\n    env_file:\n      - .env\n    volumes:\n      - /opt/naas/appdata/jarvis-vm300:/app/data\n    restart: unless-stopped\nYAML\nfi",
      'docker compose -f docker-compose.prod.yml up -d --build'
    ) -join "`n"

    Invoke-Vm300 $remote
    break
  }

  'oneshot' {
    $remote = @(
      'set -euo pipefail',
      "cd $RepoPath",
      'docker compose -f docker-compose.prod.yml up -d --build',
      'end=$((SECONDS+' + $WaitSeconds + '))',
      'code=0',
      'while [ $SECONDS -lt $end ]; do',
      '  code=$(wget -qO- http://127.0.0.1:8080/health 2>/dev/null | head -c 20 | wc -c | tr -d " ") || true',
      '  if [ "$code" -gt 0 ]; then echo OK; exit 0; fi',
      '  sleep 2',
      'done',
      'echo FAIL; docker compose -f docker-compose.prod.yml ps || true; exit 1'
    ) -join "`n"

    Invoke-Vm300 $remote
    break
  }

  'status' {
    $remote = @(
      'set -euo pipefail',
      "cd $RepoPath",
      'echo "== GIT =="',
      'git log -1 --oneline || true',
      'echo "== COMPOSE PS =="',
      'docker compose -f docker-compose.prod.yml ps || true',
      'echo "== HEALTH =="',
      'wget -qO- http://127.0.0.1:8080/health | head -c 400 || true',
      'echo'
    ) -join "`n"

    Invoke-Vm300 $remote
    break
  }

  'logs' {
    $remote = @(
      'set -euo pipefail',
      "cd $RepoPath",
      "docker compose -f docker-compose.prod.yml logs --tail=$Tail"
    ) -join "`n"

    Invoke-Vm300 $remote
    break
  }
}
