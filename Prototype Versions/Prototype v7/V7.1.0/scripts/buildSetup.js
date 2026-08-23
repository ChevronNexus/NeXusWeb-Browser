const fs = require('fs')
const path = require('path')
const { execSync } = require('child_process')
const AdmZip = require('adm-zip')

console.log('=================================================================')
console.log('   Chevron Nexus Software — NeXusWeb V7.1.0 Setup & Updater Builder   ')
console.log('=================================================================')

const rootDir = path.join(__dirname, '..')
const distElectronDir = path.join(rootDir, 'dist-electron')
const appDir = path.join(distElectronDir, 'NeXusWeb-V7-win32-x64')
const payloadZip = path.join(distElectronDir, 'app-payload.zip')
const setupExeOut = path.join(distElectronDir, 'NeXusWeb-Setup-v7.1.0.exe')
const setupExeAlias = path.join(distElectronDir, 'setup.exe')
const csSource = path.join(rootDir, 'scripts', 'SetupInstaller.cs')
const icoPath = path.join(rootDir, 'src', 'assets', 'app.ico')

// Ensure dist-electron directory exists
if (!fs.existsSync(distElectronDir)) {
  fs.mkdirSync(distElectronDir, { recursive: true })
}

try { execSync('taskkill /F /IM "setup.exe" /T 2>nul', { stdio: 'ignore' }) } catch (e) {}
try { execSync('taskkill /F /IM "NeXusWeb-Setup-v7.1.0.exe" /T 2>nul', { stdio: 'ignore' }) } catch (e) {}
try { execSync('taskkill /F /IM "NeXusWeb-Setup-v7.0.0.exe" /T 2>nul', { stdio: 'ignore' }) } catch (e) {}
try { execSync('taskkill /F /IM "NeXusWeb-V7.exe" /T 2>nul', { stdio: 'ignore' }) } catch (e) {}
try { execSync('taskkill /F /IM "electron.exe" /T 2>nul', { stdio: 'ignore' }) } catch (e) {}

const tempPackager = path.join(process.env.LOCALAPPDATA || '', 'Temp', 'electron-packager')
if (fs.existsSync(tempPackager)) {
  try { fs.rmSync(tempPackager, { recursive: true, force: true }) } catch (e) {}
}

// 1. Build Vite frontend
console.log('\n[1/5] Building Vite Frontend (React 18 + Design System)...')
execSync('npm run build:vite', { cwd: rootDir, stdio: 'inherit' })

// 2. Package Electron App
console.log('\n[2/5] Packaging NeXusWeb-V7 Standalone Binary (Electron 28.3.3 x64)...')
execSync('npx electron-packager . "NeXusWeb-V7" --platform=win32 --arch=x64 --icon="src/assets/app.ico" --electron-version=28.3.3 --out="dist-electron" --overwrite --asar --ignore="dist-electron|dist-linux|\\.git|\\.vite"', { cwd: rootDir, stdio: 'inherit' })

// 3. Compress Packaged App into Payload ZIP
console.log('\n[3/5] Compressing Binary Payload into app-payload.zip...')
if (fs.existsSync(payloadZip)) {
  fs.unlinkSync(payloadZip)
}

const zip = new AdmZip()
zip.addLocalFolder(appDir)
zip.writeZip(payloadZip)
const zipSizeMb = (fs.statSync(payloadZip).size / (1024 * 1024)).toFixed(2)
console.log(`[✓] Payload archive created: ${zipSizeMb} MB`)

// 4. Compile Standalone C# Setup & Upgrader Executable
console.log('\n[4/5] Compiling Standalone Windows Setup & Upgrader (NeXusWeb-Setup-v7.0.0.exe)...')
const logoDataScript = path.join(rootDir, 'scripts', 'generateLogoData.js')
execSync(`node "${logoDataScript}"`, { cwd: rootDir, stdio: 'inherit' })

const cscPath = 'C:\\Windows\\Microsoft.NET\\Framework64\\v4.0.30319\\csc.exe'
const logoDataCs = path.join(rootDir, 'scripts', 'LogoData.cs')
const appManifestPath = path.join(rootDir, 'scripts', 'app.manifest')

let cscCmd = `"${cscPath}" /target:winexe /optimize+ /platform:x64 /out:"${setupExeOut}"`
if (fs.existsSync(icoPath)) {
  cscCmd += ` /win32icon:"${icoPath}"`
}
if (fs.existsSync(appManifestPath)) {
  cscCmd += ` /win32manifest:"${appManifestPath}"`
}
cscCmd += ` /r:System.dll /r:System.Windows.Forms.dll /r:System.Drawing.dll /r:System.IO.Compression.dll /r:System.IO.Compression.FileSystem.dll /r:Microsoft.CSharp.dll`
cscCmd += ` /resource:"${payloadZip}",ChevronNexus.NeXusWeb.Setup.app-payload.zip`
cscCmd += ` "${logoDataCs}" "${csSource}"`

execSync(cscCmd, { cwd: rootDir, stdio: 'inherit' })

// Copy alias as setup.exe
fs.copyFileSync(setupExeOut, setupExeAlias)
const exeSizeMb = (fs.statSync(setupExeOut).size / (1024 * 1024)).toFixed(2)
console.log(`[✓] Native Windows Setup Binary Created: ${exeSizeMb} MB`)

// Digitally Sign all binaries with Authenticode Certificate
console.log('\n[*] Applying Authenticode Digital Signature (Chevron Nexus Software)...')
try {
  execSync('powershell -ExecutionPolicy Bypass -File scripts/signBinaries.ps1', { cwd: rootDir, stdio: 'inherit' })
} catch (e) {
  console.log('[!] Warning during signing:', e.message)
}

// 5. Generate Setup & Auto-Update Manifest
console.log('\n[5/5] Generating Setup & Delta Updater Manifest (setup-manifest.json)...')
const manifest = {
  appName: 'NeXusWeb',
  version: '7.1.0',
  releaseChannel: 'stable',
  publisher: 'Chevron Nexus Software',
  tagline: 'Privacy-First Personal Infrastructure',
  executable: 'NeXusWeb-V7.exe',
  setupFile: 'NeXusWeb-Setup-v7.1.0.exe',
  setupSizeMB: parseFloat(exeSizeMb),
  platform: 'win32',
  arch: 'x64',
  buildDate: new Date().toISOString(),
  updateEndpoint: 'https://updates.chevronnexus.com/nexusweb/latest.json',
  minimumOS: 'Windows 10 / Windows 11 (x64)',
  features: [
    'Dual-Purpose Setup: Clean Install & In-Place Upgrades with 100% Data Preservation',
    'Virtual Sandbox In-Memory RAM Browsing (Private Den)',
    'High-Speed Proxy & VPN Tunnel (Direct, NL, US, SG, UK, DE)',
    'DuckDuckGo Privacy Shield & WebRTC Leak Protection',
    'Integrated Multi-Terminal & Developer Suite',
    'Distraction-Free Reader Mode with 10 Typography Fonts',
    'Zero Telemetry & 100% Local-First Storage'
  ]
}

fs.writeFileSync(
  path.join(distElectronDir, 'setup-manifest.json'),
  JSON.stringify(manifest, null, 2),
  'utf8'
)

console.log('\n=================================================================')
console.log('   SUCCESS: NeXusWeb V7.1.0 Setup & Updater Built Successfully! ')
console.log('   Standalone Setup: dist-electron/NeXusWeb-Setup-v7.1.0.exe      ')
console.log('   Standard Alias:   dist-electron/setup.exe                      ')
console.log('   Unpacked App:     dist-electron/NeXusWeb-V7-win32-x64          ')
console.log('   Manifest:         dist-electron/setup-manifest.json            ')
console.log('=================================================================\n')
