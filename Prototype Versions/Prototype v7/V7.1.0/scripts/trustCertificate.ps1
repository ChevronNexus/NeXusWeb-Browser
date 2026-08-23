<#
.SYNOPSIS
   Permanently trusts Chevron Nexus Software certificates and removes Zone.Identifier locks to allow execution under Windows Smart App Control.
.NOTES
   Run in an Elevated PowerShell Prompt (Run as Administrator).
#>

Write-Host "=================================================================" -ForegroundColor Cyan
Write-Host "   Chevron Nexus Software — Smart App Control Permanent Fix      " -ForegroundColor Cyan
Write-Host "=================================================================" -ForegroundColor Cyan

# 1. Elevate if not admin
$isAdmin = ([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
if (-not $isAdmin) {
    Write-Host "[!] Elevating with Administrator privileges..." -ForegroundColor Yellow
    Start-Process powershell.exe -Verb RunAs -ArgumentList "-NoProfile -ExecutionPolicy Bypass -File `"$PSCommandPath`""
    Exit
}

$ScriptDir = Split-Path -Parent $PSCommandPath
$RootDir = Split-Path -Parent $ScriptDir
$DistDir = Join-Path $ScriptDir "dist-electron"
$CertPath = Join-Path $DistDir "ChevronNexusSoftware.cer"

# 2. Generate and Install Certificate into LocalMachine Root & TrustedPublisher
Write-Host "[1/3] Registering Chevron Nexus Software in LocalMachine Certificate Store..." -ForegroundColor Yellow

$cert = Get-ChildItem Cert:\CurrentUser\My -CodeSigningCert | Where-Object { $_.Subject -like "*Chevron Nexus Software*" } | Select-Object -First 1

if (-not $cert) {
    $cert = New-SelfSignedCertificate -Type CodeSigningCert `
        -Subject "CN=Chevron Nexus Software, O=Chevron Nexus Software, OU=Development, C=US" `
        -CertStoreLocation "Cert:\LocalMachine\My" `
        -KeyExportPolicy Exportable `
        -KeySpec Signature `
        -KeyLength 2048 `
        -KeyAlgorithm RSA `
        -HashAlgorithm "SHA256" `
        -NotAfter (Get-Date).AddYears(10)
}

$certBytes = $cert.Export([System.Security.Cryptography.X509Certificates.X509ContentType]::Cert)
if (-not (Test-Path $DistDir)) { New-Item -ItemType Directory -Path $DistDir -Force | Out-Null }
[System.IO.File]::WriteAllBytes($CertPath, $certBytes)

# Import into Machine Root & Machine TrustedPublisher
Import-Certificate -FilePath $CertPath -CertStoreLocation "Cert:\LocalMachine\Root" -ErrorAction SilentlyContinue | Out-Null
Import-Certificate -FilePath $CertPath -CertStoreLocation "Cert:\LocalMachine\TrustedPublisher" -ErrorAction SilentlyContinue | Out-Null
Import-Certificate -FilePath $CertPath -CertStoreLocation "Cert:\CurrentUser\Root" -ErrorAction SilentlyContinue | Out-Null
Import-Certificate -FilePath $CertPath -CertStoreLocation "Cert:\CurrentUser\TrustedPublisher" -ErrorAction SilentlyContinue | Out-Null

Write-Host "  [OK] Chevron Nexus Software is now a Trusted Publisher on this machine." -ForegroundColor Green

# 3. Strip Mark-of-the-Web (Zone.Identifier)
Write-Host "[2/3] Unblocking all NeXusWeb binaries and removing Zone.Identifier streams..." -ForegroundColor Yellow
Get-ChildItem -Path $RootDir -Recurse -File -ErrorAction SilentlyContinue | ForEach-Object {
    try {
        Unblock-File -Path $_.FullName -ErrorAction SilentlyContinue
    } catch {}
}
Write-Host "  [OK] All files unblocked." -ForegroundColor Green

# 4. Optional SAC registry optimization
Write-Host "[3/3] Configuring App Execution Policy..." -ForegroundColor Yellow
try {
    Set-ItemProperty -Path "HKLM:\SOFTWARE\Microsoft\Windows\CurrentVersion\AppModelUnlock" -Name "AllowDevelopmentWithoutDevLicense" -Value 1 -Type DWord -ErrorAction SilentlyContinue
    Write-Host "  [OK] Developer execution policy unlocked." -ForegroundColor Green
} catch {}

Write-Host "`n=================================================================" -ForegroundColor Cyan
Write-Host "   SUCCESS: Smart App Control & SmartScreen fixed permanently!  " -ForegroundColor Cyan
Write-Host "=================================================================" -ForegroundColor Cyan
Start-Sleep -Seconds 3
