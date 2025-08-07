# 🚨 Downlodr Installation Quick Fix

## For Users Getting "Downlodr is damaged and can't be opened"

This is a **normal macOS security feature** for downloaded apps. Here are **3 easy solutions**:

---

## 🥇 Solution 1: Right-Click Method (Easiest)

1. **Click "Cancel"** on the error dialog
2. **Right-click** on `Downlodr.app` in the DMG
3. **Select "Open"** from the context menu  
4. **Click "Open"** when macOS asks for confirmation
5. ✅ **Done!** Downlodr will launch and be trusted forever

---

## 🥈 Solution 2: Terminal Command (Advanced Users)

1. **Click "Cancel"** on the error dialog
2. **Open Terminal** and paste this command:
   ```bash
   sudo xattr -r -d com.apple.quarantine "/Volumes/Install Downlodr/Downlodr.app"
   ```
3. **Enter your password** when prompted
4. ✅ **Done!** Now drag the app to Applications

---

## 🥉 Solution 3: Use Our Script (Download Available)

1. **Download** `remove_quarantine.sh` from our releases
2. **Open Terminal** in your Downloads folder
3. **Run**: `chmod +x remove_quarantine.sh && ./remove_quarantine.sh`
4. **Follow the prompts**
5. ✅ **Done!** Script handles everything automatically

---

## 🤔 Why Does This Happen?

- **This is NORMAL** - macOS adds "quarantine attributes" to all downloaded apps
- **Your security isn't at risk** - this happens to every app downloaded from the internet
- **It's not a bug** - it's Apple's way of making sure you trust the app before running it
- **Even legitimate, signed apps** can trigger this on some macOS versions

---

## 📱 Architecture Guide

- **M1/M2/M3/M4 Macs**: Use `Downlodr-arm64.dmg`
- **Intel Macs**: Use `Downlodr-x64.dmg` (when available)

---

## 🆘 Still Having Issues?

1. Try the **ZIP version** instead of DMG (no mounting required)
2. Make sure you're using the **correct architecture** for your Mac
3. **Contact support** with your macOS version and Mac model

**The app works perfectly once the quarantine is removed!** 🎉