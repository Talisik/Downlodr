#!/bin/bash

# Enhanced build script using create-dmg for professional DMG creation
# Follows the workflow: Build → Sign → Notarize → Create DMG with create-dmg

set -e

echo "🚀 Downlodr Enhanced Build Script (with create-dmg)"
echo "=================================================="

# Load environment variables from .env file
if [ -f ".env" ]; then
    echo "📋 Loading environment variables from .env..."
    set -a  # automatically export all variables
    source .env
    set +a  # stop automatically exporting
else
    echo "⚠️  .env file not found"
fi

# Check environment variables. Notarization credentials are required unless
# the caller explicitly opts into an unnotarized local/dev build — an
# unnotarized DMG is rejected by Gatekeeper (spctl) on any Mac other than the
# one that built it, so silently shipping one is a distribution bug, not a
# degraded-but-usable artifact.
if [ -z "$APPLE_IDENTITY" ]; then
    echo "❌ APPLE_IDENTITY environment variable is not set"
    echo "Please check your .env file contains:"
    echo "APPLE_IDENTITY=\"Developer ID Application: Your Name (TEAMID)\""
    exit 1
fi

if [ -z "$ALLOW_UNNOTARIZED" ]; then
    missing_notarization_vars=0
    for var in APPLE_ID APPLE_APP_SPECIFIC_PASSWORD APPLE_TEAM_ID; do
        if [ -z "${!var}" ]; then
            echo "❌ $var environment variable is not set (required for notarization)"
            missing_notarization_vars=1
        fi
    done
    if [ "$missing_notarization_vars" -ne 0 ]; then
        echo "Notarization credentials are required for a distributable build."
        echo "Set APPLE_ID, APPLE_APP_SPECIFIC_PASSWORD, and APPLE_TEAM_ID in .env,"
        echo "or set ALLOW_UNNOTARIZED=1 to explicitly build a local-only,"
        echo "non-distributable DMG (it will be rejected by Gatekeeper on other Macs)."
        exit 1
    fi
fi

# Check if create-dmg is installed (prefer npm version 7.0.0)
if ! command -v npx &> /dev/null; then
    echo "❌ npx not found. Please install Node.js to use create-dmg 7.0.0"
    exit 1
fi

# Check if we have the modern create-dmg
NPX_CREATE_DMG_VERSION=$(npx create-dmg --version 2>/dev/null || echo "not installed")
if [ "$NPX_CREATE_DMG_VERSION" = "not installed" ]; then
    echo "⚠️  create-dmg 7.0.0 not found. Installing via npm..."
    npm install -g create-dmg@latest
fi

echo "✅ Environment variables configured"
echo "📱 Apple Developer ID: $APPLE_IDENTITY"
echo "🛠️  create-dmg available: Homebrew create-dmg $(/opt/homebrew/bin/create-dmg --version 2>/dev/null || echo '1.2.2')"
echo ""

# Step 0a: Fetch the Whisper model (ggml-small.bin), if not already present
# and verified. Must run before verify-binaries.sh, which checks for it.
echo "🎙️  Step 0a: Fetching Whisper model..."
if [ -f "./scripts/download-whisper-model.sh" ]; then
    chmod +x ./scripts/download-whisper-model.sh
    if ! ./scripts/download-whisper-model.sh; then
        echo "❌ Whisper model fetch failed. Transcription would be broken in this build."
        exit 1
    fi
else
    echo "⚠️  download-whisper-model.sh not found, skipping fetch"
fi
echo ""

# Step 0: Verify binaries are ready
echo "🔍 Step 0: Verifying binaries..."
if [ -f "./scripts/verify-binaries.sh" ]; then
    chmod +x ./scripts/verify-binaries.sh
    if ! ./scripts/verify-binaries.sh; then
        echo "❌ Binary verification failed. Please fix the issues above before building."
        exit 1
    fi
else
    echo "⚠️  verify-binaries.sh not found, skipping verification"
fi
echo ""

# Step 1: Clean previous builds
echo "🧹 Step 1: Cleaning previous builds..."
rm -rf out/
echo "✅ Previous builds cleaned"
echo ""

# Step 2: Build the app (package only, no makers to avoid DMG permission issues)
echo "🔧 Step 2: Building application..."
yarn electron-forge package
echo "✅ Application packaged"
echo ""

# Locate the packaged .app (output dir/app name can vary by packager version)
APP_PATH=$(find out -maxdepth 3 -name "*.app" -type d 2>/dev/null | head -1)
if [ -z "$APP_PATH" ]; then
    echo "❌ Could not find a built .app under out/"
    ls -la out/ 2>&1 || true
    exit 1
fi
APP_BUNDLE_NAME=$(basename "$APP_PATH")
echo "📱 Found app: $APP_PATH"
echo ""

# Step 3: Apply comprehensive signing (makes app ready for notarization)
echo "🔐 Step 3: Applying comprehensive code signing..."
./scripts/fix-binary-signing.sh
echo "✅ All components signed and ready for notarization"
echo ""

# Step 4: Create professional DMG with create-dmg (much better than hdiutil)
echo "📦 Step 4: Creating professional DMG with create-dmg..."

# Create out/make directory
mkdir -p out/make

# Define DMG name with version and timestamp
APP_VERSION=$(node -p "require('./package.json').version")
DMG_NAME="Downlodr-${APP_VERSION}-$(date +%Y%m%d-%H%M%S).dmg"
DMG_PATH="out/make/$DMG_NAME"

# Create a clean temporary directory with only the app bundle
echo "   📂 Preparing clean DMG source..."
DMG_SOURCE_DIR="$(mktemp -d -t downlodr_dmg_source)"
echo "   📍 Using temporary directory: $DMG_SOURCE_DIR"

# Copy only the app bundle (not loose files)
cp -R "$APP_PATH" "$DMG_SOURCE_DIR/"

# Set proper permissions on the app bundle
chmod -R 755 "$DMG_SOURCE_DIR/$APP_BUNDLE_NAME"

# Create a beautiful DMG with create-dmg
echo "   🎨 Creating styled DMG with Applications folder..."

# Use the Homebrew create-dmg (1.2.2) for professional DMG creation
echo "   🎨 Using Homebrew create-dmg for professional DMG..."

# Set DMG title (must be <=27 characters)
DMG_TITLE="Downlodr ${APP_VERSION}"
if [ ${#DMG_TITLE} -gt 27 ]; then
    DMG_TITLE="Downlodr v${APP_VERSION}"
fi

# Use the professional create-dmg (Homebrew version) for full features
echo "   🔧 Creating professional DMG with create-dmg..."

# Let create-dmg handle versioning automatically (don't remove existing DMG)
echo "   💡 Note: If create-dmg fails with 'Operation not permitted', grant Terminal 'Full Disk Access' in System Preferences > Privacy & Security"

# Note: create-dmg will handle Applications symlink automatically with --app-drop-link
echo "   📂 Note: Applications symlink will be created by create-dmg --app-drop-link..."

# Use create-dmg with Full Disk Access for professional layout
echo "   🔧 Creating professional DMG with create-dmg (using Full Disk Access)..."

    # Try create-dmg with Full Disk Access (no sudo needed)
    if /opt/homebrew/bin/create-dmg \
        --volname "Downlodr ${APP_VERSION}" \
        --volicon "src/Assets/Logo/downlodr_icon.icns" \
        --window-pos 200 120 \
        --window-size 660 400 \
        --icon-size 128 \
        --icon "$APP_BUNDLE_NAME" 180 200 \
        --hide-extension "$APP_BUNDLE_NAME" \
        --app-drop-link 480 200 \
        --background "src/Assets/DMG/dmg-background.png" \
        --text-size 16 \
        --no-internet-enable \
        "$DMG_PATH" \
        "$DMG_SOURCE_DIR"; then
        
        echo "   ✅ Professional DMG created successfully with create-dmg!"
    
else
    echo "   ⚠️  create-dmg failed, using hdiutil fallback..."
    
    # Fallback: Use hdiutil with proper volume name and Applications folder
    echo "   🔧 Creating DMG with proper volume name: 'Downlodr ${APP_VERSION}'..."
    
            # Add Applications symlink for hdiutil fallback
        ln -sf /Applications "$DMG_SOURCE_DIR/Applications"
        
        # Use hdiutil create with -srcfolder and -volname for proper volume naming
        if hdiutil create \
            -volname "Downlodr ${APP_VERSION}" \
            -srcfolder "$DMG_SOURCE_DIR" \
            -format UDZO \
            -fs HFS+ \
            -ov \
            "$DMG_PATH" 2>/dev/null; then
            
            echo "   ✅ DMG created successfully with proper volume name and Applications folder"
    else
        echo "   ⚠️  hdiutil with volume name failed, trying basic approach..."
        
        # Last resort: very basic DMG creation
        if hdiutil create \
            -srcfolder "$DMG_SOURCE_DIR" \
            -format UDZO \
            -ov \
            "$DMG_PATH" 2>/dev/null; then
            echo "   ✅ Basic DMG created (volume name may be temporary directory name)"
        else
            echo "   ❌ All DMG creation methods failed"
            exit 1
        fi
    fi
fi

# Clean up temporary directory
rm -rf "$DMG_SOURCE_DIR"

echo "✅ Professional DMG created: $DMG_PATH"

# Step 4.5: Sign the DMG itself (crucial for notarization)
echo "🔐 Step 4.5: Signing the DMG..."
if codesign --sign "$APPLE_IDENTITY" --timestamp --options runtime "$DMG_PATH"; then
    echo "✅ DMG signed successfully"
    
    # Verify DMG signature
    if codesign --verify --verbose=2 "$DMG_PATH"; then
        echo "✅ DMG signature verified"
    else
        echo "⚠️  DMG signature verification failed"
    fi
else
    echo "❌ Failed to sign DMG"
    exit 1
fi
echo ""

# Step 5: Submit DMG for notarization. Fatal by default — an unnotarized
# signed DMG opens fine on this machine (no quarantine flag was ever set
# here) but is rejected by Gatekeeper on every other Mac, so it is not a
# usable distribution artifact. ALLOW_UNNOTARIZED=1 opts into a local-only
# build and skips this step entirely.
NOTARIZED=0
if [ -n "$ALLOW_UNNOTARIZED" ]; then
    echo "🍎 Step 5: Skipping notarization (ALLOW_UNNOTARIZED=1) — local-only build."
elif xcrun notarytool submit "$DMG_PATH" \
    --apple-id "$APPLE_ID" \
    --password "$APPLE_APP_SPECIFIC_PASSWORD" \
    --team-id "$APPLE_TEAM_ID" \
    --wait; then
    echo "✅ DMG notarization successful"
    NOTARIZED=1

    # Step 6: Staple the notarization ticket to DMG
    echo "📎 Step 6: Stapling notarization ticket to DMG..."
    if xcrun stapler staple "$DMG_PATH"; then
        echo "✅ DMG notarization ticket stapled successfully"
        xcrun stapler validate "$DMG_PATH" \
            && echo "✅ DMG notarization validation passed" \
            || echo "⚠️  DMG validation had issues but stapling succeeded"
    else
        echo "⚠️  DMG stapling failed (Error 65 - sometimes normal); DMG is still notarized"
    fi
else
    echo "❌ DMG notarization FAILED — this DMG will be rejected by Gatekeeper on"
    echo "   any Mac other than this one and MUST NOT be distributed."
    echo "   This is typically an Apple Developer account issue (HTTP 403 = a required"
    echo "   Program License Agreement must be accepted/renewed at"
    echo "   https://developer.apple.com/account by the Account Holder), or an expired"
    echo "   app-specific password. Fix the underlying issue and re-run this script."
    echo "   (Set ALLOW_UNNOTARIZED=1 only if you explicitly want a local-only build.)"
    rm -f "$DMG_PATH"
    exit 1
fi

# Final gate: verify Gatekeeper actually accepts the artifact we're about to
# hand out, instead of trusting that notarytool/stapler succeeding implies it.
if [ "$NOTARIZED" -eq 1 ]; then
    if ! spctl --assess --verbose --type install "$DMG_PATH"; then
        echo "❌ spctl rejects the notarized DMG — do not distribute this build."
        exit 1
    fi
    echo "✅ spctl accepts the DMG for distribution"
fi

echo ""
echo "🎉 BUILD COMPLETE!"
echo "=================="
echo "📂 Your distribution files:"
echo "   • App Bundle: $APP_PATH"
echo "   • Professional DMG: $DMG_PATH"
echo ""
echo "📊 File sizes:"
ls -lh $APP_PATH
ls -lh "$DMG_PATH"
echo ""
if [ "$NOTARIZED" -eq 1 ]; then
    echo "✅ Ready for distribution!"
    echo ""
    echo "🔍 DMG Features:"
    echo "   • Custom app icon and volume name"
    echo "   • Drag & drop to Applications folder"
    echo "   • Professional window layout (800x550)"
    echo "   • Code signed and notarized"
    echo "   • Gatekeeper approved"
else
    echo "⚠️  Local-only build (ALLOW_UNNOTARIZED=1) — DO NOT distribute this DMG."
    echo "    It will be rejected by Gatekeeper on any Mac other than this one."
    echo ""
    echo "🔍 DMG Features:"
    echo "   • Custom app icon and volume name"
    echo "   • Drag & drop to Applications folder"
    echo "   • Professional window layout (800x550)"
    echo "   • Code signed (NOT notarized)"
fi
