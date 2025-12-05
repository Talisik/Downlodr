# Quick Start: GitHub Actions for macOS Builds

> **Goal:** Get automated macOS builds running in 30 minutes

## ⚡ Fast Track Setup

### Step 1: Prerequisites (5 minutes)

**You need:**
- [ ] Apple Developer Account ($99/year)
- [ ] Developer ID Application certificate
- [ ] Developer ID Installer certificate
- [ ] macOS machine (for setup only)

**Don't have certificates?**
1. Go to: https://developer.apple.com/account/resources/certificates
2. Create "Developer ID Application" certificate
3. Create "Developer ID Installer" certificate
4. Install both on your Mac

### Step 2: Run Setup Script (10 minutes)

```bash
# Clone your repo (if not already done)
cd Downlodr

# Run the setup helper
./scripts/setup-github-secrets.sh
```

**The script will:**
- ✅ Find your certificates
- ✅ Extract your Team ID
- ✅ Convert certificate to base64
- ✅ Generate keychain password
- ✅ Test notarization credentials
- ✅ Create summary file with all values

**Follow prompts to:**
1. Export certificate as .p12
2. Enter Apple ID
3. Enter app-specific password (create at: https://appleid.apple.com)

**Output:** `~/Desktop/github-secrets-summary.txt` with all values

### Step 3: Add Secrets to GitHub (10 minutes)

1. **Go to GitHub:**
   ```
   https://github.com/YOUR_USERNAME/Downlodr/settings/secrets/actions
   ```

2. **Click "New repository secret"**

3. **Add these 8 secrets** (get values from `~/Desktop/github-secrets-summary.txt`):

   | Secret Name | Where to Get Value |
   |------------|-------------------|
   | `MACOS_CERTIFICATE` | ~/Desktop/certificate-base64.txt (also in clipboard) |
   | `MACOS_CERTIFICATE_PWD` | Password you set when exporting .p12 |
   | `KEYCHAIN_PASSWORD` | ~/Desktop/keychain-password.txt |
   | `APPLE_IDENTITY` | From summary file |
   | `APPLE_INSTALLER_IDENTITY` | From summary file |
   | `APPLE_ID` | Your Apple ID email |
   | `APPLE_PASSWORD` | App-specific password from appleid.apple.com |
   | `APPLE_TEAM_ID` | From summary file |

4. **Verify all 8 secrets added**

### Step 4: Enable Workflow Permissions (2 minutes)

1. Go to: `https://github.com/YOUR_USERNAME/Downlodr/settings/actions`
2. Scroll to "Workflow permissions"
3. Select: **"Read and write permissions"**
4. Check: **"Allow GitHub Actions to create and approve pull requests"**
5. Click **"Save"**

### Step 5: Test Build (3 minutes + 30 min build)

```bash
# Create test tag
git tag -a v1.8.0-test -m "Test GitHub Actions build"

# Push tag (this triggers the workflow)
git push origin v1.8.0-test
```

**Watch progress:**
```
https://github.com/YOUR_USERNAME/Downlodr/actions
```

**Expected time:** ~30-35 minutes

**Success indicators:**
- ✅ Build completed (green checkmark)
- ✅ GitHub Release created
- ✅ 6 artifacts uploaded (2 PKG, 2 DMG, 2 ZIP)
- ✅ Release notes generated

### Step 6: Verify (5 minutes)

1. **Check release page:**
   ```
   https://github.com/YOUR_USERNAME/Downlodr/releases
   ```

2. **Download and test:**
   - Download the PKG for your Mac
   - Install it
   - Launch app
   - Verify no Gatekeeper warnings

3. **Verify signature:**
   ```bash
   pkgutil --check-signature ~/Downloads/Downlodr-*.pkg
   spctl -a -v --type install ~/Downloads/Downlodr-*.pkg
   ```

## ✅ Setup Complete!

You're now ready to create releases automatically!

## 🚀 Creating Future Releases

```bash
# 1. Update version
npm version patch  # 1.7.10 → 1.7.11

# 2. Commit and push
git push origin main

# 3. Create tag
git tag -a v1.8.0 -m "Release version 1.8.0"
git push origin v1.8.0

# Done! ✨
# GitHub Actions will build, sign, notarize, and release automatically
```

## 🐛 Troubleshooting

### Script can't find certificates
```bash
# Check certificates in keychain
security find-identity -v -p codesigning

# Look for "Developer ID Application" and "Developer ID Installer"
# If missing, create them at: developer.apple.com
```

### Notarization failed
```bash
# Test credentials
xcrun notarytool history \
  --apple-id "your@email.com" \
  --password "app-specific-password" \
  --team-id "YOUR_TEAM_ID"

# If fails, create new app-specific password at:
# https://appleid.apple.com
```

### Build succeeds but no release created
1. Check: Settings → Actions → General
2. Ensure "Read and write permissions" selected
3. Re-run workflow

### Need help?
- **Full guide:** `docs/GITHUB_ACTIONS_SETUP.md`
- **Quick guide:** `docs/QUICK_RELEASE_GUIDE.md`
- **Summary:** `GITHUB_ACTIONS_IMPLEMENTATION_SUMMARY.md`

## 📚 What You Get

After setup, every tag push creates:
- ✅ Signed and notarized macOS app
- ✅ Both Apple Silicon and Intel builds
- ✅ PKG installers (recommended)
- ✅ DMG images
- ✅ ZIP archives
- ✅ GitHub Release with notes
- ✅ Automatic upload of all artifacts

**Time saved per release:** ~1.5 hours

**Manual steps required:** 1 (push tag)

## 🎉 Success!

You now have enterprise-grade automated builds!

**Next release:**
```bash
git tag -a v1.9.0 -m "New features"
git push origin v1.9.0
```

Then sit back and watch the magic! ✨

