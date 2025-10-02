# 🚀 Downlodr Linux Build - Quick Start Guide

## ⚡ **TL;DR - Build Linux Packages**

```bash
# One command to build everything
yarn build:linux
```

**Output:** DEB + RPM + ZIP packages in `out/make/` with bundled yt-dlp and ffmpeg.

---

## 📋 **Common Commands**

### Development
```bash
# Start app (with sandbox disabled for development)
ELECTRON_DISABLE_SANDBOX=1 yarn start

# Or fix sandbox permissions once
./fix-sandbox.sh
yarn start
```

### Building
```bash
# Build all Linux packages
yarn build:linux

# Build specific format
yarn make:linux:deb    # DEB only
yarn make:linux:rpm    # RPM only
yarn make:linux:zip    # ZIP only

# Force redownload binaries
yarn build:linux:force
```

### Verification
```bash
# Verify build is complete
./verify-build.sh

# Check package contents
dpkg-deb -c out/make/deb/x64/downlodr_*.deb
```

---

## 🔧 **Troubleshooting**

### Issue: Chrome Sandbox Error
```bash
# Quick fix
ELECTRON_DISABLE_SANDBOX=1 yarn start

# Or permanent fix
./fix-sandbox.sh
```

### Issue: No Icon in Menu
```bash
# Rebuild with correct icon
rm -rf out/
yarn make:linux
```

### Issue: Binary Not Found
```bash
# Redownload binaries
yarn build:linux --force
```

---

## 📦 **Package Locations**

After `yarn build:linux`, packages are in:

```
out/make/
├── deb/x64/downlodr_1.7.7-stable_amd64.deb      # Ubuntu/Debian
├── rpm/x64/downlodr-1.7.7.stable-1.x86_64.rpm   # Fedora/RHEL
└── zip/linux/x64/Downlodr-linux-x64-1.7.7-stable.zip  # Universal
```

---

## ✅ **Checklist Before Release**

- [x] Packages build successfully
- [x] Binaries bundled (yt-dlp, ffmpeg, ffprobe)
- [x] Icon shows in application menu
- [x] Desktop file created
- [x] All formats generated (DEB, RPM, ZIP)
- [x] No TypeScript errors
- [x] Documentation complete

---

## 📚 **Full Documentation**

- **Build Guide:** `scripts/README-linux-build.md`
- **Sandbox Fixes:** `SANDBOX_SOLUTIONS.md`
- **Icon Config:** `ICON_FIX_SUMMARY.md`
- **Complete Summary:** `FINAL_BUILD_SUMMARY.md`

---

## 🎯 **What Gets Bundled**

✅ **Application** - Electron app with all dependencies  
✅ **yt-dlp** (3.0MB) - Latest version, self-contained  
✅ **ffmpeg** (169MB) - Static build with all codecs  
✅ **ffprobe** (168MB) - Media analysis tool  
✅ **Icons** - SVG + PNG in multiple sizes  
✅ **Desktop Integration** - Launcher entry + icon  

**Total Package Size:** 172-229MB (depending on format)

---

**Ready to distribute! 🎊**
