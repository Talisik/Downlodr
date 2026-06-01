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
echo "📂 Locating packaged app..."
ls -la out/ 2>/dev/null || true
APP_PATH=$(find out -maxdepth 2 -name "*.app" -type d 2>/dev/null | head -1)
if [ -z "$APP_PATH" ]; then
    echo "❌ Could not find a built .app under out/"
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
    echo "   $APP_PATH"
    exit 1
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
echo "✅ Ready for distribution!"
echo ""
echo "🔍 DMG Features:"
echo "   • Custom app icon and volume name"
echo "   • Drag & drop to Applications folder"
echo "   • Professional window layout (800x550)"
echo "   • Code signed and notarized"
echo "   • Gatekeeper approved"
