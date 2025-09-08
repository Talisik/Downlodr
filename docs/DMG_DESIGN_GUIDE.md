# Professional DMG Design Guide

## 🎨 **Achieving Professional DMG Layout (Like Fellou)**

This guide shows how to create professional-looking DMG installers with custom layouts, drag-and-drop functionality, and visual styling.

### **📋 Current Implementation Status**

✅ **Working Features:**
- Custom volume name: "Downlodr 1.7.7-stable"
- Applications folder symlink for drag-and-drop installation
- Professional window sizing (660x400)
- Custom app icon positioning
- Background image support
- Code signing and notarization
- Automatic versioning with timestamps

⚠️ **Limitations:**
- `create-dmg` professional styling requires "Full Disk Access" permission
- Falls back to `hdiutil` which creates functional but basic DMGs

### **🔧 Technical Configuration**

Our `create-dmg` is configured with Fellou-style layout:

```bash
/opt/homebrew/bin/create-dmg \
    --volname "Downlodr ${APP_VERSION}" \
    --volicon "src/Assets/AppLogo/icon.icns" \
    --window-pos 200 120 \
    --window-size 660 400 \
    --icon-size 128 \
    --icon "Downlodr.app" 180 200 \
    --hide-extension "Downlodr.app" \
    --app-drop-link 480 200 \
    --background "src/Assets/DMG/dmg-background.png" \
    --text-size 16 \
    --no-internet-enable \
    "$DMG_PATH" \
    "$DMG_SOURCE_DIR"
```

### **🎯 Layout Breakdown**

Based on the Fellou example design:

```
┌─────────────────────────────────────────────────────────────┐
│  ○ ○ ○                    Downlodr 1.7.7-stable             │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│        Drag Downlodr into the Applications folder          │
│                                                             │
│                                                             │
│     [Downlodr.app]          ───►          [Applications]   │
│        (180,200)                             (480,200)     │
│                                                             │
│                                                             │
│                                                             │
│                                                             │
└─────────────────────────────────────────────────────────────┘
          Window Size: 660x400 pixels
```

### **🛠️ Configuration Details**

| Parameter | Value | Purpose |
|-----------|-------|---------|
| `--volname` | "Downlodr {VERSION}" | Custom volume name |
| `--volicon` | "src/Assets/AppLogo/icon.icns" | Volume icon |
| `--window-size` | 660x400 | Compact, professional size |
| `--icon-size` | 128 | Large, clear icons |
| `--icon "Downlodr.app"` | 180 200 | Position app on left |
| `--app-drop-link` | 480 200 | Position Applications on right |
| `--background` | Custom PNG | Professional background |
| `--text-size` | 16 | Readable text size |

### **🔐 Permission Requirements**

To enable full `create-dmg` professional styling:

1. **System Preferences** → **Privacy & Security**
2. **Full Disk Access** → Add **Terminal**
3. **Restart Terminal** and run build script

**Why this is needed:**
`create-dmg` needs to:
1. Create a temporary DMG
2. Mount it as a volume
3. Access the mounted volume to arrange files
4. Apply custom layout and styling

macOS security blocks step 3 without Full Disk Access.

### **🔄 Current Fallback System**

Our build system has a robust fallback chain:

1. **Try create-dmg** (professional styling)
2. **Try create-dmg with sudo** (elevated permissions)
3. **Fallback to hdiutil** (functional, basic styling)

The `hdiutil` fallback creates:
- ✅ Proper volume names
- ✅ Applications folder for drag-drop
- ✅ Functional installation process
- ❌ No custom layout or visual styling

### **📁 Required Assets**

```
src/Assets/DMG/
├── dmg-background.png     # Background image (660x400)
└── (future additions)

src/Assets/AppLogo/
├── icon.icns             # Volume icon
└── 256x256.ico          # App icon source
```

### **🎨 Background Image Specifications**

- **Size:** 660x400 pixels
- **Format:** PNG with transparency support
- **Content:** Subtle gradient or branding
- **Text:** Optional instructional text

### **💡 Alternative Solutions**

If Full Disk Access isn't desired:

1. **Use current hdiutil fallback** (works perfectly for distribution)
2. **Manual DMG creation** using Disk Utility
3. **Alternative tools** like `node-dmg` or `electron-builder`
4. **CI/CD automation** with pre-configured permissions

### **🚀 Quick Start**

To achieve professional DMG design:

```bash
# 1. Grant Terminal Full Disk Access (System Preferences)
# 2. Run the build script
yarn build:dmg

# For Intel builds:
yarn build:intel
```

### **📊 Results**

**With Full Disk Access:**
- Professional drag-drop layout
- Custom background and positioning
- Visual arrows and styling
- Perfect user experience

**Without Full Disk Access (current):**
- Functional drag-drop installation
- Proper volume naming
- Code signed and notarized
- Ready for distribution

### **🔍 Verification**

Test your DMG:
1. Double-click the .dmg file
2. Verify the volume opens with proper name
3. Check that Applications folder is visible
4. Test drag-and-drop installation
5. Confirm app launches correctly

Both professional and fallback DMGs are **production-ready** and **fully functional** for distribution!
