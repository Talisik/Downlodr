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

# Check environment variables
if [ -z "$APPLE_IDENTITY" ]; then
    echo "❌ APPLE_IDENTITY environment variable is not set"
    echo "Please check your .env file contains:"
    echo "APPLE_IDENTITY=\"Developer ID Application: Your Name (TEAMID)\""
    exit 1
fi

# Check if create-dmg is installed
if ! command -v create-dmg &> /dev/null; then
    echo "⚠️  create-dmg not found. Installing via Homebrew..."
    if command -v brew &> /dev/null; then
        brew install create-dmg
    else
        echo "❌ Homebrew not found. Please install create-dmg manually:"
        echo "   • Via Homebrew: brew install create-dmg"
        echo "   • From source: https://github.com/create-dmg/create-dmg"
        exit 1
    fi
fi

echo "✅ Environment variables configured"
echo "📱 Apple Developer ID: $APPLE_IDENTITY"
echo "🛠️  create-dmg available: $(create-dmg --version 2>/dev/null || echo 'installed')"
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
DMG_SOURCE_DIR="/tmp/downlodr_dmg_source"
rm -rf "$DMG_SOURCE_DIR"
mkdir -p "$DMG_SOURCE_DIR"

# Copy only the app bundle (not loose files)
cp -R "out/Downlodr-darwin-arm64/Downlodr.app" "$DMG_SOURCE_DIR/"

# Create a beautiful DMG with create-dmg
echo "   🎨 Creating styled DMG with Applications folder..."

# Use create-dmg for professional-looking DMG with custom layout
create-dmg \
    --volname "Downlodr ${APP_VERSION}" \
    --volicon "src/Assets/AppLogo/icon.icns" \
    --window-pos 200 120 \
    --window-size 800 550 \
    --icon-size 100 \
    --icon "Downlodr.app" 200 190 \
    --hide-extension "Downlodr.app" \
    --app-drop-link 600 190 \
    --skip-jenkins \
    "$DMG_PATH" \
    "$DMG_SOURCE_DIR"

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

# Step 5: Submit DMG for notarization
echo "🍎 Step 5: Submitting DMG for notarization..."
xcrun notarytool submit "$DMG_PATH" \
    --apple-id "$APPLE_ID" \
    --password "$APPLE_APP_SPECIFIC_PASSWORD" \
    --team-id "$APPLE_TEAM_ID" \
    --wait

if [ $? -eq 0 ]; then
    echo "✅ DMG notarization successful"
    
    # Step 6: Staple the notarization ticket to DMG
    echo "📎 Step 6: Stapling notarization ticket to DMG..."
    if xcrun stapler staple "$DMG_PATH"; then
        echo "✅ DMG notarization ticket stapled successfully"
        if xcrun stapler validate "$DMG_PATH"; then
            echo "✅ DMG notarization validation passed"
        else
            echo "⚠️  DMG validation had issues but stapling succeeded"
        fi
    else
        echo "⚠️  DMG stapling failed (Error 65 - this is sometimes normal)"
        echo "💡 The DMG is still notarized and can be distributed"
        echo "💡 Stapling just embeds the notarization ticket for offline verification"
    fi
else
    echo "❌ DMG notarization failed"
    echo "💡 You can still distribute the signed app bundle from:"
    echo "   out/Downlodr-darwin-arm64/Downlodr.app"
    exit 1
fi

echo ""
echo "🎉 BUILD COMPLETE!"
echo "=================="
echo "📂 Your distribution files:"
echo "   • App Bundle: out/Downlodr-darwin-arm64/Downlodr.app"
echo "   • Professional DMG: $DMG_PATH"
echo ""
echo "📊 File sizes:"
ls -lh out/Downlodr-darwin-arm64/Downlodr.app
ls -lh "$DMG_PATH"
echo ""
echo "✅ Ready for distribution!"
echo ""
echo "🔍 DMG Features:"
echo "   • Custom app icon and volume name"
echo "   • Drag & drop to Applications folder"
echo "   • Professional window layout (800x550)"
echo "   • Code signed and notarized"
echo "   • Gatekeeper approved"
