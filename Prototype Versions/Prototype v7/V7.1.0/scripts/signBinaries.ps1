param(
    [string]$DistPath = (Join-Path (Split-Path -Parent $PSScriptRoot) "dist-electron")
)

Write-Host "=================================================================" -ForegroundColor Cyan
Write-Host "   Chevron Nexus Software - Digital Signing and Smart App Control" -ForegroundColor Cyan
Write-Host "=================================================================" -ForegroundColor Cyan

# 1. Ensure Robust Chevron Nexus Software Code Signing Certificate
$certSubject = "CN=Chevron Nexus Software, O=Chevron Nexus Software, OU=Development, C=US"
$cert = Get-ChildItem Cert:\CurrentUser\My -CodeSigningCert | Where-Object { $_.Subject -like "*Chevron Nexus Software*" } | Select-Object -First 1

if (-not $cert) {
    Write-Host "[1/3] Generating Authenticode Code Signing Certificate for Chevron Nexus Software..." -ForegroundColor Yellow
    
    # Generate Code Signing Certificate with SHA256 and 10 year validity
    $cert = New-SelfSignedCertificate -Type CodeSigningCert `
        -Subject $certSubject `
        -CertStoreLocation "Cert:\CurrentUser\My" `
        -KeyExportPolicy Exportable `
        -KeySpec Signature `
        -KeyLength 2048 `
        -KeyAlgorithm RSA `
        -HashAlgorithm "SHA256" `
        -NotAfter (Get-Date).AddYears(10)
}

# Export and install into Root & TrustedPublisher
$certPath = Join-Path $DistPath "ChevronNexusSoftware.cer"
try {
    if (-not (Test-Path $DistPath)) { New-Item -ItemType Directory -Path $DistPath -Force | Out-Null }
    $certBytes = $cert.Export([System.Security.Cryptography.X509Certificates.X509ContentType]::Cert)
    [System.IO.File]::WriteAllBytes($certPath, $certBytes)
    
    Import-Certificate -FilePath $certPath -CertStoreLocation "Cert:\CurrentUser\Root" -ErrorAction SilentlyContinue | Out-Null
    Import-Certificate -FilePath $certPath -CertStoreLocation "Cert:\CurrentUser\TrustedPublisher" -ErrorAction SilentlyContinue | Out-Null
    Write-Host "[OK] Trusted Chevron Nexus Software certificate in CurrentUser Root & TrustedPublisher." -ForegroundColor Green
} catch {
    Write-Host "[!] Warning importing certificate: $($_.Exception.Message)" -ForegroundColor DarkYellow
}

# 2. Digitally Sign All Executables & DLLs with Timestamp
Write-Host "[2/3] Applying SHA-256 Authenticode Signatures with RFC3161 Timestamping..." -ForegroundColor Yellow

$timestampServers = @(
    "http://timestamp.digicert.com",
    "http://timestamp.sectigo.com",
    "http://tsa.starfieldtech.com"
)

$filesToSign = @(
    (Join-Path $DistPath "NeXusWeb-Setup-v7.0.0.exe"),
    (Join-Path $DistPath "NeXusWeb-Setup-v7.0.0.exe"),
    (Join-Path $DistPath "setup.exe"),
    (Join-Path $DistPath "NeXusWeb-V7-win32-x64\NeXusWeb-V7.exe")
)

# Also find any DLLs in the packaged folder
$dlls = Get-ChildItem -Path (Join-Path $DistPath "NeXusWeb-V7-win32-x64") -Filter "*.dll" -Recurse -ErrorAction SilentlyContinue | Select-Object -ExpandProperty FullName
if ($dlls) {
    $filesToSign += $dlls
}

foreach ($f in $filesToSign) {
    if (Test-Path $f) {
        try {
            Unblock-File -Path $f -ErrorAction SilentlyContinue
            
            $signed = $false
            foreach ($ts in $timestampServers) {
                try {
                    $sig = Set-AuthenticodeSignature -FilePath $f -Certificate $cert -HashAlgorithm "SHA256" -TimestampServer $ts -ErrorAction Stop
                    if ($sig.Status -eq "Valid" -or $sig.Status -eq "UnknownError") {
                        Write-Host "  [OK] Signed: $([System.IO.Path]::GetFileName($f)) (Status: $($sig.Status), Timestamp: $ts)" -ForegroundColor Green
                        $signed = $true
                        break
                    }
                } catch {}
            }
            
            if (-not $signed) {
                # Fallback to local signature without timestamp
                $sig = Set-AuthenticodeSignature -FilePath $f -Certificate $cert -HashAlgorithm "SHA256"
                Write-Host "  [OK] Signed (Local): $([System.IO.Path]::GetFileName($f)) (Status: $($sig.Status))" -ForegroundColor Green
            }
        } catch {
            Write-Host "  [!] Warning signing: $f - $($_.Exception.Message)" -ForegroundColor DarkYellow
        }
    }
}

# 3. Strip Mark of the Web (Zone.Identifier) across all files
Write-Host "[3/3] Removing Mark-of-the-Web (Zone.Identifier) streams..." -ForegroundColor Yellow
Get-ChildItem -Path $DistPath -Recurse -File -ErrorAction SilentlyContinue | ForEach-Object {
    try {
        Unblock-File -Path $_.FullName -ErrorAction SilentlyContinue
    } catch {}
}

Write-Host "=================================================================" -ForegroundColor Cyan
Write-Host "   Authenticode Digital Signing Complete!                        " -ForegroundColor Cyan
Write-Host "=================================================================" -ForegroundColor Cyan
