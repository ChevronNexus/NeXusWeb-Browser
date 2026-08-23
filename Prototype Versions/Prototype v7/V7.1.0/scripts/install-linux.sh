#!/usr/bin/env bash
# =================================================================
#   Chevron Nexus Software — NeXusWeb Linux Installer
# =================================================================
set -e

APP_NAME="NeXusWeb"
INSTALL_DIR="$HOME/.local/share/nexusweb"
BIN_DIR="$HOME/.local/bin"
DESKTOP_DIR="$HOME/.local/share/applications"
ICON_DIR="$HOME/.local/share/icons/hicolor/512x512/apps"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PACKAGE_DIR="$(dirname "$SCRIPT_DIR")/dist-linux/NeXusWeb-linux-x64"

echo "================================================================="
echo "   Installing NeXusWeb v7.0.0 (Chevron Nexus Software)           "
echo "================================================================="

# Check source directory
if [ ! -d "$PACKAGE_DIR" ]; then
    echo "[!] Error: Packaged binary directory not found at $PACKAGE_DIR"
    echo "[*] Please run 'npm run build:linux' first."
    exit 1
fi

# 1. Create directories
mkdir -p "$INSTALL_DIR"
mkdir -p "$BIN_DIR"
mkdir -p "$DESKTOP_DIR"
mkdir -p "$ICON_DIR"

# 2. Copy binaries
echo "[1/4] Copying NeXusWeb binaries to $INSTALL_DIR..."
cp -r "$PACKAGE_DIR"/* "$INSTALL_DIR/"
chmod +x "$INSTALL_DIR/NeXusWeb" || chmod +x "$INSTALL_DIR/nexusweb" || true

# 3. Create CLI symlink
echo "[2/4] Linking CLI executable into $BIN_DIR/nexusweb..."
EXE_NAME="NeXusWeb"
if [ -f "$INSTALL_DIR/nexusweb" ]; then
    EXE_NAME="nexusweb"
fi

cat << EOF > "$BIN_DIR/nexusweb"
#!/usr/bin/env bash
exec "$INSTALL_DIR/$EXE_NAME" "\$@"
EOF
chmod +x "$BIN_DIR/nexusweb"

# 4. Copy Icon
echo "[3/4] Installing application icon..."
if [ -f "$INSTALL_DIR/resources/app/src/assets/logo.png" ]; then
    cp "$INSTALL_DIR/resources/app/src/assets/logo.png" "$ICON_DIR/nexusweb.png"
elif [ -f "$(dirname "$SCRIPT_DIR")/src/assets/logo.png" ]; then
    cp "$(dirname "$SCRIPT_DIR")/src/assets/logo.png" "$ICON_DIR/nexusweb.png"
fi

# 5. Install Desktop entry
echo "[4/4] Registering Linux Desktop Entry ($DESKTOP_DIR/nexusweb.desktop)..."
cat << EOF > "$DESKTOP_DIR/nexusweb.desktop"
[Desktop Entry]
Version=1.0
Name=NeXusWeb
GenericName=Privacy & Developer Web Browser
Comment=Privacy-First Personal Infrastructure & Developer Workstation Browser
Exec=$INSTALL_DIR/$EXE_NAME %U
Icon=nexusweb
Terminal=false
Type=Application
Categories=Network;WebBrowser;Development;Security;
MimeType=text/html;text/xml;application/xhtml+xml;application/xml;x-scheme-handler/http;x-scheme-handler/https;
StartupWMClass=nexusweb
Keywords=browser;developer;privacy;vpn;terminal;localhost;
Actions=NewWindow;NewPrivateDen;

[Desktop Action NewWindow]
Name=New Window
Exec=$INSTALL_DIR/$EXE_NAME --new-window

[Desktop Action NewPrivateDen]
Name=New Private Den (RAM Sandbox)
Exec=$INSTALL_DIR/$EXE_NAME --private-den
EOF
chmod +x "$DESKTOP_DIR/nexusweb.desktop"

# Refresh desktop database if available
if command -v update-desktop-database >/dev/null 2>&1; then
    update-desktop-database "$DESKTOP_DIR" 2>/dev/null || true
fi

echo "================================================================="
echo "   [✓] NeXusWeb v7.0.0 installed successfully on Linux!          "
echo "   Run from terminal:  nexusweb                                  "
echo "   Launch from menu:   Applications > Internet > NeXusWeb        "
echo "================================================================="
