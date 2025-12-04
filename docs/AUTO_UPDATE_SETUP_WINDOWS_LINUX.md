# Auto-Update Setup Guide for Windows and Linux

This guide covers setting up the Downlodr auto-update system for Windows and Linux platforms, based on the existing macOS implementation using `electron-updater`.

## Table of Contents

1. [Overview](#overview)
2. [Prerequisites](#prerequisites)
3. [Windows Setup](#windows-setup)
4. [Linux Setup](#linux-setup)
5. [GitHub Actions Workflow](#github-actions-workflow)
6. [Testing Auto-Updates](#testing-auto-updates)
7. [Troubleshooting](#troubleshooting)

---

## Overview

The auto-update system uses:
- **electron-updater** - Handles checking, downloading, and installing updates
- **GitHub Releases** - Hosts update manifests and artifacts
- **Update Manifests** - YAML files (`latest.yml`, `latest-mac.yml`, `latest-linux.yml`) that tell the updater what's available

### How It Works

```
┌─────────────────┐     ┌───────────────────┐     ┌─────────────────┐
│  Downlodr App   │────>│  GitHub Releases  │────>│  Download New   │
│  (electron-     │     │  - latest.yml     │     │  Version ZIP    │
│   updater)      │     │  - latest-mac.yml │     │  & Install      │
└─────────────────┘     │  - latest-linux.yml│    └─────────────────┘
                        └───────────────────┘
```

---

## Prerequisites

### Dependencies

Ensure these are in your `package.json`:

```json
{
  "dependencies": {
    "electron-updater": "^6.6.2",
    "electron-log": "^5.4.3"
  }
}
```

Install if not present:
```bash
yarn add electron-updater electron-log
```

### Existing Code Structure

The auto-updater code is already implemented in:
- `src/DataFunctions/autoUpdater.ts` - Main auto-updater logic
- `src/preload.ts` - IPC handlers exposed to renderer
- `src/Components/SubComponents/custom/UpdateNotifications.tsx` - UI component
- `src/global.d.ts` - TypeScript types

---

## Windows Setup

### Step 1: Configure Electron Forge Makers

Update `forge.config.ts` to include Windows makers:

```typescript
// forge.config.ts
import { MakerSquirrel } from '@electron-forge/maker-squirrel';
import { MakerZIP } from '@electron-forge/maker-zip';

const config: ForgeConfig = {
  // ... existing config
  makers: [
    // Windows Squirrel installer (recommended for auto-updates)
    new MakerSquirrel({
      name: 'Downlodr',
      authors: 'Talisik',
      description: 'Powerful video downloading solution',
      // Icon for installer
      iconUrl: 'https://raw.githubusercontent.com/Talisik/Downlodr/main/src/Assets/AppLogo/icon.ico',
      setupIcon: './src/Assets/AppLogo/icon.ico',
      // Code signing (optional but recommended)
      // certificateFile: process.env.WINDOWS_CERTIFICATE_FILE,
      // certificatePassword: process.env.WINDOWS_CERTIFICATE_PASSWORD,
    }),
    // ZIP maker for electron-updater (required)
    new MakerZIP({
      platforms: ['win32'],
    }),
    // ... other makers
  ],
};
```

### Step 2: Update Auto-Updater for Windows

The current `autoUpdater.ts` already supports Windows. The key configuration:

```typescript
// src/DataFunctions/autoUpdater.ts
autoUpdater.setFeedURL({
  provider: 'github',
  owner: 'Talisik',
  repo: 'Downlodr',
  releaseType: 'release',
});
```

electron-updater automatically looks for `latest.yml` (Windows) in GitHub Releases.

### Step 3: Generate latest.yml for Windows

Add this step to your Windows build workflow:

```yaml
# .github/workflows/build-release-windows.yml
- name: Generate latest.yml for Auto-Updates
  run: |
    # Get version from package.json
    $VERSION = node -p "require('./package.json').version"
    Write-Host "Generating latest.yml for version: $VERSION"

    # Find the NUPKG or ZIP file
    $NUPKG_FILE = Get-ChildItem -Path "out/make" -Filter "*.nupkg" -Recurse | Select-Object -First 1
    $ZIP_FILE = Get-ChildItem -Path "out/make" -Filter "*win32*.zip" -Recurse | Select-Object -First 1

    if ($ZIP_FILE) {
      $FILE = $ZIP_FILE
    } elseif ($NUPKG_FILE) {
      $FILE = $NUPKG_FILE
    } else {
      Write-Host "No update file found"
      exit 1
    }

    $FILE_NAME = $FILE.Name
    $FILE_SIZE = $FILE.Length
    $FILE_HASH = (Get-FileHash -Path $FILE.FullName -Algorithm SHA512).Hash.ToLower()

    # Create latest.yml
    @"
version: $VERSION
files:
  - url: $FILE_NAME
    sha512: $FILE_HASH
    size: $FILE_SIZE
path: $FILE_NAME
sha512: $FILE_HASH
releaseDate: '$(Get-Date -Format "yyyy-MM-ddTHH:mm:ss.000Z")'
"@ | Out-File -FilePath "out/make/latest.yml" -Encoding UTF8

    Write-Host "Generated latest.yml"
    Get-Content "out/make/latest.yml"
  shell: pwsh
```

---

## Linux Setup

### Step 1: Configure Electron Forge Makers for Linux

```typescript
// forge.config.ts
import { MakerDeb } from '@electron-forge/maker-deb';
import { MakerRpm } from '@electron-forge/maker-rpm';
import { MakerZIP } from '@electron-forge/maker-zip';

const config: ForgeConfig = {
  // ... existing config
  makers: [
    // Debian package
    new MakerDeb({
      options: {
        maintainer: 'Talisik',
        homepage: 'https://downlodr.com',
        icon: './src/Assets/AppLogo/icon.png',
        categories: ['Utility', 'Network'],
      },
    }),
    // RPM package (Fedora, RHEL, etc.)
    new MakerRpm({
      options: {
        homepage: 'https://downlodr.com',
        icon: './src/Assets/AppLogo/icon.png',
        categories: ['Utility', 'Network'],
      },
    }),
    // AppImage (recommended for auto-updates on Linux)
    // Note: AppImage requires special setup - see below

    // ZIP for electron-updater
    new MakerZIP({
      platforms: ['linux'],
    }),
  ],
};
```

### Step 2: AppImage for Linux Auto-Updates

electron-updater supports AppImage for Linux auto-updates. Install the maker:

```bash
yarn add -D @electron-forge/maker-appimage
```

Configure in `forge.config.ts`:

```typescript
import { MakerAppImage } from '@electron-forge/maker-appimage';

// In makers array:
new MakerAppImage({
  options: {
    icon: './src/Assets/AppLogo/icon.png',
    categories: ['Utility', 'Network'],
  },
}),
```

### Step 3: Generate latest-linux.yml

Add to your Linux build workflow:

```yaml
# .github/workflows/build-release-linux.yml
- name: Generate latest-linux.yml for Auto-Updates
  run: |
    VERSION=$(node -p "require('./package.json').version")
    echo "Generating latest-linux.yml for version: $VERSION"

    # Find the AppImage file (preferred) or ZIP
    APPIMAGE_FILE=$(find out/make -name "*.AppImage" -type f | head -n 1)
    ZIP_FILE=$(find out/make -name "*linux*.zip" -type f | head -n 1)

    if [ -n "$APPIMAGE_FILE" ]; then
      UPDATE_FILE="$APPIMAGE_FILE"
    elif [ -n "$ZIP_FILE" ]; then
      UPDATE_FILE="$ZIP_FILE"
    else
      echo "No update file found"
      exit 1
    fi

    FILE_NAME=$(basename "$UPDATE_FILE")
    FILE_SIZE=$(stat -c%s "$UPDATE_FILE")
    FILE_SHA512=$(sha512sum "$UPDATE_FILE" | cut -d ' ' -f 1)

    cat > out/make/latest-linux.yml << EOF
version: ${VERSION}
files:
  - url: ${FILE_NAME}
    sha512: ${FILE_SHA512}
    size: ${FILE_SIZE}
path: ${FILE_NAME}
sha512: ${FILE_SHA512}
releaseDate: '$(date -u +"%Y-%m-%dT%H:%M:%S.000Z")'
EOF

    echo "Generated latest-linux.yml:"
    cat out/make/latest-linux.yml
```

---

## GitHub Actions Workflow

### Complete Multi-Platform Workflow

Create `.github/workflows/build-release-all.yml`:

```yaml
name: Build and Release All Platforms

on:
  push:
    tags:
      - 'v*'
  workflow_dispatch:

jobs:
  # ===== macOS Build =====
  build-macos:
    name: Build macOS (${{ matrix.arch }})
    runs-on: macos-latest
    strategy:
      matrix:
        arch: [arm64, x64]

    steps:
      - uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'yarn'

      - name: Sync Version from Tag
        if: startsWith(github.ref, 'refs/tags/v')
        run: |
          TAG_VERSION=${GITHUB_REF#refs/tags/v}
          node -e "
            const fs = require('fs');
            const pkg = require('./package.json');
            pkg.version = '$TAG_VERSION';
            fs.writeFileSync('./package.json', JSON.stringify(pkg, null, 2) + '\n');
          "

      - name: Install dependencies
        run: yarn install --frozen-lockfile

      # Add code signing steps here (see existing macOS workflow)

      - name: Build for ${{ matrix.arch }}
        run: yarn make --arch=${{ matrix.arch }} --platform=darwin

      - name: Generate latest-mac.yml
        run: |
          VERSION=$(node -p "require('./package.json').version")
          ZIP_FILE=$(find out/make -name "*.zip" -type f | head -n 1)
          ZIP_NAME=$(basename "$ZIP_FILE")
          ZIP_SIZE=$(stat -f%z "$ZIP_FILE")
          ZIP_SHA512=$(shasum -a 512 "$ZIP_FILE" | cut -d ' ' -f 1)

          cat > out/make/latest-mac-${{ matrix.arch }}.yml << EOF
version: ${VERSION}
files:
  - url: ${ZIP_NAME}
    sha512: ${ZIP_SHA512}
    size: ${ZIP_SIZE}
    arch: ${{ matrix.arch }}
path: ${ZIP_NAME}
sha512: ${ZIP_SHA512}
releaseDate: '$(date -u +"%Y-%m-%dT%H:%M:%S.000Z")'
EOF

      - name: Upload Artifacts
        uses: actions/upload-artifact@v4
        with:
          name: downlodr-macos-${{ matrix.arch }}
          path: |
            out/make/**/*.pkg
            out/make/**/*.dmg
            out/make/**/*.zip
            out/make/latest-mac-*.yml

  # ===== Windows Build =====
  build-windows:
    name: Build Windows
    runs-on: windows-latest

    steps:
      - uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'yarn'

      - name: Sync Version from Tag
        if: startsWith(github.ref, 'refs/tags/v')
        shell: pwsh
        run: |
          $TAG_VERSION = "${{ github.ref }}".Replace("refs/tags/v", "")
          node -e "
            const fs = require('fs');
            const pkg = require('./package.json');
            pkg.version = '$TAG_VERSION';
            fs.writeFileSync('./package.json', JSON.stringify(pkg, null, 2) + '\n');
          "

      - name: Install dependencies
        run: yarn install --frozen-lockfile

      - name: Build for Windows
        run: yarn make --platform=win32

      - name: Generate latest.yml
        shell: pwsh
        run: |
          $VERSION = node -p "require('./package.json').version"

          # Find ZIP file
          $ZIP_FILE = Get-ChildItem -Path "out/make" -Filter "*.zip" -Recurse | Select-Object -First 1

          if (-not $ZIP_FILE) {
            Write-Error "No ZIP file found"
            exit 1
          }

          $FILE_NAME = $ZIP_FILE.Name
          $FILE_SIZE = $ZIP_FILE.Length
          $FILE_HASH = (Get-FileHash -Path $ZIP_FILE.FullName -Algorithm SHA512).Hash.ToLower()

          @"
version: $VERSION
files:
  - url: $FILE_NAME
    sha512: $FILE_HASH
    size: $FILE_SIZE
path: $FILE_NAME
sha512: $FILE_HASH
releaseDate: '$(Get-Date -Format "yyyy-MM-ddTHH:mm:ss.000Z")'
"@ | Out-File -FilePath "out/make/latest.yml" -Encoding UTF8

          Write-Host "Generated latest.yml:"
          Get-Content "out/make/latest.yml"

      - name: Upload Artifacts
        uses: actions/upload-artifact@v4
        with:
          name: downlodr-windows
          path: |
            out/make/**/*.exe
            out/make/**/*.nupkg
            out/make/**/*.zip
            out/make/latest.yml
            out/make/RELEASES

  # ===== Linux Build =====
  build-linux:
    name: Build Linux
    runs-on: ubuntu-latest

    steps:
      - uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'yarn'

      - name: Install Linux Dependencies
        run: |
          sudo apt-get update
          sudo apt-get install -y rpm libarchive-tools

      - name: Sync Version from Tag
        if: startsWith(github.ref, 'refs/tags/v')
        run: |
          TAG_VERSION=${GITHUB_REF#refs/tags/v}
          node -e "
            const fs = require('fs');
            const pkg = require('./package.json');
            pkg.version = '$TAG_VERSION';
            fs.writeFileSync('./package.json', JSON.stringify(pkg, null, 2) + '\n');
          "

      - name: Install dependencies
        run: yarn install --frozen-lockfile

      - name: Build for Linux
        run: yarn make --platform=linux

      - name: Generate latest-linux.yml
        run: |
          VERSION=$(node -p "require('./package.json').version")

          # Find AppImage or ZIP
          APPIMAGE=$(find out/make -name "*.AppImage" -type f | head -n 1)
          ZIP_FILE=$(find out/make -name "*linux*.zip" -type f | head -n 1)

          if [ -n "$APPIMAGE" ]; then
            UPDATE_FILE="$APPIMAGE"
          elif [ -n "$ZIP_FILE" ]; then
            UPDATE_FILE="$ZIP_FILE"
          else
            echo "No update file found"
            exit 1
          fi

          FILE_NAME=$(basename "$UPDATE_FILE")
          FILE_SIZE=$(stat -c%s "$UPDATE_FILE")
          FILE_SHA512=$(sha512sum "$UPDATE_FILE" | cut -d ' ' -f 1)

          cat > out/make/latest-linux.yml << EOF
version: ${VERSION}
files:
  - url: ${FILE_NAME}
    sha512: ${FILE_SHA512}
    size: ${FILE_SIZE}
path: ${FILE_NAME}
sha512: ${FILE_SHA512}
releaseDate: '$(date -u +"%Y-%m-%dT%H:%M:%S.000Z")'
EOF

          echo "Generated latest-linux.yml:"
          cat out/make/latest-linux.yml

      - name: Upload Artifacts
        uses: actions/upload-artifact@v4
        with:
          name: downlodr-linux
          path: |
            out/make/**/*.deb
            out/make/**/*.rpm
            out/make/**/*.AppImage
            out/make/**/*.zip
            out/make/latest-linux.yml

  # ===== Create Release =====
  create-release:
    name: Create GitHub Release
    needs: [build-macos, build-windows, build-linux]
    runs-on: ubuntu-latest
    if: startsWith(github.ref, 'refs/tags/v')

    steps:
      - uses: actions/checkout@v4

      - name: Download all artifacts
        uses: actions/download-artifact@v4
        with:
          path: ./artifacts

      - name: Combine latest-mac.yml
        run: |
          VERSION=${GITHUB_REF#refs/tags/v}

          # Find arch-specific files
          ARM64_YML=$(find ./artifacts -name "latest-mac-arm64.yml" | head -n 1)
          X64_YML=$(find ./artifacts -name "latest-mac-x64.yml" | head -n 1)

          # Find ZIP files
          ARM64_ZIP=$(find ./artifacts -name "*darwin-arm64*.zip" -type f | head -n 1)
          X64_ZIP=$(find ./artifacts -name "*darwin-x64*.zip" -type f | head -n 1)

          FILES_YAML=""

          if [ -n "$ARM64_ZIP" ]; then
            ARM64_NAME=$(basename "$ARM64_ZIP")
            ARM64_SIZE=$(stat -c%s "$ARM64_ZIP")
            ARM64_SHA512=$(sha512sum "$ARM64_ZIP" | cut -d ' ' -f 1)
            FILES_YAML="${FILES_YAML}  - url: ${ARM64_NAME}
    sha512: ${ARM64_SHA512}
    size: ${ARM64_SIZE}
    arch: arm64
"
          fi

          if [ -n "$X64_ZIP" ]; then
            X64_NAME=$(basename "$X64_ZIP")
            X64_SIZE=$(stat -c%s "$X64_ZIP")
            X64_SHA512=$(sha512sum "$X64_ZIP" | cut -d ' ' -f 1)
            FILES_YAML="${FILES_YAML}  - url: ${X64_NAME}
    sha512: ${X64_SHA512}
    size: ${X64_SIZE}
    arch: x64
"
          fi

          cat > ./artifacts/latest-mac.yml << EOF
version: ${VERSION}
files:
${FILES_YAML}releaseDate: '$(date -u +"%Y-%m-%dT%H:%M:%S.000Z")'
EOF

          echo "Combined latest-mac.yml:"
          cat ./artifacts/latest-mac.yml

      - name: Create Release
        uses: softprops/action-gh-release@v1
        with:
          files: |
            ./artifacts/**/*.pkg
            ./artifacts/**/*.dmg
            ./artifacts/**/*.exe
            ./artifacts/**/*.nupkg
            ./artifacts/**/*.deb
            ./artifacts/**/*.rpm
            ./artifacts/**/*.AppImage
            ./artifacts/**/*.zip
            ./artifacts/**/latest*.yml
            ./artifacts/**/RELEASES
          draft: false
          generate_release_notes: true
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
```

---

## Testing Auto-Updates

### Local Testing Steps

1. **Build and install version A** (e.g., 1.7.19-exp-auto)
   ```bash
   yarn make
   # Install from out/make/
   ```

2. **Bump version to B** (e.g., 1.7.20-exp-auto)
   ```bash
   # Edit package.json version
   ```

3. **Build version B and create release**
   ```bash
   yarn make
   git add . && git commit -m "chore: Bump to 1.7.20"
   git tag v1.7.20-exp-auto
   git push && git push --tags
   ```

4. **Wait for GitHub Actions** to complete and publish release

5. **Open version A app** and check for updates
   - Should detect version B
   - Should download in background
   - Should offer to install

### Testing Update Detection

```bash
# Test if update manifest is accessible
curl https://github.com/Talisik/Downlodr/releases/latest/download/latest.yml
curl https://github.com/Talisik/Downlodr/releases/latest/download/latest-mac.yml
curl https://github.com/Talisik/Downlodr/releases/latest/download/latest-linux.yml
```

### Checking Logs

On Windows:
```
%USERPROFILE%\AppData\Roaming\Downlodr\logs\main.log
```

On Linux:
```
~/.config/Downlodr/logs/main.log
```

On macOS:
```
~/Library/Logs/Downlodr/main.log
```

---

## Troubleshooting

### Common Issues

#### 1. "Update Check Failed" Error

**Causes:**
- No `latest.yml` / `latest-mac.yml` / `latest-linux.yml` in release
- GitHub release is still a draft
- Network connectivity issues

**Solutions:**
- Verify the YAML files exist in the release assets
- Publish the release (not draft)
- Check network/firewall settings

#### 2. Update Downloads But Doesn't Install (Windows)

**Causes:**
- Squirrel.Windows not configured correctly
- Missing RELEASES file
- Antivirus blocking

**Solutions:**
- Use MakerSquirrel with correct config
- Ensure RELEASES file is uploaded to release
- Add exception in antivirus

#### 3. Linux AppImage Auto-Update Not Working

**Causes:**
- AppImage not built with update support
- User doesn't have write permission
- FUSE not available

**Solutions:**
- Build AppImage with `--appimage-extract-and-run` support
- Run from user-writable location
- Install FUSE: `sudo apt install fuse libfuse2`

#### 4. Version Channel Mismatch

The auto-updater uses version channels. A version like `1.7.19-exp-auto` has channel `exp-auto`.

**Important:** Apps on channel `exp-auto` will only update to other `exp-auto` versions, not `stable` versions.

```typescript
// In autoUpdater.ts
const channel = getCurrentChannel();
if (channel) {
  autoUpdater.channel = channel;
}
```

### Debug Mode

Enable detailed logging:

```typescript
// In autoUpdater.ts
import log from 'electron-log';

log.transports.file.level = 'debug';
log.transports.console.level = 'debug';
autoUpdater.logger = log;
```

---

## Update Manifest Format

### latest.yml (Windows)

```yaml
version: 1.7.20-exp-auto
files:
  - url: Downlodr-1.7.20-exp-auto-win32-x64.zip
    sha512: abc123...
    size: 123456789
path: Downlodr-1.7.20-exp-auto-win32-x64.zip
sha512: abc123...
releaseDate: '2025-12-04T12:00:00.000Z'
```

### latest-mac.yml (macOS with multiple architectures)

```yaml
version: 1.7.20-exp-auto
files:
  - url: Downlodr-darwin-arm64-1.7.20-exp-auto.zip
    sha512: abc123...
    size: 123456789
    arch: arm64
  - url: Downlodr-darwin-x64-1.7.20-exp-auto.zip
    sha512: def456...
    size: 123456789
    arch: x64
releaseDate: '2025-12-04T12:00:00.000Z'
```

### latest-linux.yml (Linux)

```yaml
version: 1.7.20-exp-auto
files:
  - url: Downlodr-1.7.20-exp-auto.AppImage
    sha512: abc123...
    size: 123456789
path: Downlodr-1.7.20-exp-auto.AppImage
sha512: abc123...
releaseDate: '2025-12-04T12:00:00.000Z'
```

---

## Code Signing (Production)

### Windows Code Signing

For production releases, sign your Windows builds:

```yaml
# In GitHub Actions
- name: Sign Windows Executable
  env:
    WINDOWS_CERTIFICATE: ${{ secrets.WINDOWS_CERTIFICATE }}
    WINDOWS_CERTIFICATE_PASSWORD: ${{ secrets.WINDOWS_CERTIFICATE_PASSWORD }}
  run: |
    # Import certificate
    echo $WINDOWS_CERTIFICATE | base64 -d > certificate.pfx

    # Sign with signtool
    signtool sign /f certificate.pfx /p $WINDOWS_CERTIFICATE_PASSWORD /tr http://timestamp.digicert.com /td sha256 /fd sha256 "out/make/**/*.exe"
```

### Linux Signing

Linux packages can be signed with GPG:

```yaml
- name: Sign Linux Packages
  run: |
    gpg --armor --detach-sign out/make/**/*.AppImage
    gpg --armor --detach-sign out/make/**/*.deb
```

---

## Summary

| Platform | Update File Format | Manifest File | Auto-Update Support |
|----------|-------------------|---------------|---------------------|
| macOS | ZIP | latest-mac.yml | Full |
| Windows | ZIP/NUPKG | latest.yml | Full |
| Linux | AppImage | latest-linux.yml | Full (AppImage only) |

The existing Downlodr implementation already has the core auto-updater code. To extend to Windows and Linux:

1. Add appropriate makers to `forge.config.ts`
2. Create platform-specific build workflows
3. Generate the correct `latest*.yml` manifests
4. Upload manifests to GitHub Releases

The renderer UI (`UpdateNotification.tsx`) and main process code (`autoUpdater.ts`) work across all platforms without changes.
