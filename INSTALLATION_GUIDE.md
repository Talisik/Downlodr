# Downlodr macOS Installation Guide

## Quick Installation

1. **Download** the appropriate installer for your Mac:
   - **Apple Silicon (M1/M2/M3/M4)**: `Downlodr-arm64.dmg`
   - **Intel Macs**: `Downlodr-x64.dmg`

2. **Install** the application:
   - Open the `.dmg` file
   - Drag Downlodr to Applications folder

3. **First Launch**:
   - Right-click on Downlodr in Applications
   - Select "Open" from context menu
   - Click "Open" in the security dialog

## If you see "Downlodr is damaged and can't be opened"

This is a normal macOS security feature for downloaded apps. Here are three ways to fix it:

### Method 1: Right-Click Open (Easiest)
1. Right-click on Downlodr.app in Applications
2. Select "Open" from the menu
3. Click "Open" in the security dialog
4. Downlodr will launch and be trusted for future launches

### Method 2: Terminal Command (Quick)
1. Open Terminal (Applications > Utilities > Terminal)
2. Run this command:
```bash
sudo xattr -r -d com.apple.quarantine /Applications/Downlodr.app
```
3. Enter your password when prompted
4. Launch Downlodr normally

### Method 3: Use Our Script (Automated)
1. Download `remove_quarantine.sh` 
2. Open Terminal in the download folder
3. Run:
```bash
chmod +x remove_quarantine.sh
./remove_quarantine.sh
```

## System Requirements

- **macOS 10.15** (Catalina) or later
- **Apple Silicon** or **Intel** processor
- **100MB** free disk space

## Troubleshooting

### "App is damaged" persists
- Try Method 2 (Terminal command) even after right-click open
- Ensure you downloaded from official source
- Re-download if file might be corrupted

### Permission denied errors
- Ensure you have administrator privileges
- Try running terminal commands with `sudo`

---

**Note**: The "damaged" message is a normal macOS security feature for apps downloaded from the internet. It's not actually damaged - just needs to be explicitly trusted by the user.
