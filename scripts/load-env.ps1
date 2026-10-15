# Loads .env into the CURRENT PowerShell session so plain `terraform` commands
# work (e.g. during the viva demo).
#
# Run from the project root (note the leading dot and space):
#   . .\scripts\load-env.ps1
#   cd terraform\environments\dev
#   terraform plan
#
# If PowerShell refuses to run scripts, first run:
#   Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass

$envFile = Join-Path (Get-Location) ".env"
if (-not (Test-Path $envFile)) {
    Write-Host "No .env in $(Get-Location). Run this from the project root, after: node scripts/doctor.mjs --init-env"
    return
}

foreach ($raw in Get-Content $envFile) {
    $line = $raw.Trim()
    if ($line -eq "" -or $line.StartsWith("#") -or -not $line.Contains("=")) { continue }
    $name, $value = $line -split "=", 2
    $value = $value.Trim()
    if ($value.Length -ge 2 -and (($value.StartsWith('"') -and $value.EndsWith('"')) -or ($value.StartsWith("'") -and $value.EndsWith("'")))) {
        $value = $value.Substring(1, $value.Length - 2)
    }
    Set-Item -Path "Env:$($name.Trim())" -Value $value
}

$env:TF_TOKEN_app_terraform_io = $env:TF_API_TOKEN
$env:TF_VAR_account_id = $env:CLOUDFLARE_ACCOUNT_ID
$env:TF_VAR_workers_subdomain = $env:WORKERS_SUBDOMAIN
$env:TF_VAR_curator_api_key = $env:CURATOR_API_KEY

Write-Host "Loaded .env into this session (values hidden). Terraform credentials and TF_VAR_* are set."
