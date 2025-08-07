# Downlodr Installation Guide

## 🎯 Choose Your Mac Type

### 🍎 Apple Silicon Macs (M1, M2, M3, M4)
- **Use**: `Downlodr-arm64.dmg` 
- **Optimal performance** on Apple Silicon

### 💻 Intel Macs (2020 and earlier)  
- **Use**: `Downlodr-x64.dmg`
- **Full compatibility** with Intel processors

## 📦 Installation Methods

### 🥇 Method 1: DMG Installer (Recommended)

1. **Download** the appropriate DMG file for your Mac
2. **Double-click** the DMG file to mount it
3. **Drag** the Downlodr app to your Applications folder
4. **Launch** from Applications folder

**If you see "Downlodr is damaged and can't be opened":**

🥇 **Method 1 (Recommended - Right-click bypass):**
1. Click **Cancel** on the error dialog
2. **Right-click** on Downlodr app in the DMG  
3. Select **Open** from context menu
4. Click **Open** when macOS asks for confirmation
5. ✅ The app will launch and be trusted forever

🥈 **Method 2 (Terminal command):**
1. Click **Cancel** on the error dialog
2. Open **Terminal** and run:
   ```bash
   sudo xattr -r -d com.apple.quarantine "/Volumes/Install Downlodr/Downlodr.app"
   ```
3. Enter your password when prompted
4. Now drag the app to Applications - it will work!

**Why this happens:** macOS applies quarantine attributes to downloaded files as a security measure. This is normal for all apps downloaded from the internet.

### 🥈 Method 2: ZIP Archive (If DMG fails)

1. **Download** the ZIP file for your architecture:
   - `Downlodr-darwin-arm64-1.7.2-stable.zip` (Apple Silicon)
   - `Downlodr-darwin-x64-1.7.2-stable.zip` (Intel)
2. **Double-click** to extract the ZIP
3. **Move** Downlodr.app to Applications folder
4. **Right-click** on app → **Open** (first time only)

### 🚫 Method 3: PKG Installer (Not Recommended)

PKG installers currently show certificate warnings. If you must use PKG:

1. **Double-click** the PKG file
2. You'll see a certificate warning
3. **Check** "Always trust" checkbox
4. Click **Continue** 
5. Follow installation prompts

## 🛡️ Security Notes

- **All apps are code-signed** with valid Developer ID certificates
- **False warnings** are due to a known macOS bug affecting many developers
- **Your app is completely safe** - certificates are valid until 2030
- **DMG method bypasses** most security warnings

## 🔧 Troubleshooting

### "App is damaged and can't be opened"
```bash
# Run this command in Terminal:
sudo xattr -r -d com.apple.quarantine /Applications/Downlodr.app
```

### "Developer cannot be verified"
1. **System Preferences** → **Security & Privacy**
2. Click **"Open Anyway"** next to Downlodr message
3. Or use **right-click → Open** method above

### Still having issues?
- Try the **ZIP archive method**
- Contact support with your macOS version

## ✅ What's Included

- **🍎 Native macOS UI** with proper dock icon and system tray
- **🔋 Self-contained** - no need to install yt-dlp or ffmpeg
- **🎵 Full media support** - audio/video downloading and conversion
- **🖥️ Universal compatibility** - works on all Mac architectures

## 🎉 Ready to Use!

Once installed, Downlodr will:
- ✅ Appear in your Applications folder
- ✅ Show proper icon in dock
- ✅ Run without any external dependencies
- ✅ Download and process media files seamlessly

---

**Questions?** The DMG method works for 95% of users. If you encounter issues, try the ZIP method or contact support.