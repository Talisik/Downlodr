# 🔧 Node.js Version Fix Applied

## Issue Detected

The GitHub Actions workflows were configured with Node.js `20.17.0`, but your project's Vite dependency (`vite@7.2.2`) requires:
- Node.js `^20.19.0` OR
- Node.js `>=22.12.0`

This caused the yarn install step to fail in GitHub Actions.

## ✅ Changes Applied

### 1. Updated Workflows

**File:** `.github/workflows/build-linux.yml`
```yaml
# Changed from:
node-version: '20.17.0'

# To:
node-version: '22.12.0'
```

**File:** `.github/workflows/test-build-linux.yml`
```yaml
# Changed from:
node-version: '20.17.0'

# To:
node-version: '22.12.0'
```

### 2. Updated Documentation

**File:** `README.md`
```markdown
# Updated prerequisites:
- Node.js (version ^20.19.0 || >=22.12.0)
```

**File:** `CLAUDE.md`
```markdown
# Updated prerequisites:
Prerequisites: Node.js v22.12.0+ (or Node.js v20.19.0+)
```

**File:** `.github/workflows/README.md`
```markdown
# Updated environment documentation:
- Node.js version: `22.12.0` (compatible with Vite 7.x requirements)
```

## 🧪 Testing the Fix

### Local Testing (Optional)

If you want to verify the Node.js version works locally:

```bash
# Check your current Node.js version
node --version

# If you need to update (using nvm):
nvm install 22.12.0
nvm use 22.12.0

# Test the build
yarn install
yarn build:linux
```

### GitHub Actions Testing

The fix will be automatically tested when you push changes to GitHub:

```bash
# Option 1: Test with a PR
git checkout -b fix/node-version-update
git add .
git commit -m "fix: update Node.js version for Vite 7.x compatibility"
git push origin fix/node-version-update
# Create PR - test workflow will run

# Option 2: Test with a release tag
git add .
git commit -m "fix: update Node.js version for Vite 7.x compatibility"
git push origin main
git tag v1.7.7-test
git push origin v1.7.7-test
# Build workflow will run
```

## 📋 Verification Checklist

After pushing to GitHub, verify:

- [ ] Workflow starts successfully
- [ ] "Setup Node.js" step shows version 22.12.0
- [ ] "Install dependencies" step completes without errors
- [ ] No "incompatible module" errors
- [ ] Build completes successfully
- [ ] Packages are created

## 🎯 Why Node.js 22.12.0?

We chose Node.js 22.12.0 because:

1. ✅ **Latest LTS compatibility** - Node.js 22 is stable
2. ✅ **Vite 7.x requirement** - Meets the `>=22.12.0` requirement
3. ✅ **Future-proof** - Better than minimum version 20.19.0
4. ✅ **GitHub Actions support** - Well supported by actions/setup-node@v4

### Alternative: Node.js 20.19.0

If you prefer to stay on Node.js 20.x, you can use `20.19.0` instead:

```yaml
# In workflow files:
node-version: '20.19.0'
```

Both versions work, but 22.12.0 is recommended for better long-term support.

## 🐛 Original Error

```
error vite@7.2.2: The engine "node" is incompatible with this module. 
Expected version "^20.19.0 || >=22.12.0". Got "20.17.0"
error Found incompatible module.
```

## ✅ Expected Success

After the fix, you should see:

```
✔ Node.js 22.12.0 is already installed
✔ Successfully setup node and cache
[1/4] Resolving packages...
[2/4] Fetching packages...
[3/4] Linking dependencies...
[4/4] Building fresh packages...
✔ Done in 45.23s
```

## 📚 Related Changes

This fix also addresses:
- ✅ Vite 7.x compatibility
- ✅ Modern JavaScript features support
- ✅ Better performance in GitHub Actions
- ✅ Consistent Node.js version across all builds

## 🔄 Rollback (If Needed)

If you need to rollback to Node.js 20.x for any reason:

```bash
# Edit workflow files:
vim .github/workflows/build-linux.yml
vim .github/workflows/test-build-linux.yml

# Change to:
node-version: '20.19.0'  # Minimum version for Vite 7.x

# Commit and push
git add .
git commit -m "rollback: use Node.js 20.19.0"
git push
```

## 📞 Additional Notes

### Package Lock Files

The error mentioned `package-lock.json`, but this was just in the GitHub Actions cache. Your repository correctly uses `yarn.lock` only, which is good!

### Warnings Addressed

The warnings about deprecated packages (ffbinaries, request, uuid) are from dependencies and don't affect the build. They can be addressed separately if needed.

## ✨ Next Steps

1. ✅ Commit these changes
2. ✅ Push to GitHub
3. ✅ Test with a PR or test tag
4. ✅ Verify build succeeds
5. ✅ Create production release

---

**Fix Applied:** November 14, 2025
**Node.js Version:** 22.12.0
**Status:** ✅ Ready for testing

