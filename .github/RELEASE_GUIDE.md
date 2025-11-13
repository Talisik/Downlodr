# 🚀 Release Guide

Quick reference for creating releases with GitHub Actions.

## Quick Start

### 1. Prepare Release

```bash
# Update version in package.json
vim package.json  # Change version to 1.7.8

# Update changelog
vim CHANGELOG.md

# Commit
git add package.json CHANGELOG.md
git commit -m "chore: bump version to 1.7.8"
git push origin main
```

### 2. Create Release

```bash
# Create tag
git tag -a v1.7.8-stable -m "Release v1.7.8 stable"

# Push tag (this triggers the build)
git push origin v1.7.8-stable
```

### 3. Monitor

1. Go to [Actions tab](../../actions)
2. Watch "Build Linux Packages" workflow
3. Build takes ~15-30 minutes
4. Builds for Ubuntu 20.04, 22.04, and 24.04

### 4. Verify

1. Go to [Releases page](../../releases)
2. Check that all 9 packages are uploaded:
   - 3 × .deb (Debian packages)
   - 3 × .rpm (Red Hat packages)
   - 3 × .zip (Universal archives)
3. Download and test on target OS

## Tag Naming Convention

| Pattern | Type | Pre-release? | Example |
|---------|------|--------------|---------|
| `v1.2.3` or `v1.2.3-stable` | Stable | No | `v1.7.8-stable` |
| `v1.2.3-beta` | Beta | Yes | `v1.8.0-beta` |
| `v1.2.3-alpha` | Alpha | Yes | `v2.0.0-alpha` |
| `v1.2.3-rc1` | Release Candidate | Yes | `v1.8.0-rc1` |
| `v1.2.3-exp` | Experimental | Yes | `v1.7.10-exp` |

## Manual Trigger

Alternative to pushing tags:

1. Go to [Actions tab](../../actions)
2. Select "Build Linux Packages"
3. Click "Run workflow"
4. Fill in:
   - Version: `v1.7.8-stable`
   - Create Release: ✅ Yes
5. Click "Run workflow"

## Testing Before Release

Pull requests automatically trigger test builds:

```bash
# Create feature branch
git checkout -b feature/my-changes

# Make changes
git add .
git commit -m "feat: add new feature"
git push origin feature/my-changes

# Create PR on GitHub
# Test build runs automatically
# Check PR comment for build results
```

## Hotfix Release

```bash
# Create hotfix branch
git checkout -b hotfix/1.7.8-patch1 main

# Fix the issue
git add .
git commit -m "fix: critical bug"

# Merge to main
git checkout main
git merge hotfix/1.7.8-patch1
git push origin main

# Tag and push
git tag v1.7.8-patch1
git push origin v1.7.8-patch1
```

## Troubleshooting

### Delete Tag and Recreate

```bash
# Delete local tag
git tag -d v1.7.8

# Delete remote tag
git push origin :refs/tags/v1.7.8

# Recreate
git tag -a v1.7.8-stable -m "Release v1.7.8"
git push origin v1.7.8-stable
```

### Build Failed

1. Check workflow logs in Actions tab
2. Common issues:
   - Binary download timeout → Retry workflow
   - System dependency issue → Check OS-specific logs
   - Build script error → Test locally with `yarn build:linux`

### Release Already Exists

Delete the release on GitHub first:
1. Go to Releases page
2. Find the release
3. Click "Delete"
4. Delete and recreate the tag (see above)

## Build Status

Check current build status:
- [Latest workflow runs](../../actions/workflows/build-linux.yml)
- [Latest release](../../releases/latest)

## Generated Packages

Each release includes 9 packages:

**Ubuntu 20.04:**
- `downlodr_1.7.8_amd64-Ubuntu-20.04.deb`
- `downlodr-1.7.8.x86_64-Ubuntu-20.04.rpm`
- `downlodr-linux-x64-1.7.8-Ubuntu-20.04.zip`

**Ubuntu 22.04:**
- `downlodr_1.7.8_amd64-Ubuntu-22.04.deb`
- `downlodr-1.7.8.x86_64-Ubuntu-22.04.rpm`
- `downlodr-linux-x64-1.7.8-Ubuntu-22.04.zip`

**Ubuntu 24.04:**
- `downlodr_1.7.8_amd64-Ubuntu-24.04.deb`
- `downlodr-1.7.8.x86_64-Ubuntu-24.04.rpm`
- `downlodr-linux-x64-1.7.8-Ubuntu-24.04.zip`

## Resources

- [Full Workflow Documentation](workflows/README.md)
- [Build Script Details](../scripts/README-linux-build.md)
- [GitHub Actions Documentation](https://docs.github.com/en/actions)

---

**Need help?** Open an issue or check the [workflow documentation](workflows/README.md).

