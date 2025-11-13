# Quick Release Guide

## 🚀 Creating a New Release

### Prerequisites
- ✅ GitHub Actions secrets configured ([Setup Guide](./GITHUB_ACTIONS_SETUP.md))
- ✅ All changes committed and pushed
- ✅ Tests passing locally

### Release Process

#### 1. Update Version Number

```bash
# Update version in package.json
npm version patch  # For bug fixes (1.7.10 → 1.7.11)
npm version minor  # For new features (1.7.10 → 1.8.0)
npm version major  # For breaking changes (1.7.10 → 2.0.0)
```

#### 2. Update Changelog

Add release notes to `CHANGELOG.md`:

```markdown
## [1.8.0] - 2024-01-15

### Added
- New feature X
- Enhancement Y

### Fixed
- Bug fix Z

### Changed
- Improvement to W
```

#### 3. Commit and Push

```bash
git add package.json CHANGELOG.md
git commit -m "Release v1.8.0"
git push origin main
```

#### 4. Create and Push Tag

```bash
# Create annotated tag
git tag -a v1.8.0 -m "Release version 1.8.0"

# Push tag to trigger build
git push origin v1.8.0
```

**That's it!** GitHub Actions will automatically:
- ✅ Build for both architectures
- ✅ Sign the applications
- ✅ Notarize with Apple
- ✅ Create GitHub Release
- ✅ Upload all artifacts

#### 5. Monitor Build

1. Go to **Actions** tab in GitHub
2. Watch the "Build and Release macOS" workflow
3. Build takes ~30-35 minutes

### Manual Release (Alternative)

If you prefer manual control:

1. Go to **Actions** tab
2. Select **Build and Release macOS**
3. Click **Run workflow**
4. Configure options:
   - Branch: `main`
   - Create GitHub Release: `true`
   - Architecture: `both`
5. Click **Run workflow**

## 📦 Build Outputs

After successful build, check your release at:
```
https://github.com/YOUR_USERNAME/Downlodr/releases/latest
```

### Available Artifacts

#### PKG Installers (Recommended)
- `Downlodr-darwin-arm64-*.pkg` - Apple Silicon (M1/M2/M3)
- `Downlodr-darwin-x64-*.pkg` - Intel

#### DMG Images
- `Downlodr-darwin-arm64-*.dmg` - Apple Silicon
- `Downlodr-darwin-x64-*.dmg` - Intel

#### ZIP Archives
- `Downlodr-darwin-*.zip` - Portable versions

## 🔍 Verification

### Before Release

Test locally before creating release:

```bash
# Build for your architecture
yarn make --arch=arm64 --platform=darwin  # Apple Silicon
yarn make --arch=x64 --platform=darwin    # Intel

# Test the built app
open out/Downlodr-darwin-*/Downlodr.app

# Verify all features work
```

### After Release

1. **Download the release**
   ```bash
   # Download PKG
   curl -LO https://github.com/YOUR_USERNAME/Downlodr/releases/download/v1.8.0/Downlodr-darwin-arm64-*.pkg
   ```

2. **Verify signature**
   ```bash
   pkgutil --check-signature Downlodr-darwin-arm64-*.pkg
   ```

3. **Test installation**
   - Install on clean macOS
   - Launch application
   - Test core features
   - Check for Gatekeeper warnings

## 🐛 Troubleshooting Release

### Build Failed

1. **Check workflow logs**
   - Actions → Failed workflow → Review logs

2. **Common issues:**
   - Certificate expired
   - Secrets misconfigured
   - Network timeout during notarization

3. **Fix and retry:**
   ```bash
   # Delete failed tag
   git tag -d v1.8.0
   git push origin :refs/tags/v1.8.0
   
   # Fix issue, then recreate tag
   git tag -a v1.8.0 -m "Release version 1.8.0"
   git push origin v1.8.0
   ```

### Release Created But Missing Artifacts

1. Check workflow completed all steps
2. Verify artifacts were uploaded
3. Manually upload if needed:
   ```bash
   gh release upload v1.8.0 out/make/**/*.pkg
   ```

### Notarization Failed

1. Check Apple Developer account status
2. Verify app-specific password
3. Test credentials:
   ```bash
   xcrun notarytool history \
     --apple-id "your-id" \
     --password "your-app-password" \
     --team-id "your-team-id"
   ```

## 📋 Release Checklist

Before pushing release tag:

- [ ] Version updated in package.json
- [ ] CHANGELOG.md updated
- [ ] All changes committed
- [ ] Local build successful
- [ ] Features tested locally
- [ ] Branch pushed to GitHub
- [ ] CI tests passing

After release created:

- [ ] GitHub Release page looks correct
- [ ] All artifacts present (PKG, DMG, ZIP)
- [ ] Release notes accurate
- [ ] Download and test one artifact
- [ ] Verify signature and notarization
- [ ] Update documentation if needed
- [ ] Announce release (if applicable)

## 🎯 Release Cadence

### Versioning Strategy

Follow Semantic Versioning (SemVer):

- **Major (X.0.0):** Breaking changes
- **Minor (1.X.0):** New features, backward compatible
- **Patch (1.7.X):** Bug fixes, backward compatible

### Recommended Schedule

- **Patch releases:** As needed for critical bugs
- **Minor releases:** Monthly or when features are ready
- **Major releases:** Quarterly or for significant changes

### Pre-release Versions

For testing before stable release:

```bash
# Create pre-release tag
git tag -a v1.8.0-beta.1 -m "Beta release 1.8.0-beta.1"
git push origin v1.8.0-beta.1

# GitHub will mark it as pre-release automatically
```

## 🚨 Emergency Releases

For critical security fixes:

### Fast Track Process

1. **Create hotfix branch**
   ```bash
   git checkout -b hotfix/security-fix
   ```

2. **Apply fix and test**
   ```bash
   # Make fix
   git add .
   git commit -m "Security: Fix critical vulnerability"
   ```

3. **Bump patch version**
   ```bash
   npm version patch
   ```

4. **Merge and release immediately**
   ```bash
   git checkout main
   git merge hotfix/security-fix
   git push origin main
   git tag -a v1.7.11 -m "Security fix"
   git push origin v1.7.11
   ```

5. **Monitor build closely**
   - Watch Actions workflow
   - Test artifacts ASAP
   - Notify users if needed

## 📊 Release Metrics

Track your releases:

### Build Time
- Normal: 30-35 minutes
- Fast (single arch): 15-20 minutes

### Download Stats
Monitor at:
```
https://github.com/YOUR_USERNAME/Downlodr/releases
```

### Success Criteria
- ✅ Build completes without errors
- ✅ Both architectures built successfully
- ✅ Code signing verified
- ✅ Notarization approved
- ✅ All artifacts uploaded
- ✅ Release notes accurate
- ✅ Installation works on clean macOS

## 🔄 Rollback Process

If release has critical issues:

### 1. Mark Release as Pre-release
```bash
gh release edit v1.8.0 --prerelease
```

### 2. Add Warning to Release Notes
```bash
gh release edit v1.8.0 --notes "⚠️ Known issue: [describe]. Fix in progress."
```

### 3. Create Hotfix
```bash
# Bump to v1.8.1 with fix
npm version patch
git push origin main
git tag -a v1.8.1 -m "Hotfix for v1.8.0"
git push origin v1.8.1
```

### 4. Remove Problematic Release (if needed)
```bash
# Use with caution - users may have downloaded
gh release delete v1.8.0
git push origin :refs/tags/v1.8.0
```

## 📚 Additional Resources

- [Full Setup Guide](./GITHUB_ACTIONS_SETUP.md)
- [Apple Notarization](https://developer.apple.com/documentation/security/notarizing_macos_software_before_distribution)
- [GitHub Releases](https://docs.github.com/en/repositories/releasing-projects-on-github)
- [Semantic Versioning](https://semver.org/)

---

**Questions?** Open an issue or check the [setup guide](./GITHUB_ACTIONS_SETUP.md) for troubleshooting.

