# GitHub Actions Setup for macOS Build, Code Signing, and Notarization

This guide walks you through setting up automated macOS builds with code signing, notarization, and GitHub Releases.

## 📋 Table of Contents

1. [Prerequisites](#prerequisites)
2. [Apple Developer Setup](#apple-developer-setup)
3. [GitHub Secrets Configuration](#github-secrets-configuration)
4. [Workflow Usage](#workflow-usage)
5. [Troubleshooting](#troubleshooting)

## Prerequisites

### Required Accounts
- ✅ Apple Developer Account ($99/year)
- ✅ GitHub Account with repo access
- ✅ macOS machine for initial certificate export

### Required Software
- Xcode Command Line Tools
- Valid Apple Developer Certificate
- App-specific password for notarization

## Apple Developer Setup

### Step 1: Create Certificates

1. **Go to Apple Developer Portal**
   - Visit: https://developer.apple.com/account/resources/certificates
   - Sign in with your Apple Developer account

2. **Create Developer ID Application Certificate**
   - Click the "+" button to create a new certificate
   - Select "Developer ID Application"
   - Follow the wizard to create a Certificate Signing Request (CSR)
   - Download the certificate when ready

3. **Create Developer ID Installer Certificate** (for PKG files)
   - Click the "+" button again
   - Select "Developer ID Installer"
   - Follow the wizard with a new CSR
   - Download the certificate

### Step 2: Export Certificates from Keychain

On your macOS machine:

```bash
# 1. Open Keychain Access app
open -a "Keychain Access"

# 2. Find your Developer ID Application certificate
# 3. Right-click → Export "Developer ID Application: Your Name"
# 4. Save as .p12 file with a strong password
# 5. Note this password - you'll need it for GitHub secrets
```

**Export both certificates:**
- Developer ID Application (for code signing)
- Developer ID Installer (for PKG signing)

### Step 3: Get Certificate Details

```bash
# Find your certificate identity name
security find-identity -v -p codesigning

# Output will show something like:
# 1) ABCD1234... "Developer ID Application: Your Name (TEAM_ID)"

# Note the full identity string in quotes
```

### Step 4: Create App-Specific Password

For notarization, you need an app-specific password:

1. Go to: https://appleid.apple.com/account/manage
2. Sign in with your Apple ID
3. Navigate to "Security" → "App-Specific Passwords"
4. Click "Generate Password"
5. Label it "GitHub Actions Notarization"
6. **Save this password** - you'll need it for `APPLE_PASSWORD` secret

### Step 5: Get Your Team ID

```bash
# Find your Team ID
xcrun altool --list-providers -u "your-apple-id@email.com" -p "your-app-specific-password"

# Or find it at: https://developer.apple.com/account
# Click on "Membership" - Team ID is displayed there
```

## GitHub Secrets Configuration

### Required Secrets

Navigate to your GitHub repository:
**Settings → Secrets and variables → Actions → New repository secret**

Add the following secrets:

#### 1. `MACOS_CERTIFICATE`
```bash
# Convert your .p12 certificate to base64
base64 -i /path/to/certificate.p12 | pbcopy

# The base64 string is now in your clipboard
# Paste it as the secret value in GitHub
```

**Value:** Base64-encoded .p12 certificate file

#### 2. `MACOS_CERTIFICATE_PWD`
**Value:** The password you used when exporting the .p12 certificate

#### 3. `KEYCHAIN_PASSWORD`
**Value:** A strong random password for the temporary keychain
```bash
# Generate a random password
openssl rand -base64 32
```

#### 4. `APPLE_IDENTITY`
**Value:** Your Developer ID Application certificate name
```
Example: "Developer ID Application: John Doe (ABC123XYZ)"
```

To find this:
```bash
security find-identity -v -p codesigning
```

#### 5. `APPLE_INSTALLER_IDENTITY`
**Value:** Your Developer ID Installer certificate name
```
Example: "Developer ID Installer: John Doe (ABC123XYZ)"
```

#### 6. `APPLE_ID`
**Value:** Your Apple ID email
```
Example: developer@example.com
```

#### 7. `APPLE_PASSWORD`
**Value:** The app-specific password you generated earlier
```
Example: abcd-efgh-ijkl-mnop
```

#### 8. `APPLE_TEAM_ID`
**Value:** Your Apple Developer Team ID
```
Example: ABC123XYZ
```

### Secrets Summary Table

| Secret Name | Description | How to Get |
|------------|-------------|------------|
| `MACOS_CERTIFICATE` | Base64-encoded .p12 certificate | Export from Keychain, convert to base64 |
| `MACOS_CERTIFICATE_PWD` | Password for .p12 file | Password you set during export |
| `KEYCHAIN_PASSWORD` | Temporary keychain password | Generate random password |
| `APPLE_IDENTITY` | Code signing identity | `security find-identity -v -p codesigning` |
| `APPLE_INSTALLER_IDENTITY` | PKG signing identity | Same as above, but for Installer certificate |
| `APPLE_ID` | Apple Developer email | Your Apple ID |
| `APPLE_PASSWORD` | App-specific password | Generate at appleid.apple.com |
| `APPLE_TEAM_ID` | Developer Team ID | Find in Apple Developer portal |

## Workflow Usage

### Automatic Triggers

The workflow automatically runs when you push a tag:

```bash
# Create and push a release tag
git tag -a v1.8.0 -m "Release version 1.8.0"
git push origin v1.8.0

# The workflow will automatically:
# 1. Build for both arm64 and x64
# 2. Sign the applications
# 3. Notarize with Apple
# 4. Create a GitHub Release
# 5. Upload all artifacts
```

### Manual Triggers

You can also trigger builds manually:

1. Go to **Actions** tab in GitHub
2. Select **Build and Release macOS** workflow
3. Click **Run workflow**
4. Choose options:
   - **Create GitHub Release:** Yes/No
   - **Architecture:** both, arm64, or x64
5. Click **Run workflow**

### Testing Without Release

To test the build without creating a release:

1. Trigger manually (as above)
2. Set "Create GitHub Release" to `false`
3. Artifacts will be available in the workflow run page

## Workflow Outputs

### Successful Build

After a successful run, you'll get:

#### GitHub Release
- Automatically created with tag
- Contains all build artifacts
- Includes release notes
- Links to changelog

#### Artifacts
- `Downlodr-darwin-arm64-*.pkg` - Apple Silicon installer
- `Downlodr-darwin-x64-*.pkg` - Intel installer
- `Downlodr-darwin-arm64-*.dmg` - Apple Silicon DMG
- `Downlodr-darwin-x64-*.dmg` - Intel DMG
- `Downlodr-darwin-*.zip` - Portable archives

### Build Time

Typical build times:
- Single architecture: ~15-20 minutes
- Both architectures: ~30-35 minutes

Breakdown:
- Setup and dependencies: ~3 minutes
- Build and package: ~8-12 minutes per architecture
- Code signing: ~1-2 minutes
- Notarization: ~3-8 minutes (Apple's processing time)

## Troubleshooting

### Common Issues

#### ❌ Certificate Import Failed

**Error:** `security: SecKeychainItemImport: MAC verification failed`

**Solution:**
1. Verify the base64 encoding is correct
2. Check the certificate password
3. Ensure the .p12 file is valid

```bash
# Test locally
openssl pkcs12 -info -in certificate.p12 -nodes
```

#### ❌ Code Signing Failed

**Error:** `errSecInternalComponent` or identity not found

**Solution:**
1. Verify `APPLE_IDENTITY` matches exactly:
```bash
security find-identity -v -p codesigning
```
2. Ensure certificate is valid and not expired
3. Check that the certificate is "Developer ID Application"

#### ❌ Notarization Failed

**Error:** `Error: Unable to notarize app`

**Solutions:**

**Invalid Credentials:**
```bash
# Test notarization credentials locally
xcrun notarytool history --apple-id "your-id" --password "your-password" --team-id "your-team-id"
```

**App-Specific Password:**
- Ensure you're using app-specific password, not your Apple ID password
- Generate new one at: https://appleid.apple.com

**Team ID Mismatch:**
- Verify Team ID matches your certificate
- Check at: https://developer.apple.com/account

#### ❌ Notarization Timeout

**Error:** Notarization takes too long or times out

**Solution:**
- This is usually Apple server-side processing
- The workflow waits automatically
- Check notarization status:
```bash
xcrun notarytool history --apple-id "your-id" --password "your-password" --team-id "your-team-id"
```

#### ❌ Release Creation Failed

**Error:** `Resource not accessible by integration`

**Solution:**
1. Go to **Settings → Actions → General**
2. Under "Workflow permissions"
3. Select "Read and write permissions"
4. Check "Allow GitHub Actions to create and approve pull requests"
5. Save changes

### Verification Commands

#### Verify Certificate Setup
```bash
# List available signing identities
security find-identity -v -p codesigning

# Check certificate validity
security find-certificate -c "Developer ID Application" -p | openssl x509 -text | grep "Not After"
```

#### Verify Notarization
```bash
# Check notarization ticket
xcrun stapler validate /path/to/Downlodr.pkg

# Check Gatekeeper assessment
spctl -a -v --type install /path/to/Downlodr.pkg
```

#### Verify Build Locally
```bash
# Test the same build process locally
APPLE_IDENTITY="Your Identity" \
APPLE_ID="your@email.com" \
APPLE_PASSWORD="app-specific-pass" \
APPLE_TEAM_ID="TEAM123" \
yarn make --arch=arm64 --platform=darwin
```

### Getting Help

If you encounter issues:

1. **Check workflow logs**
   - Go to Actions tab
   - Click on failed workflow run
   - Review each step's output

2. **Verify secrets**
   - Settings → Secrets → Actions
   - Ensure all 8 secrets are set
   - Re-generate if unsure

3. **Test locally**
   - Export the same environment variables
   - Run build commands manually
   - This helps isolate GitHub-specific issues

4. **Apple Developer Status**
   - Check: https://developer.apple.com/system-status/
   - Notarization service disruptions are rare but possible

## Security Best Practices

### Secrets Management
- ✅ Never commit secrets to repository
- ✅ Use GitHub encrypted secrets
- ✅ Rotate passwords regularly
- ✅ Use app-specific passwords
- ✅ Limit secret access to necessary workflows

### Certificate Security
- ✅ Store .p12 files securely offline
- ✅ Use strong passwords for .p12 export
- ✅ Don't share certificates between developers
- ✅ Revoke compromised certificates immediately
- ✅ Monitor certificate expiration dates

### Access Control
- ✅ Limit who can trigger workflows
- ✅ Review workflow runs regularly
- ✅ Enable branch protection rules
- ✅ Require PR reviews for workflow changes

## Maintenance

### Certificate Renewal

Apple Developer certificates expire after 5 years:

1. **Monitor expiration:**
```bash
security find-certificate -c "Developer ID Application" -p | openssl x509 -text | grep "Not After"
```

2. **Renew before expiration:**
   - Create new certificate in Apple Developer portal
   - Export new .p12 file
   - Update GitHub secret `MACOS_CERTIFICATE`
   - Update `APPLE_IDENTITY` if name changed

3. **Test new certificate:**
   - Trigger manual workflow run
   - Verify builds succeed
   - Test installation on clean macOS

### Workflow Updates

Keep workflow up to date:
- Monitor for Electron Forge updates
- Check GitHub Actions deprecation notices
- Update action versions regularly
- Test changes in separate branch first

## Resources

### Official Documentation
- [Apple Notarization Guide](https://developer.apple.com/documentation/security/notarizing_macos_software_before_distribution)
- [Electron Forge Code Signing](https://www.electronforge.io/guides/code-signing)
- [GitHub Actions Docs](https://docs.github.com/en/actions)

### Useful Links
- [Apple Developer Portal](https://developer.apple.com/account)
- [Apple System Status](https://developer.apple.com/system-status/)
- [GitHub Actions Status](https://www.githubstatus.com/)

### Support
- GitHub Issues: https://github.com/YOUR_USERNAME/Downlodr/issues
- Electron Forge Discord: https://discord.gg/electronforge

---

## Quick Start Checklist

Use this checklist to set up GitHub Actions:

- [ ] Apple Developer Account active
- [ ] Developer ID Application certificate created
- [ ] Developer ID Installer certificate created
- [ ] Certificates exported as .p12 files
- [ ] App-specific password generated
- [ ] Team ID obtained
- [ ] All 8 GitHub secrets configured
- [ ] Workflow file added to repository
- [ ] Test tag pushed
- [ ] First build successful
- [ ] Notarization verified
- [ ] GitHub Release created
- [ ] Artifacts downloadable and installable

**Time to complete:** Approximately 30-45 minutes

**Next steps:** Once setup is complete, simply push tags to trigger automated builds!

```bash
# Create release
git tag -a v1.8.0 -m "Release 1.8.0"
git push origin v1.8.0

# Sit back and watch the magic! ✨
```

