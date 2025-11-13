# GitHub Actions Workflows

This directory contains automated workflows for building and releasing Downlodr.

## 📋 Workflows

### 1. Build Linux Packages (`build-linux.yml`)

**Purpose:** Builds production-ready Linux packages and creates GitHub releases.

**Triggers:**
- **Automatic:** When you push a version tag (e.g., `v1.7.7`, `v1.8.0-stable`, `v2.0.0-beta`)
- **Manual:** Via GitHub Actions UI with custom version input

**What it does:**
1. Builds packages for multiple Ubuntu versions (20.04, 22.04, 24.04)
2. Creates DEB, RPM, and ZIP packages for each version
3. Labels packages with OS version (e.g., `downlodr-1.7.7-Ubuntu-22.04.deb`)
4. Creates a GitHub Release with all packages
5. Generates comprehensive release notes

**Usage:**

```bash
# Automatic trigger - Push a tag
git tag v1.7.8-stable
git push origin v1.7.8-stable

# Or create and push in one go
git tag -a v1.7.8-stable -m "Release v1.7.8 stable"
git push origin v1.7.8-stable
```

**Manual trigger via GitHub UI:**
1. Go to Actions tab
2. Select "Build Linux Packages"
3. Click "Run workflow"
4. Enter version (e.g., `v1.7.8-stable`)
5. Choose whether to create release
6. Click "Run workflow"

**Build matrix:**
- Ubuntu 20.04 LTS (Focal Fossa)
- Ubuntu 22.04 LTS (Jammy Jellyfish)
- Ubuntu 24.04 LTS (Noble Numbat)

**Generated packages:**
- `downlodr_{version}_amd64-Ubuntu-20.04.deb`
- `downlodr-{version}.x86_64-Ubuntu-20.04.rpm`
- `downlodr-linux-x64-{version}-Ubuntu-20.04.zip`
- (Same pattern for 22.04 and 24.04)

---

### 2. Test Linux Build (`test-build-linux.yml`)

**Purpose:** Validates build process on pull requests and develop branch commits.

**Triggers:**
- Pull requests to `main`, `develop`, or `release/**` branches
- Pushes to `develop` branch
- Only when relevant files change (src, scripts, configs)

**What it does:**
1. Tests build process on Ubuntu 22.04
2. Validates binary downloads (yt-dlp, FFmpeg)
3. Runs linting
4. Verifies package structure
5. Comments build status on PR
6. Uploads test artifacts (retained for 3 days)

**Benefits:**
- Catches build issues before merging
- Provides build verification in PR comments
- Ensures compatibility with latest dependencies
- No release creation (safe for testing)

---

## 🚀 Release Process

### Standard Release Flow

1. **Prepare release:**
   ```bash
   # Update version in package.json
   # Update CHANGELOG.md with changes
   # Commit changes
   git add package.json CHANGELOG.md
   git commit -m "chore: prepare release v1.7.8"
   git push origin main
   ```

2. **Create and push tag:**
   ```bash
   git tag -a v1.7.8-stable -m "Release v1.7.8 stable"
   git push origin v1.7.8-stable
   ```

3. **Monitor build:**
   - Go to GitHub Actions tab
   - Watch "Build Linux Packages" workflow
   - Build takes ~15-30 minutes
   - Builds on 3 Ubuntu versions in parallel

4. **Verify release:**
   - Check GitHub Releases page
   - Verify all 9 packages are uploaded (3 formats × 3 OS versions)
   - Test release notes rendering
   - Verify download links work

### Release Types

The workflow automatically detects release type based on tag:

- **Stable:** `v1.7.8-stable` or `v1.7.8` → Regular release
- **Beta:** `v1.8.0-beta` → Pre-release (marked as pre-release on GitHub)
- **Alpha:** `v1.8.0-alpha` → Pre-release
- **RC:** `v1.8.0-rc1` → Release candidate (pre-release)
- **Experimental:** `v1.7.10-exp` → Pre-release

Pre-releases are marked with a "Pre-release" badge on GitHub.

---

## 🔧 Configuration

### Secrets Required

The workflows use the default `GITHUB_TOKEN` automatically provided by GitHub Actions. No additional secrets needed!

### Workflow Permissions

Required permissions (already configured):
- `contents: write` - For creating releases and uploading assets
- `pull-requests: write` - For commenting on PRs (test workflow)

### Environment Variables

No custom environment variables required. The workflow uses:
- Node.js version: `20.17.0` (matches your project requirement)
- Yarn version: Automatically cached and used
- Build tools: Installed via apt-get

---

## 📦 Build Artifacts

### Artifact Storage

**Production releases:**
- Stored permanently in GitHub Releases
- Available at: `https://github.com/[owner]/[repo]/releases`

**Test builds:**
- Stored for 3 days in Actions artifacts
- Available in workflow run details
- Named: `test-build-artifacts-ubuntu-22.04`

### Package Naming Convention

```
downlodr_{version}_amd64-{OS}.deb          # Debian package
downlodr-{version}.x86_64-{OS}.rpm         # RPM package
downlodr-linux-x64-{version}-{OS}.zip      # Universal archive
```

Example:
```
downlodr_1.7.7_amd64-Ubuntu-22.04.deb
downlodr-1.7.7.x86_64-Ubuntu-22.04.rpm
downlodr-linux-x64-1.7.7-Ubuntu-22.04.zip
```

---

## 🐛 Troubleshooting

### Build Fails on Specific OS

**Symptom:** One Ubuntu version fails while others succeed

**Solution:**
- Check the specific job logs
- Verify system dependencies compatibility
- May need to add OS-specific conditions
- Use `fail-fast: false` to let other builds continue

### Release Already Exists

**Symptom:** "Release already exists" error

**Solution:**
```bash
# Delete the release and tag
git tag -d v1.7.8
git push origin :refs/tags/v1.7.8

# Recreate and push
git tag -a v1.7.8-stable -m "Release v1.7.8"
git push origin v1.7.8-stable
```

### No Artifacts Generated

**Symptom:** Build succeeds but no packages found

**Solution:**
- Check `scripts/build-linux.sh` execution
- Verify `out/` directory structure
- Check for errors in "Download binaries" step
- Ensure `yarn make --platform=linux` succeeds

### Binary Download Failures

**Symptom:** yt-dlp or FFmpeg download fails

**Solution:**
- GitHub Actions may have rate limiting
- URLs may have changed (check script)
- Use workflow retry feature
- Consider caching binaries

---

## 🎯 Best Practices

### Version Tagging

Use semantic versioning with descriptive suffixes:

```bash
# Stable releases
git tag v1.7.8
git tag v1.8.0-stable

# Development releases
git tag v1.8.0-beta.1
git tag v1.8.0-rc.1
git tag v1.8.0-alpha

# Experimental
git tag v1.7.10-exp
```

### Testing Before Release

Always test on a feature branch first:

1. Create PR with changes
2. Wait for test build to complete
3. Verify build artifacts in PR comment
4. Merge to main
5. Then create release tag

### Release Notes

Maintain `CHANGELOG.md` for detailed changes:
- The workflow generates generic release notes
- Custom notes can be edited on GitHub after release
- Consider automating changelog from git commits

### Hotfix Releases

For urgent fixes:

```bash
# Create hotfix branch from main
git checkout -b hotfix/1.7.8-patch1 main

# Make fixes and commit
git commit -m "fix: critical security patch"

# Merge to main
git checkout main
git merge hotfix/1.7.8-patch1

# Tag and push
git tag v1.7.8-patch1
git push origin main --tags
```

---

## 📊 Monitoring

### Build Status Badge

Add to your README.md:

```markdown
![Build Linux](https://github.com/[owner]/[repo]/actions/workflows/build-linux.yml/badge.svg)
```

### Notifications

Configure GitHub notifications for:
- Workflow failures
- Release publications
- Artifact uploads

Settings → Notifications → Actions

---

## 🔄 Future Enhancements

Potential improvements:

1. **AppImage support:** Add AppImage builder to workflow
2. **Code signing:** Sign packages with GPG key
3. **Multi-architecture:** Add ARM64 builds
4. **Flatpak/Snap:** Add additional distribution formats
5. **Automated testing:** Add integration tests before release
6. **Changelog automation:** Generate from commits
7. **Update server:** Publish to update server for in-app updates

---

## 📚 Resources

- [GitHub Actions Documentation](https://docs.github.com/en/actions)
- [Electron Forge Documentation](https://www.electronforge.io/)
- [Semantic Versioning](https://semver.org/)
- [Linux Packaging Guide](https://www.electronforge.io/config/makers)

---

## 🆘 Support

If you encounter issues:

1. Check workflow logs in Actions tab
2. Review this documentation
3. Check `scripts/build-linux.sh` logs
4. Open an issue with workflow run URL
5. Include error messages and OS versions

---

**Last Updated:** November 2025
**Maintainer:** Downlodr Project Team

