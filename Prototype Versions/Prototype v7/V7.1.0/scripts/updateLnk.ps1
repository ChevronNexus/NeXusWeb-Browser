
$w = New-Object -ComObject WScript.Shell
$s = $w.CreateShortcut("C:\\Users\\MrRAY\\Desktop\\NeXusWeb V6.lnk")
$s.IconLocation = "F:\\NeXusWeb\\prototype V6\\src\\assets\\app.ico,0"
$s.Save()
Write-Host "Desktop shortcut icon successfully updated to custom NeXusWeb logo!"
