# Downlodr Installation Guide for macOS

## Overview

This guide helps users install and run Downlodr on their Mac computers. It addresses common security dialogs and provides troubleshooting steps for a smooth installation experience.

## System Requirements

### Minimum Requirements
- **macOS**: 10.15 (Catalina) or later
- **Architecture**: Apple Silicon (M1/M2/M3/M4) or Intel Macs
- **RAM**: 4GB minimum, 8GB recommended
- **Storage**: 500MB free space
- **Internet**: Required for downloading videos

### Recommended System
- **macOS**: 12.0 (Monterey) or later
- **RAM**: 8GB or more
- **Storage**: 2GB free space for downloads
- **Internet**: Broadband connection

## Installation Instructions

### Step 1: Download Downlodr

1. **Download the DMG file** from the official source
   - File name: `Downlodr-[version]-[date].dmg`
   - File size: Approximately 150-200MB

2. **Verify the download** (optional but recommended)
   - Check file size matches expected size
   - If provided, verify checksum

### Step 2: Open the DMG

1. **Double-click** the downloaded DMG file
2. **Wait for verification** - macOS may take a moment to verify the file
3. **DMG window opens** showing Downlodr.app and Applications folder

### Step 3: Install Downlodr

1. **Drag Downlodr.app** to the Applications folder
2. **Wait for copy** to complete
3. **Eject the DMG** by clicking the eject button or dragging to trash

### Step 4: Launch Downlodr

1. **Open Applications folder** (Cmd+Shift+A)
2. **Find Downlodr** in the applications list
3. **Double-click** to launch

## First Launch Security Dialog

### Expected Security Dialog

When launching Downlodr for the first time, you may see:

```
"Downlodr" is an app downloaded from the Internet.
Are you sure you want to open it?

[Cancel] [Open]
```

**This is normal!** Click **"Open"** to continue.

### If You See "Move to Trash"

If you see a dialog suggesting to "Move to Trash":

```
"Downlodr" can't be opened because Apple cannot check it for malicious software.

[Move to Trash] [Cancel]
```

**Follow these steps:**

1. **Click "Cancel"**
2. **Open System Preferences/Settings**
3. **Go to "Privacy & Security"**
4. **Scroll down** to find "Downlodr was blocked from use..."
5. **Click "Open Anyway"**
6. **Confirm** in the dialog that appears

### Alternative Method

If the above doesn't work:

1. **Right-click** on Downlodr.app in Applications
2. **Select "Open"** from the context menu
3. **Click "Open"** in the security dialog

## Troubleshooting

### Issue: App Won't Launch

#### Symptoms
- Double-clicking does nothing
- App appears briefly then disappears
- Error messages in Console

#### Solutions

1. **Check macOS Version**
   ```
   Apple Menu > About This Mac
   Ensure macOS 10.15 or later
   ```

2. **Try Alternative Launch**
   - Right-click → Open
   - Use Spotlight search (Cmd+Space, type "Downlodr")

3. **Reset Quarantine** (Advanced)
   ```bash
   # In Terminal:
   xattr -cr /Applications/Downlodr.app
   ```

### Issue: Password Prompts

#### Symptoms
- macOS requests your user password when opening Downlodr
- Multiple password dialogs appear

#### Solutions

1. **Enter your password** if prompted (this should only happen once)
2. **If prompts persist**, contact support - this indicates a signing issue

### Issue: Videos Won't Download

#### Symptoms
- Downloads fail to start
- Error messages about missing tools
- Videos download but won't play

#### Solutions

1. **Check Internet Connection**
   - Ensure stable internet connection
   - Try downloading a different video

2. **Restart the App**
   - Quit Downlodr completely
   - Relaunch from Applications

3. **Check Permissions**
   - Ensure Downlodr has permission to access Downloads folder
   - System Preferences → Privacy & Security → Files and Folders

### Issue: Performance Problems

#### Symptoms
- App runs slowly
- High CPU usage
- Frequent crashes

#### Solutions

1. **Check Available Storage**
   - Ensure at least 1GB free space
   - Clear old downloads if needed

2. **Restart Your Mac**
   - Close all applications
   - Restart and try again

3. **Check Activity Monitor**
   - Look for other high-CPU processes
   - Quit unnecessary applications

## Uninstallation

### Complete Removal

To completely remove Downlodr:

1. **Quit Downlodr** if running
2. **Delete from Applications**
   - Drag Downlodr.app to Trash
3. **Remove preferences** (optional)
   - `~/Library/Preferences/com.electron.downlodr.plist`
4. **Remove support files** (optional)
   - `~/Library/Application Support/Downlodr/`

### Keep Downloads

Your downloaded videos are stored separately and won't be deleted when uninstalling Downlodr.

## Privacy and Security

### What Downlodr Accesses

Downlodr requires access to:
- **Internet**: To download videos
- **File System**: To save downloads
- **Downloads Folder**: Default save location

### What Downlodr Doesn't Access

Downlodr does **NOT** access:
- Your personal files (except Downloads folder)
- Other applications
- System settings
- Network traffic from other apps

### Security Features

- **Code Signed**: Verified by Apple
- **Notarized**: Scanned for malicious software
- **Sandboxed**: Limited system access
- **No Tracking**: No analytics or user tracking

## Getting Help

### Before Contacting Support

1. **Try restarting** the app
2. **Check system requirements**
3. **Review troubleshooting section** above
4. **Try with a different video** to isolate the issue

### When Contacting Support

Please include:
- **macOS version**: Apple Menu → About This Mac
- **Mac model**: Apple Menu → About This Mac
- **Downlodr version**: Downlodr → About Downlodr
- **Error messages**: Exact text of any error dialogs
- **Steps to reproduce**: What you were doing when the issue occurred

### Support Channels

- **GitHub Issues**: [Repository Issues Page]
- **Email Support**: [Support Email]
- **Documentation**: [Documentation Website]

## Frequently Asked Questions

### Is Downlodr Safe?

Yes, Downlodr is safe to use:
- Code signed by verified developer
- Notarized by Apple
- No malicious software detected
- Open source code available for inspection

### Why Do I See Security Warnings?

macOS shows security dialogs for all applications downloaded from the internet. This is normal and expected behavior for enhanced security.

### Can I Trust the Publisher?

Downlodr is signed with an Apple Developer ID certificate, which means:
- The publisher is verified by Apple
- The app hasn't been tampered with since signing
- Apple has scanned it for known malicious software

### Will This Affect My Mac's Performance?

Downlodr is designed to be lightweight:
- Minimal background processing
- Efficient memory usage
- Only active when downloading

### Can I Use Downlodr for Commercial Purposes?

Please check:
- Downlodr's license terms
- Copyright laws in your jurisdiction
- Terms of service for video platforms
- Fair use guidelines

## Tips for Best Experience

### Optimal Settings

1. **Choose SSD Storage**: For faster processing
2. **Stable Internet**: For reliable downloads
3. **Regular Updates**: Keep Downlodr updated
4. **Sufficient Space**: Maintain free storage

### Performance Tips

1. **Download during off-peak hours**
2. **Limit concurrent downloads**
3. **Close other bandwidth-intensive apps**
4. **Use ethernet connection** when possible

### Organization Tips

1. **Create organized folder structure**
2. **Use descriptive filenames**
3. **Regular cleanup** of old downloads
4. **Backup important videos**

---

**Installation Guide Version**: 1.0  
**Last Updated**: August 13, 2025  
**Compatible With**: Downlodr v1.7.2+  
**Tested On**: macOS Sonoma 14.0, macOS Sequoia 15.0
