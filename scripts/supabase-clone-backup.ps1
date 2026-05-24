param(
  [string]$ProjectRef = "athhdmvhtfgnohwngqfv",
  [string]$BackupName = ""
)

$ErrorActionPreference = "Stop"

$RepoRoot = Split-Path -Parent $PSScriptRoot
$SupabaseExe = Join-Path $RepoRoot "supabase.exe"

if (-not (Test-Path $SupabaseExe)) {
  throw "supabase.exe was not found at $SupabaseExe"
}

if ([string]::IsNullOrWhiteSpace($BackupName)) {
  $BackupName = Get-Date -Format "yyyyMMdd-HHmmss"
}

$BackupDir = Join-Path $RepoRoot "supabase\backups\$BackupName"
New-Item -ItemType Directory -Force -Path $BackupDir | Out-Null

Write-Host "This will create a Supabase database backup in:"
Write-Host "  $BackupDir"
Write-Host ""
Write-Host "You need:"
Write-Host "  1. A Supabase personal access token"
Write-Host "  2. The database password for project $ProjectRef"
Write-Host ""

$AccessToken = Read-Host "Supabase access token"
$DbPassword = Read-Host "Database password"

Push-Location $RepoRoot
try {
  & $SupabaseExe login --token $AccessToken
  & $SupabaseExe link --project-ref $ProjectRef --password $DbPassword

  & $SupabaseExe db dump --linked --password $DbPassword --file (Join-Path $BackupDir "roles.sql") --role-only
  & $SupabaseExe db dump --linked --password $DbPassword --file (Join-Path $BackupDir "schema.sql")
  & $SupabaseExe db dump --linked --password $DbPassword --file (Join-Path $BackupDir "data.sql") --use-copy --data-only -x "storage.buckets_vectors" -x "storage.vector_indexes"

  Write-Host ""
  Write-Host "Backup complete:"
  Write-Host "  roles.sql"
  Write-Host "  schema.sql"
  Write-Host "  data.sql"
}
finally {
  Pop-Location
}
