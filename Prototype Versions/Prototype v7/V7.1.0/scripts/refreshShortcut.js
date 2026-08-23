const { execSync } = require('child_process')
const path = require('path')
const fs = require('fs')

const desktop = path.join(process.env.USERPROFILE || 'C:\\Users\\MrRAY', 'Desktop')
const lnkPath = path.join(desktop, 'NeXusWeb V6.lnk')
const icoPath = path.join(__dirname, '..', 'src', 'assets', 'app.ico')

console.log('Desktop path:', desktop)
console.log('Shortcut exists:', fs.existsSync(lnkPath))

const psScript = `
$w = New-Object -ComObject WScript.Shell
$s = $w.CreateShortcut("${lnkPath.replace(/\\/g, '\\\\')}")
$s.IconLocation = "${icoPath.replace(/\\/g, '\\\\')},0"
$s.Save()
Write-Host "Desktop shortcut icon successfully updated to custom NeXusWeb logo!"
`

fs.writeFileSync(path.join(__dirname, 'updateLnk.ps1'), psScript, 'utf8')
try {
  execSync('powershell -ExecutionPolicy Bypass -File scripts/updateLnk.ps1', { cwd: path.join(__dirname, '..'), stdio: 'inherit' })
} catch (e) {
  console.log('Error updating lnk:', e.message)
}
