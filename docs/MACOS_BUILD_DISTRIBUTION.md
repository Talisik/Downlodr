# macOS Build and Distribution Guide

## Overview

This document provides comprehensive instructions for building, signing, notarizing, and distributing Downlodr for macOS. The enhanced build system uses `create-dmg` for professional installer creation and implements industry-standard security practices.

## Table of Contents

- [Prerequisites](#prerequisites)
- [Environment Setup](#environment-setup)
- [Build System Overview](#build-system-overview)
- [Available Build Scripts](#available-build-scripts)
- [Step-by-Step Build Process](#step-by-step-build-process)
- [Distribution](#distribution)
- [Troubleshooting](#troubleshooting)
- [Advanced Configuration](#advanced-configuration)

## Prerequisites

### System Requirements

- **macOS**: 10.15 (Catalina) or later
- **Xcode**: Latest version with Command Line Tools
- **Node.js**: 16.x or later
- **Yarn**: Latest version
- **Homebrew**: For installing build dependencies

### Apple Developer Requirements

- **Apple Developer Program** membership ($99/year)
- **Developer ID Application** certificate
- **Developer ID Installer** certificate (optional)
- **App-specific password** for notarization

### Build Dependencies

```bash
# Install create-dmg for professional DMG creation
brew install create-dmg

# Verify installation
create-dmg --version
```

## Environment Setup

### 1. Apple Developer Certificates

#### Generate Certificates
1. Log into [Apple Developer Console](https://developer.apple.com/account/)
2. Navigate to **Certificates, Identifiers & Profiles**
3. Create a **Developer ID Application** certificate
4. Download and install in **Keychain Access**

#### Verify Certificate Installation
```bash
# List available signing identities
security find-identity -v -p codesigning

# Should show something like:
# 1) ABC123DEF456 "Developer ID Application: Your Name (TEAM123456)"
```

### 2. App-Specific Password

#### Generate Password
1. Go to [Apple ID Account](https://appleid.apple.com/account/manage)
2. Navigate to **App-Specific Passwords**
3. Generate new password for "Downlodr Notarization"
4. Save the generated password securely

### 3. Environment Configuration

#### Create .env File
```bash
# Copy the example file
cp env.example .env

# Edit with your credentials
nano .env
```

#### Required Environment Variables
```bash
# Apple Developer Code Signing
APPLE_IDENTITY="Developer ID Application: Your Name (TEAM123456)"

# Apple Notarization
APPLE_ID="your-apple-id@example.com"
APPLE_APP_SPECIFIC_PASSWORD="abcd-efgh-ijkl-mnop"
APPLE_TEAM_ID="TEAM123456"

# Build Configuration
NODE_ENV="production"
```

#### Find Your Team ID
```bash
# Method 1: From certificate
security find-identity -v -p codesigning

# Method 2: From Apple Developer Console
# Navigate to Membership section
```

## Build System Overview

### Architecture

The build system consists of several interconnected scripts:

```
Build Process Flow:
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│   yarn build:dmg   │ -> │  Package & Sign   │ -> │  Create DMG     │
└─────────────────┘    └──────────────────┘    └─────────────────┘
         │                        │                       │
         v                        v                       v
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│ Clean & Build   │    │ Fix Binary Signs │    │ Sign DMG        │
└─────────────────┘    └──────────────────┘    └─────────────────┘
         │                        │                       │
         v                        v                       v
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│ Electron Forge  │    │ Comprehensive    │    │ Submit for      │
│ Package         │    │ Framework Signs  │    │ Notarization    │
└─────────────────┘    └──────────────────┘    └─────────────────┘
                                │                       │
                                v                       v
                       ┌──────────────────┐    ┌─────────────────┐
                       │ yt-dlp & FFmpeg  │    │ Staple Ticket   │
                       │ Binary Signing   │    │ & Validate      │
                       └──────────────────┘    └─────────────────┘
```

### Key Components

1. **Environment Loading**: Automatic `.env` file loading
2. **Clean Builds**: Removes old artifacts before building
3. **Electron Packaging**: Uses Electron Forge for app bundling
4. **Comprehensive Signing**: Signs all binaries with proper entitlements
5. **Professional DMG**: Uses `create-dmg` for installer creation
6. **DMG Signing**: Signs the DMG itself for notarization
7. **Apple Notarization**: Submits to Apple's notarization service
8. **Ticket Stapling**: Embeds notarization for offline verification

## Available Build Scripts

### NPM Scripts

```bash
# Full production build with notarization
yarn build:dmg

# Test DMG creation without notarization
yarn test:dmg

# Quick build using original process (fallback)
yarn build:quick

# Standard Electron Forge commands
yarn package              # Package app only
yarn make                 # Package + create installers
```

### Direct Script Execution

```bash
# Enhanced build with create-dmg
./scripts/build-with-create-dmg.sh

# Test DMG creation
./scripts/test-create-dmg.sh

# Fix binary signing issues
./scripts/fix-binary-signing.sh

# Diagnose distribution problems
./scripts/diagnose-distribution-issues.sh

# Original build process
./scripts/build-macos.sh
```

## Step-by-Step Build Process

### Quick Start

For most users, the enhanced build process is simple:

```bash
# 1. Ensure environment is configured
source .env

# 2. Run the complete build
yarn build:dmg

# 3. Find your distribution files
ls -la out/make/
```

### Detailed Build Process

#### Step 1: Environment Verification
```bash
# Verify certificates
security find-identity -v -p codesigning

# Test Apple ID credentials
xcrun notarytool history --apple-id "$APPLE_ID" --password "$APPLE_APP_SPECIFIC_PASSWORD" --team-id "$APPLE_TEAM_ID" --limit 1
```

#### Step 2: Clean Build
```bash
# The build script automatically:
# - Removes out/ directory
# - Clears build cache
# - Ensures clean environment
```

#### Step 3: Application Packaging
```bash
# Electron Forge packages the app with:
# - Native dependencies compiled
# - External binaries included
# - Resources bundled
# - Platform-specific optimizations
```

#### Step 4: Comprehensive Code Signing
```bash
# All components are signed:
# - Main application bundle
# - yt-dlp binaries (with network entitlements)
# - FFmpeg binaries (with execution entitlements)
# - Electron Framework components
# - Helper applications
# - Third-party frameworks
```

#### Step 5: Professional DMG Creation
```bash
# create-dmg creates a professional installer:
# - Custom volume icon and name
# - Drag-and-drop to Applications folder
# - Proper window layout (800x550)
# - Clean, app-only contents
```

#### Step 6: DMG Signing and Notarization
```bash
# DMG is signed and notarized:
# - DMG signed with hardened runtime
# - Submitted to Apple notarization service
# - Ticket stapled for offline verification
# - Gatekeeper assessment passes
```

### Build Output

After successful build:

```
out/
├── Downlodr-darwin-arm64/
│   └── Downlodr.app                    # Main app bundle
└── make/
    └── Downlodr-1.7.2-stable-YYYYMMDD-HHMMSS.dmg  # Distribution DMG
```

## Distribution

### Distribution Files

#### Primary Distribution
- **DMG Installer**: `out/make/Downlodr-[version]-[timestamp].dmg`
  - Professional installer with Applications folder
  - Code signed and notarized
  - Ready for public distribution

#### Alternative Distribution
- **App Bundle**: `out/Downlodr-darwin-arm64/Downlodr.app`
  - Standalone application
  - For advanced users or enterprise deployment

### File Verification

#### Verify DMG Security
```bash
# Check notarization status
spctl --assess --verbose --type install out/make/Downlodr-*.dmg

# Expected output:
# accepted
# source=Notarized Developer ID
```

#### Verify App Bundle
```bash
# Check app signature
codesign --verify --deep --strict out/Downlodr-darwin-arm64/Downlodr.app

# Check notarization
spctl --assess --verbose --type execute out/Downlodr-darwin-arm64/Downlodr.app
```

### Upload and Distribution

#### GitHub Releases (Recommended)
```bash
# Create GitHub release
gh release create v1.7.2-stable \
  out/make/Downlodr-*.dmg \
  --title "Downlodr v1.7.2 Stable" \
  --notes "Production release with enhanced security"
```

#### Direct Download Setup
1. Upload DMG to secure hosting
2. Provide download instructions
3. Include verification checksums

#### Distribution Checklist
- [ ] DMG passes `spctl --assess`
- [ ] File size reasonable (< 200MB)
- [ ] Version number correct
- [ ] Release notes prepared
- [ ] Download location secure

## Troubleshooting

### Common Issues

#### Issue: "Move to Trash" Security Warning

**Symptoms**: Users see security dialog suggesting to move app to trash

**Causes**:
- DMG not properly notarized
- App bundle not signed correctly
- Corrupted download

**Solutions**:
```bash
# Verify notarization
spctl --assess --verbose --type install out/make/Downlodr-*.dmg

# If failed, rebuild:
yarn build:dmg
```

#### Issue: Password Prompts During Launch

**Symptoms**: macOS requests user password when opening app

**Causes**:
- External binaries not properly signed
- Problematic entitlements
- Keychain access issues

**Solutions**:
```bash
# Re-sign binaries
./scripts/fix-binary-signing.sh

# Check binary signatures
./scripts/diagnose-distribution-issues.sh
```

#### Issue: Videos Not Playable

**Symptoms**: Downloaded videos fail to play or process

**Causes**:
- FFmpeg binaries blocked by Gatekeeper
- Binary corruption during signing
- Missing execute permissions

**Solutions**:
```bash
# Test FFmpeg functionality
out/Downlodr-darwin-arm64/Downlodr.app/Contents/Resources/ffmpeg-arm64 -version

# Re-sign if needed
./scripts/fix-binary-signing.sh
```

#### Issue: Build Fails During Notarization

**Symptoms**: "Invalid" status from Apple notarization service

**Causes**:
- Unsigned binaries in DMG
- Invalid entitlements
- Network connectivity issues

**Solutions**:
```bash
# Get detailed error log
xcrun notarytool log [SUBMISSION_ID] \
  --apple-id "$APPLE_ID" \
  --password "$APPLE_APP_SPECIFIC_PASSWORD" \
  --team-id "$APPLE_TEAM_ID"

# Common fix: ensure clean DMG
yarn build:dmg
```

### Diagnostic Tools

#### Built-in Diagnostic Script
```bash
# Comprehensive system check
./scripts/diagnose-distribution-issues.sh

# Checks:
# - Code signature validity
# - Notarization status
# - Binary functionality
# - Common security issues
```

#### Manual Verification Commands
```bash
# Check signing identity
security find-identity -v -p codesigning

# Verify app signature
codesign --display --verbose=4 out/Downlodr-darwin-arm64/Downlodr.app

# Test Gatekeeper
spctl --assess --verbose --type execute out/Downlodr-darwin-arm64/Downlodr.app

# Check binary permissions
ls -la out/Downlodr-darwin-arm64/Downlodr.app/Contents/Resources/
```

### Performance Optimization

#### Build Speed Optimization
```bash
# Parallel builds (if system supports)
export ELECTRON_BUILDER_COMPRESSION_LEVEL=1

# Skip unnecessary validations during development
export SKIP_CODE_SIGNING=true  # Development only!
```

#### File Size Optimization
```bash
# The build system automatically:
# - Excludes development files
# - Compresses DMG with optimal settings
# - Removes unnecessary binaries
```

## Advanced Configuration

### Custom Entitlements

#### App Entitlements
Edit `entitlements-production.plist`:
```xml
<!-- Minimal required entitlements -->
<key>com.apple.security.cs.allow-jit</key>
<true/>
<key>com.apple.security.cs.allow-unsigned-executable-memory</key>
<true/>
<key>com.apple.security.network.client</key>
<true/>
```

#### Binary Entitlements
Edit `yt-dlp-entitlements.plist`:
```xml
<!-- Network access for yt-dlp -->
<key>com.apple.security.network.client</key>
<true/>
<key>com.apple.security.cs.allow-subprocess</key>
<true/>
```

### DMG Customization

#### Visual Customization
Modify `scripts/build-with-create-dmg.sh`:
```bash
create-dmg \
    --volname "Custom Name" \
    --volicon "path/to/custom/icon.icns" \
    --window-pos 200 120 \
    --window-size 900 600 \
    --icon-size 128 \
    --background "path/to/background.png"
```

#### Content Customization
```bash
# Add additional files to DMG
cp README.txt "$DMG_SOURCE_DIR/"
cp LICENSE.txt "$DMG_SOURCE_DIR/"
```

### CI/CD Integration

#### GitHub Actions Example
```yaml
name: Build macOS Release

on:
  push:
    tags: ['v*']

jobs:
  build-macos:
    runs-on: macos-latest
    
    steps:
    - uses: actions/checkout@v3
    
    - name: Setup Node.js
      uses: actions/setup-node@v3
      with:
        node-version: '18'
        cache: 'yarn'
    
    - name: Install dependencies
      run: yarn install --frozen-lockfile
    
    - name: Setup signing
      env:
        APPLE_IDENTITY: ${{ secrets.APPLE_IDENTITY }}
        APPLE_ID: ${{ secrets.APPLE_ID }}
        APPLE_APP_SPECIFIC_PASSWORD: ${{ secrets.APPLE_APP_SPECIFIC_PASSWORD }}
        APPLE_TEAM_ID: ${{ secrets.APPLE_TEAM_ID }}
      run: |
        echo "APPLE_IDENTITY=$APPLE_IDENTITY" >> .env
        echo "APPLE_ID=$APPLE_ID" >> .env
        echo "APPLE_APP_SPECIFIC_PASSWORD=$APPLE_APP_SPECIFIC_PASSWORD" >> .env
        echo "APPLE_TEAM_ID=$APPLE_TEAM_ID" >> .env
    
    - name: Build and sign
      run: yarn build:dmg
    
    - name: Upload release assets
      uses: actions/upload-artifact@v3
      with:
        name: macos-dmg
        path: out/make/*.dmg
```

### Security Best Practices

#### Certificate Management
- Store certificates in Keychain Access
- Use separate certificates for development/production
- Regularly renew certificates before expiration
- Never commit certificates to version control

#### Environment Security
- Use environment variables for sensitive data
- Rotate app-specific passwords regularly
- Limit access to signing certificates
- Use separate Apple IDs for different projects

#### Distribution Security
- Always verify DMG integrity before distribution
- Use HTTPS for download links
- Provide checksums for verification
- Monitor for unauthorized distribution

## Support and Resources

### Apple Documentation
- [Code Signing Guide](https://developer.apple.com/library/archive/documentation/Security/Conceptual/CodeSigningGuide/)
- [Notarization Guide](https://developer.apple.com/documentation/security/notarizing_macos_software_before_distribution)
- [App Distribution Guide](https://help.apple.com/xcode/mac/current/#/dev8b4250b57)

### Third-Party Tools
- [create-dmg Documentation](https://github.com/create-dmg/create-dmg)
- [Electron Forge Documentation](https://www.electronforge.io/)
- [Electron Builder Comparison](https://www.electronforge.io/guides/framework-integration)

### Community Resources
- [Electron Discord](https://discord.gg/electron)
- [Stack Overflow electron-forge](https://stackoverflow.com/questions/tagged/electron-forge)
- [Apple Developer Forums](https://developer.apple.com/forums/)

---

**Document Version**: 1.0  
**Last Updated**: August 13, 2025  
**Compatible With**: Downlodr v1.7.2+
