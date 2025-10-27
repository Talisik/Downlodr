# Notarization 403 Error - Troubleshooting Guide

## 🚨 Error Details

**Error**: HTTP status code: 403  
**Message**: "A required agreement is missing or has expired"  
**When**: During `xcrun notarytool submit`  
**Status**: Agreements signed ✅, but still failing ❌

---

## 🔍 Root Causes (Even After Signing Agreements)

### 1. **Propagation Delay** (Most Common)
Apple's systems need time to propagate agreement status:
- ⏰ **Typical wait**: 1-2 hours
- 🚀 **Can take**: Up to 24 hours in rare cases
- 📝 **Recommendation**: Wait and retry

### 2. **Wrong Apple ID**
Using different Apple ID than the one with signed agreements:
- ❌ **Problem**: APPLE_ID env var ≠ Agreement Apple ID
- ✅ **Solution**: Use the EXACT Apple ID from agreements

### 3. **Expired/Invalid App-Specific Password**
App-specific passwords expire or get invalidated:
- ❌ **Problem**: Old or revoked password
- ✅ **Solution**: Generate NEW app-specific password

### 4. **Team ID Mismatch**
Wrong team ID for the account:
- ❌ **Problem**: APPLE_TEAM_ID doesn't match certificate
- ✅ **Solution**: Verify team ID matches

### 5. **Account Permissions**
Apple ID doesn't have notarization permissions:
- ❌ **Problem**: Not account holder/admin
- ✅ **Solution**: Use account holder credentials

---

## ✅ Step-by-Step Fix

### Step 1: **Verify Agreement Status**

1. Go to [App Store Connect](https://appstoreconnect.apple.com/agreements)
2. Check ALL tabs:
   - [ ] **Agreements** - All should show "Active"
   - [ ] **Banking** - Should be complete (if required)
   - [ ] **Tax** - Should be submitted (if required)

3. Look for:
   - ✅ Green checkmarks
   - ❌ Orange/red warnings
   - 📝 "Action Required" buttons

**Screenshot recommendations**: None pending

### Step 2: **Generate Fresh App-Specific Password**

**Why?** Old passwords may not work after signing new agreements.

```bash
# 1. Go to Apple ID website
https://appleid.apple.com/account/manage

# 2. Navigate to "Security" section

# 3. Under "App-Specific Passwords", click "+"

# 4. Name it: "Downlodr Notarization 2025"

# 5. Copy the generated password (format: abcd-efgh-ijkl-mnop)

# 6. Save it securely - you can't view it again!
```

### Step 3: **Verify Your Team ID**

**Method 1: From Developer Portal**
```bash
# Go to:
https://developer.apple.com/account/#/membership

# Look for "Team ID" field
# Should be like: "ABC123XYZ9"
```

**Method 2: From Certificate**
```bash
# Run in terminal:
security find-identity -v -p codesigning

# Output will show:
# 1) ABC123XYZ9 "Developer ID Application: Your Name (ABC123XYZ9)"
#    ^^^^^^^^^ This is your Team ID
```

**Method 3: From Keychain**
```bash
# 1. Open Keychain Access
# 2. Find your certificate: "Developer ID Application: ..."
# 3. Double-click → Details
# 4. Look for "Organizational Unit" = Team ID
```

### Step 4: **Update Environment Variables**

**Option A: Using .env file** (Recommended)

```bash
# 1. Navigate to project
cd /Users/erickluna/Cloud_Repo/Downlodr

# 2. Create/update .env file
nano .env

# 3. Add these lines (with YOUR values):
APPLE_ID="your-apple-id@icloud.com"
APPLE_APP_SPECIFIC_PASSWORD="abcd-efgh-ijkl-mnop"
APPLE_TEAM_ID="ABC123XYZ9"
APPLE_IDENTITY="Developer ID Application: Your Name (ABC123XYZ9)"

# 4. Save (Ctrl+O, Enter, Ctrl+X)

# 5. Load environment variables
source .env

# 6. Verify
echo $APPLE_ID
echo $APPLE_TEAM_ID
```

**Option B: Export directly** (Temporary)

```bash
export APPLE_ID="your-apple-id@icloud.com"
export APPLE_APP_SPECIFIC_PASSWORD="abcd-efgh-ijkl-mnop"
export APPLE_TEAM_ID="ABC123XYZ9"
export APPLE_IDENTITY="Developer ID Application: Your Name (ABC123XYZ9)"
```

### Step 5: **Test Credentials**

Before building, test if credentials work:

```bash
# Test notarization credentials
xcrun notarytool history \
    --apple-id "$APPLE_ID" \
    --password "$APPLE_APP_SPECIFIC_PASSWORD" \
    --team-id "$APPLE_TEAM_ID" \
    --limit 1
```

**Expected outputs**:

✅ **Success:**
```
No submissions found.
```
Or a list of previous submissions.

❌ **Failure (403):**
```
Error: HTTP status code: 403
A required agreement is missing or has expired
```
→ **Action**: Wait 1-2 hours, agreements still propagating

❌ **Failure (401):**
```
Error: HTTP status code: 401
Authentication failed
```
→ **Action**: Wrong credentials, regenerate app-specific password

❌ **Failure (Team ID):**
```
Error: The provided team id is not valid
```
→ **Action**: Verify team ID from developer portal

### Step 6: **Wait for Propagation**

If agreements are just signed:

```bash
# Check timestamp of when you signed
# If < 2 hours ago:

echo "⏰ Waiting for Apple to propagate agreement status..."
echo "   This typically takes 1-2 hours"
echo "   Check back at: $(date -v+2H)"

# In the meantime, verify credentials are correct
```

### Step 7: **Retry Build**

Once credentials test successfully:

```bash
# Clean previous failed build
rm -rf out/

# Load environment
source .env

# Try building again
yarn build:dmg
```

---

## 🧪 Quick Diagnostic Checklist

Run these commands to verify your setup:

```bash
# 1. Check if .env exists
[ -f .env ] && echo "✅ .env file exists" || echo "❌ .env file missing"

# 2. Load environment (if .env exists)
[ -f .env ] && source .env

# 3. Check environment variables
echo "--- Environment Check ---"
echo "APPLE_ID: ${APPLE_ID:+SET (${APPLE_ID:0:20}...)}"
echo "PASSWORD: ${APPLE_APP_SPECIFIC_PASSWORD:+SET (hidden)}"
echo "TEAM_ID: ${APPLE_TEAM_ID:+SET ($APPLE_TEAM_ID)}"
echo "IDENTITY: ${APPLE_IDENTITY:+SET (${APPLE_IDENTITY:0:40}...)}"

# 4. Check certificate
echo "--- Certificate Check ---"
security find-identity -v -p codesigning | grep "Developer ID Application"

# 5. Test credentials
echo "--- Credential Test ---"
xcrun notarytool history \
    --apple-id "$APPLE_ID" \
    --password "$APPLE_APP_SPECIFIC_PASSWORD" \
    --team-id "$APPLE_TEAM_ID" \
    --limit 1
```

**Copy this entire block and run it in your terminal!**

---

## 📊 Common Error Messages & Solutions

### Error: "A required agreement is missing or has expired"

**Causes**:
1. ⏰ Just signed - wait 1-2 hours
2. ❌ Wrong Apple ID - verify it matches
3. 📋 Incomplete agreements - check all tabs in App Store Connect

**Solution**:
```bash
# Wait and retry every 30 minutes:
watch -n 1800 'xcrun notarytool history --apple-id "$APPLE_ID" --password "$APPLE_APP_SPECIFIC_PASSWORD" --team-id "$APPLE_TEAM_ID" --limit 1'
```

### Error: "Authentication failed" or 401

**Causes**:
1. ❌ Wrong app-specific password
2. ❌ Using regular password instead of app-specific
3. ⏰ Password expired

**Solution**:
```bash
# Generate NEW app-specific password at:
# https://appleid.apple.com/account/manage
# Then update .env:
nano .env
# Update: APPLE_APP_SPECIFIC_PASSWORD="new-password-here"
```

### Error: "The provided team id is not valid"

**Causes**:
1. ❌ Team ID doesn't match certificate
2. ❌ Using wrong team ID format

**Solution**:
```bash
# Get correct team ID:
security find-identity -v -p codesigning | grep "Developer ID Application"
# The ID in parentheses is your Team ID
```

---

## 🕐 Timeline Expectations

### If You Just Signed Agreements:

| Time | Status | Action |
|------|--------|--------|
| **0-30 min** | Processing | ⏰ Wait |
| **30-60 min** | Likely still processing | 🔄 Test credentials |
| **1-2 hours** | Should be ready | ✅ Try building |
| **2-4 hours** | Usually complete | 🎉 Should work |
| **24+ hours** | Rare delay | 📞 Contact Apple |

### Test Every 30 Minutes:

```bash
# Save this as test-notarization.sh
#!/bin/bash
echo "🧪 Testing notarization credentials..."
xcrun notarytool history \
    --apple-id "$APPLE_ID" \
    --password "$APPLE_APP_SPECIFIC_PASSWORD" \
    --team-id "$APPLE_TEAM_ID" \
    --limit 1

if [ $? -eq 0 ]; then
    echo "✅ Credentials working! Ready to build."
    exit 0
else
    echo "❌ Still waiting for propagation..."
    echo "   Check back in 30 minutes"
    exit 1
fi
```

```bash
# Make executable and run
chmod +x test-notarization.sh
./test-notarization.sh
```

---

## 🚀 Alternative: Skip Notarization for Testing

If you need to build NOW for local testing:

### Option 1: Comment Out Notarization

Edit `forge.config.ts`:

```typescript
// Line 253-255 - This is already commented out!
osxNotarize: undefined,  // ← Already disabled
```

**Good news**: Your forge.config.ts already has notarization disabled!

### Option 2: Build Without Notarizing

```bash
# Just package, don't create DMG
yarn package

# The unsigned app is in:
open out/Downlodr-darwin-arm64/

# To run locally (bypass Gatekeeper):
xattr -cr out/Downlodr-darwin-arm64/Downlodr.app
open out/Downlodr-darwin-arm64/Downlodr.app
```

### Option 3: Manual Notarization After Build

```bash
# 1. Build without notarizing
yarn package

# 2. Create DMG manually
# (your build scripts do this)

# 3. Wait until credentials work

# 4. Manually notarize later:
xcrun notarytool submit path/to/Downlodr.dmg \
    --apple-id "$APPLE_ID" \
    --password "$APPLE_APP_SPECIFIC_PASSWORD" \
    --team-id "$APPLE_TEAM_ID" \
    --wait
```

---

## 📞 When to Contact Apple Support

Contact Apple Developer Support if:
- ✅ All agreements signed (verified green checkmarks)
- ✅ Credentials test successful with other tools
- ✅ Waited 24+ hours
- ❌ Still getting 403 error

**How to contact**:
1. Go to [Apple Developer Support](https://developer.apple.com/contact/)
2. Select "Membership and Account"
3. Choose "Notarization"
4. Provide:
   - Apple ID used
   - Team ID
   - Timestamp of agreement signing
   - Error message screenshot

---

## 🎯 Recommended Next Steps

### **Immediate** (Right Now):

1. **Generate fresh app-specific password**:
   ```
   https://appleid.apple.com/account/manage → Security → App-Specific Passwords
   ```

2. **Verify Team ID**:
   ```bash
   security find-identity -v -p codesigning
   ```

3. **Update .env file** with new credentials

4. **Test credentials**:
   ```bash
   source .env
   xcrun notarytool history --apple-id "$APPLE_ID" --password "$APPLE_APP_SPECIFIC_PASSWORD" --team-id "$APPLE_TEAM_ID" --limit 1
   ```

### **If Still Failing**:

5. **Wait 1-2 hours** for agreement propagation

6. **Test again** every 30 minutes

### **For Testing Now**:

7. **Build without notarizing**:
   ```bash
   yarn package
   xattr -cr out/Downlodr-darwin-arm64/Downlodr.app
   open out/Downlodr-darwin-arm64/Downlodr.app
   ```

---

## 📝 Diagnostic Log Template

When seeking help, provide this info:

```
## Notarization Issue Report

**When did you sign agreements?**: [timestamp]
**How long has it been?**: [hours]
**Apple ID (obfuscated)**: me***@icloud.com
**Team ID**: ABC***XYZ
**Certificate verified?**: [yes/no]
**Credential test result**:
[paste output of xcrun notarytool history command]

**Error message**:
[paste full error]

**Build command used**:
[yarn build:dmg / etc]
```

---

**Need help with any of these steps?** Let me know where you're stuck! 🚀

