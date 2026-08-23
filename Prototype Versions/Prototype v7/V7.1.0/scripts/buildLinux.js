const fs = require('fs')
const path = require('path')
const { execSync } = require('child_process')
const AdmZip = require('adm-zip')

console.log('=================================================================')
console.log('   Chevron Nexus Software — NeXusWeb Linux Package Builder       ')
console.log('=================================================================')

const rootDir = path.join(__dirname, '..')
const distLinuxDir = path.join(rootDir, 'dist-linux')
const appLinuxDir = path.join(distLinuxDir, 'NeXusWeb-linux-x64')
const desktopFile = path.join(rootDir, 'nexusweb.desktop')
const installSh = path.join(rootDir, 'scripts', 'install-linux.sh')

// 1. Ensure dist-linux directory exists
if (!fs.existsSync(distLinuxDir)) {
  fs.mkdirSync(distLinuxDir, { recursive: true })
}

// 2. Build Vite Frontend
console.log('\n[1/4] Building Vite Frontend (React 18 + Design System)...')
execSync('npm run build:vite', { cwd: rootDir, stdio: 'inherit' })

// 3. Package Electron for Linux x64
console.log('\n[2/4] Packaging NeXusWeb for Linux x64 (Electron 28.3.3)...')
const packCmd = 'npx electron-packager . "NeXusWeb" --platform=linux --arch=x64 --icon="src/assets/logo.png" --electron-version=28.3.3 --out="dist-linux" --overwrite --asar --ignore="dist-electron|dist-linux|\\.git|\\.vite"'
execSync(packCmd, { cwd: rootDir, stdio: 'inherit' })

// 4. Copy Desktop Entry & Installer Scripts
console.log('\n[3/4] Copying Linux desktop integration & launcher scripts...')
if (fs.existsSync(desktopFile) && fs.existsSync(appLinuxDir)) {
  fs.copyFileSync(desktopFile, path.join(appLinuxDir, 'nexusweb.desktop'))
}
if (fs.existsSync(installSh) && fs.existsSync(appLinuxDir)) {
  fs.copyFileSync(installSh, path.join(appLinuxDir, 'install.sh'))
}

// Write standalone runner script
const runnerScript = `#!/usr/bin/env bash
SCRIPT_DIR="$(cd "$(dirname "\${BASH_SOURCE[0]}")" && pwd)"
export ELECTRON_DISABLE_SECURITY_WARNINGS=true
exec "$SCRIPT_DIR/NeXusWeb" "$@"
`
if (fs.existsSync(appLinuxDir)) {
  fs.writeFileSync(path.join(appLinuxDir, 'nexusweb.sh'), runnerScript, { encoding: 'utf8', mode: 0o755 })
}

// 5. Create Standalone Linux Archive (.zip)
console.log('\n[4/4] Generating Standalone Linux Distribution Archive...')
const zipOut = path.join(distLinuxDir, 'NeXusWeb-v7.1.0-linux-x64.zip')
if (fs.existsSync(zipOut)) {
  fs.unlinkSync(zipOut)
}
const zip = new AdmZip()
zip.addLocalFolder(appLinuxDir)
zip.writeZip(zipOut)
const zipSizeMb = (fs.statSync(zipOut).size / (1024 * 1024)).toFixed(2)

// Write Manifest
const manifest = {
  appName: 'NeXusWeb',
  version: '7.1.0',
  platform: 'linux',
  arch: 'x64',
  executable: 'NeXusWeb',
  packageArchive: 'NeXusWeb-v7.1.0-linux-x64.zip',
  archiveSizeMB: parseFloat(zipSizeMb),
  buildDate: new Date().toISOString(),
  supportedDistros: [
    'Ubuntu 20.04+ / 22.04+ / 24.04+',
    'Debian 11+ / 12+',
    'Fedora 36+',
    'Arch Linux / Manjaro',
    'openSUSE Leap & Tumbleweed',
    'Linux Mint / Pop!_OS'
  ]
}
fs.writeFileSync(path.join(distLinuxDir, 'linux-manifest.json'), JSON.stringify(manifest, null, 2), 'utf8')

console.log('\n=================================================================')
console.log('   SUCCESS: NeXusWeb v7.1.0 for Linux Built Successfully!        ')
console.log(`   Standalone App:     dist-linux/NeXusWeb-linux-x64/             `)
console.log(`   Distribution ZIP:   dist-linux/NeXusWeb-v7.1.0-linux-x64.zip (${zipSizeMb} MB) `)
console.log(`   Desktop Launcher:   dist-linux/NeXusWeb-linux-x64/nexusweb.desktop `)
console.log(`   Installer Script:   dist-linux/NeXusWeb-linux-x64/install.sh   `)
console.log('=================================================================\n')
