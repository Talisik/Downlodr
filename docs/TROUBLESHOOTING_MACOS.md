# macOS Distribution Troubleshooting Guide

## Overview

This guide provides solutions to common issues encountered when building and distributing Downlodr for macOS. It includes real-world problems we've solved and their proven solutions.

## Table of Contents

- [Security Warning Issues](#security-warning-issues)
- [Password Prompt Issues](#password-prompt-issues)
- [Video Playback Issues](#video-playback-issues)
- [Build and Signing Issues](#build-and-signing-issues)
- [Notarization Issues](#notarization-issues)
- [Distribution Issues](#distribution-issues)
- [Diagnostic Tools](#diagnostic-tools)

## Security Warning Issues

### Issue: "Move to Trash" Warning on First Launch

#### Symptoms
- Users see dialog: "Downlodr is an app downloaded from the Internet. Are you sure you want to open it?"
- Option to "Move to Trash" instead of normal "Open" button
- App appears untrusted to macOS

#### Root Causes
1. **DMG not properly notarized**
   - App bundle signed but DMG itself missing signature
   - Loose files in DMG root causing notarization failure
   - Stapling process failed

2. **Corrupted download**
   - DMG damaged during transfer
   - Incomplete download
   - Network issues during download

3. **Incorrect distribution**
   - Distributing unsigned development build
   - Using wrong DMG file

#### Solutions

##### Quick Diagnosis
```bash
# Check DMG notarization status
spctl --assess --verbose --type install out/make/Downlodr-*.dmg

# Expected: "accepted source=Notarized Developer ID"
# Problem:  "rejected" or "source=no usable signature"
```

##### Solution 1: Rebuild with Proper Notarization
```bash
# Clean rebuild with enhanced pipeline
yarn build:dmg

# Verify result
spctl --assess --verbose --type install out/make/Downlodr-*.dmg
```

##### Solution 2: Manual DMG Fix
```bash
# If you have a working app bundle but broken DMG
./scripts/test-create-dmg.sh

# Then submit for notarization
xcrun notarytool submit out/make/Downlodr-*-test-*.dmg \
  --apple-id "$APPLE_ID" \
  --password "$APPLE_APP_SPECIFIC_PASSWORD" \
  --team-id "$APPLE_TEAM_ID" \
  --wait
```

#### Prevention
- Always use `yarn build:dmg` for distribution builds
- Verify DMG before distribution with `spctl --assess`
- Test downloads on different networks
- Provide checksums for integrity verification

### Issue: Gatekeeper Assessment Failure

#### Symptoms
- `spctl --assess` returns "rejected"
- Users can't run app even with "Open Anyway"
- Console shows Gatekeeper violations

#### Root Causes
- Missing code signatures on external binaries
- Invalid entitlements
- Expired certificates

#### Solutions
```bash
# Comprehensive diagnosis
./scripts/diagnose-distribution-issues.sh

# Re-sign all components
./scripts/fix-binary-signing.sh

# Verify signatures
codesign --verify --deep --strict out/Downlodr-darwin-arm64/Downlodr.app
```

## Password Prompt Issues

### Issue: Keychain Password Prompts

#### Symptoms
- macOS requests user password when launching app
- Multiple password prompts during app startup
- App functionality broken after password denial

#### Root Causes
1. **Problematic entitlements**
   - `com.apple.security.cs.disable-library-validation` set to true
   - Debug entitlements in production build
   - Excessive permissions triggering keychain access

2. **Unsigned external binaries**
   - yt-dlp or FFmpeg not properly signed
   - Missing hardened runtime on binaries
   - Binaries trying to access system resources

#### Solutions

##### Immediate Fix
```bash
# Check for problematic entitlements
./scripts/diagnose-distribution-issues.sh

# Look for warnings about entitlements:
# ⚠️ Found potentially problematic entitlement: com.apple.security.cs.disable-library-validation
```

##### Long-term Solution
```bash
# Use production entitlements
cp entitlements-minimal.plist entitlements.plist

# Rebuild with safer entitlements
yarn build:dmg
```

##### Verify External Binary Signatures
```bash
# Check yt-dlp signing
codesign --verify --verbose=2 \
  out/Downlodr-darwin-arm64/Downlodr.app/Contents/Resources/yt-dlp_macos

# Check FFmpeg signing
codesign --verify --verbose=2 \
  out/Downlodr-darwin-arm64/Downlodr.app/Contents/Resources/ffmpeg-arm64
```

#### Entitlement Best Practices

##### Safe Entitlements (Minimal Set)
```xml
<!-- entitlements-minimal.plist -->
<key>com.apple.security.cs.allow-jit</key>
<true/>  <!-- Required for Electron -->

<key>com.apple.security.cs.allow-unsigned-executable-memory</key>
<true/>  <!-- Required for V8 engine -->

<key>com.apple.security.network.client</key>
<true/>  <!-- Required for downloads -->

<key>com.apple.security.files.user-selected.read-write</key>
<true/>  <!-- Required for file access -->

<!-- AVOID these in production: -->
<!-- com.apple.security.cs.disable-library-validation - causes keychain prompts -->
<!-- com.apple.security.cs.debugger - development only -->
```

## Video Playback Issues

### Issue: Downloaded Videos Not Playable

#### Symptoms
- Downloads complete but videos won't play
- Video files appear corrupted
- Conversion processes fail
- FFmpeg errors in console

#### Root Causes
1. **FFmpeg binaries blocked**
   - Gatekeeper preventing execution
   - Missing execute permissions
   - Unsigned binaries

2. **Binary corruption**
   - Signing process corrupted binary
   - Wrong FFmpeg version for architecture
   - Missing dependencies

#### Solutions

##### Quick Diagnosis
```bash
# Test FFmpeg functionality
out/Downlodr-darwin-arm64/Downlodr.app/Contents/Resources/ffmpeg-arm64 -version

# Should show FFmpeg version and build info
# If fails: binary is blocked or corrupted
```

##### Solution 1: Re-sign FFmpeg
```bash
# Re-sign all FFmpeg binaries
./scripts/fix-binary-signing.sh

# Test after signing
out/Downlodr-darwin-arm64/Downlodr.app/Contents/Resources/ffmpeg-arm64 -version
```

##### Solution 2: Check Binary Architecture
```bash
# Verify binary architecture matches system
file out/Downlodr-darwin-arm64/Downlodr.app/Contents/Resources/ffmpeg-arm64

# Should show: Mach-O 64-bit executable arm64
```

##### Solution 3: Manual Binary Replacement
```bash
# If binaries are corrupted, replace with fresh copies
# Download from: https://evermeet.cx/ffmpeg/
# Place in: out/Downlodr-darwin-arm64/Downlodr.app/Contents/Resources/

# Re-sign after replacement
./scripts/fix-binary-signing.sh
```

## Build and Signing Issues

### Issue: Build Fails During Packaging

#### Symptoms
- `yarn build:dmg` stops during packaging phase
- Electron Forge errors
- Missing dependencies

#### Solutions
```bash
# Clean install dependencies
rm -rf node_modules yarn.lock
yarn install

# Clean Electron cache
yarn cache clean
npx electron-rebuild

# Retry build
yarn build:dmg
```

### Issue: Code Signing Failures

#### Symptoms
- "No identity found" errors
- Certificate not found
- Signing process hangs

#### Root Causes
- Certificate not installed in Keychain
- Wrong certificate name in environment
- Expired certificates
- Keychain locked

#### Solutions

##### Verify Certificates
```bash
# List available signing identities
security find-identity -v -p codesigning

# Should show your Developer ID certificate
# If empty: install certificate in Keychain Access
```

##### Fix Keychain Issues
```bash
# Unlock keychain
security unlock-keychain ~/Library/Keychains/login.keychain-db

# Import certificate (if needed)
security import YourCertificate.p12 -k ~/Library/Keychains/login.keychain-db
```

##### Update Environment
```bash
# Verify .env file has correct identity name
grep APPLE_IDENTITY .env

# Should match certificate exactly:
# APPLE_IDENTITY="Developer ID Application: Your Name (TEAM123456)"
```

## Notarization Issues

### Issue: Notarization Returns "Invalid" Status

#### Symptoms
- Apple notarization service rejects submission
- Status shows "Invalid" instead of "Accepted"
- Build process fails at notarization step

#### Root Causes
1. **Unsigned binaries in package**
   - External binaries not signed with Developer ID
   - Missing hardened runtime on binaries
   - Loose files in DMG

2. **Invalid entitlements**
   - Conflicting entitlement values
   - Missing required entitlements
   - Development entitlements in production

#### Solutions

##### Get Detailed Error Information
```bash
# Find submission ID from build log, then:
xcrun notarytool log [SUBMISSION_ID] \
  --apple-id "$APPLE_ID" \
  --password "$APPLE_APP_SPECIFIC_PASSWORD" \
  --team-id "$APPLE_TEAM_ID"

# Look for specific error messages
```

##### Common Notarization Errors and Fixes

**Error: "The binary is not signed with a valid Developer ID certificate"**
```bash
# Solution: Re-sign with proper certificate
./scripts/fix-binary-signing.sh
```

**Error: "The executable does not have the hardened runtime enabled"**
```bash
# Solution: Add --options runtime to signing
# Already fixed in our scripts
```

**Error: "The signature does not include a secure timestamp"**
```bash
# Solution: Add --timestamp to signing
# Already fixed in our scripts
```

**Error: Archive contains critical validation errors**
```bash
# Solution: Check for loose files in DMG
# Fixed by cleaning DMG source in build script
```

### Issue: Stapling Fails (Error 65)

#### Symptoms
- Notarization succeeds but stapling fails
- "Could not find base64 encoded ticket" error
- Error 65 during staple process

#### Root Cause
- Apple's servers may not have the ticket ready immediately
- Network connectivity issues
- DMG file corruption

#### Solutions
```bash
# Wait and retry stapling
sleep 300  # Wait 5 minutes
xcrun stapler staple out/make/Downlodr-*.dmg

# Verify stapling worked
xcrun stapler validate out/make/Downlodr-*.dmg
```

#### Note on Stapling
**Stapling failure is often non-critical.** The app is still notarized and will work correctly. Stapling just embeds the notarization ticket for offline verification.

## Distribution Issues

### Issue: Large File Sizes

#### Symptoms
- DMG files larger than expected
- Slow downloads for users
- Storage limitations

#### Solutions
```bash
# Check what's consuming space
du -sh out/Downlodr-darwin-arm64/Downlodr.app/*

# Optimize build
export ELECTRON_BUILDER_COMPRESSION_LEVEL=9
yarn build:dmg
```

### Issue: Download Corruption

#### Symptoms
- Users report corrupted downloads
- DMG won't mount
- Checksum mismatches

#### Solutions
```bash
# Generate checksums for verification
shasum -a 256 out/make/Downlodr-*.dmg > checksums.txt

# Provide checksums to users for verification
cat checksums.txt
```

## Diagnostic Tools

### Built-in Diagnostic Script

Our comprehensive diagnostic tool checks all common issues:

```bash
# Run complete diagnostic
./scripts/diagnose-distribution-issues.sh

# Checks:
# ✅ Code signature validity
# ✅ Notarization status  
# ✅ Binary functionality
# ✅ Security compliance
# ✅ Common configuration issues
```

### Manual Verification Commands

#### Security Verification
```bash
# Check app signature
codesign --verify --deep --strict out/Downlodr-darwin-arm64/Downlodr.app

# Check notarization
spctl --assess --verbose --type execute out/Downlodr-darwin-arm64/Downlodr.app

# Check DMG
spctl --assess --verbose --type install out/make/Downlodr-*.dmg
```

#### Binary Functionality
```bash
# Test yt-dlp
out/Downlodr-darwin-arm64/Downlodr.app/Contents/Resources/yt-dlp_macos --version

# Test FFmpeg
out/Downlodr-darwin-arm64/Downlodr.app/Contents/Resources/ffmpeg-arm64 -version
```

#### Environment Verification
```bash
# Check certificates
security find-identity -v -p codesigning

# Check environment
echo "Identity: $APPLE_IDENTITY"
echo "Team ID: $APPLE_TEAM_ID"

# Test notarization credentials
xcrun notarytool history \
  --apple-id "$APPLE_ID" \
  --password "$APPLE_APP_SPECIFIC_PASSWORD" \
  --team-id "$APPLE_TEAM_ID" \
  --limit 1
```

### Debugging Build Process

#### Verbose Logging
```bash
# Enable detailed logging
export DEBUG=electron-forge:*
yarn build:dmg

# Check build logs for issues
```

#### Step-by-Step Debugging
```bash
# Run individual steps
yarn package                           # 1. Package only
./scripts/fix-binary-signing.sh       # 2. Sign binaries  
./scripts/test-create-dmg.sh          # 3. Create test DMG
```

## Quick Reference

### Emergency Fixes

#### App Won't Launch (Security Issues)
```bash
# Quick fix for most security issues
yarn build:dmg
```

#### Password Prompts
```bash
# Use minimal entitlements
cp entitlements-minimal.plist entitlements.plist
yarn build:dmg
```

#### Videos Won't Play
```bash
# Re-sign FFmpeg binaries
./scripts/fix-binary-signing.sh
```

#### DMG Not Notarized
```bash
# Check for loose files, then rebuild
ls -la out/Downlodr-darwin-arm64/
yarn build:dmg
```

### Support Contacts

#### Apple Developer Support
- [Developer Forums](https://developer.apple.com/forums/)
- [Technical Support](https://developer.apple.com/support/)
- [Code Signing Documentation](https://developer.apple.com/documentation/security/code_signing_services)

#### Community Resources
- [Electron Discord](https://discord.gg/electron)
- [Stack Overflow](https://stackoverflow.com/questions/tagged/electron-forge)
- [GitHub Issues](https://github.com/electron/forge/issues)

---

**Last Updated**: August 13, 2025  
**Version**: 1.0  
**Tested With**: Downlodr v1.7.2, macOS Sequoia 15.0
