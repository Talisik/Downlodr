#!/bin/bash

# Comprehensive build and packaging script for Downlodr
# This script ensures all outputs go to the proper out directory

set -e

echo "🚀 Downlodr Build & Package Script"
echo "=================================="

# Check environment variables
if [ -z "$APPLE_IDENTITY" ]; then
    echo "❌ APPLE_IDENTITY environment variable is not set"
    echo "Please run: source .env"
    exit 1
fi

echo "✅ Environment variables configured"
echo "📱 Apple Developer ID: $APPLE_IDENTITY"
echo ""

# Step 1: Clean previous builds
echo "🧹 Step 1: Cleaning previous builds..."
rm -rf out/
echo "✅ Previous builds cleaned"
echo ""

# Step 2: Build the app (without DMG to avoid permission issues)
echo "🔧 Step 2: Building application..."
yarn electron-forge package
echo "✅ Application packaged"
echo ""

# Step 3: Apply comprehensive signing
echo "🔐 Step 3: Applying comprehensive code signing..."
./scripts/fix-binary-signing.sh
echo "✅ All components signed"
echo ""

# Step 4: Create proper DMG with Applications folder in out directory
echo "📦 Step 4: Creating distribution DMG..."

# Create proper out directory structure
mkdir -p out/make

# Clean up any temp directories
rm -rf dmg-source

# Create DMG source with proper structure
mkdir -p dmg-source
cp -R out/Downlodr-darwin-arm64/Downlodr.app dmg-source/
ln -s /Applications dmg-source/Applications

echo "   📂 DMG structure prepared:"
ls -la dmg-source/

# Create the DMG in the proper out/make directory
DMG_NAME="Downlodr-$(date +%Y%m%d-%H%M%S).dmg"
DMG_PATH="out/make/$DMG_NAME"

hdiutil create -volname "Downlodr" -srcfolder dmg-source -ov -format UDZO "$DMG_PATH"

# Cleanup
rm -rf dmg-source

echo "✅ DMG created: $DMG_PATH"
echo ""

# Step 5: Submit for notarization
echo "🍎 Step 5: Submitting for notarization..."
xcrun notarytool submit "$DMG_PATH" \
    --apple-id "$APPLE_ID" \
    --password "$APPLE_APP_SPECIFIC_PASSWORD" \
    --team-id "$APPLE_TEAM_ID" \
    --wait

if [ $? -eq 0 ]; then
    echo "✅ Notarization successful"
    
    # Step 6: Staple the notarization ticket
    echo "📎 Step 6: Stapling notarization ticket..."
    xcrun stapler staple "$DMG_PATH"
    xcrun stapler validate "$DMG_PATH"
    echo "✅ Notarization ticket stapled"
else
    echo "❌ Notarization failed"
    exit 1
fi

echo ""
echo "🎉 BUILD COMPLETE!"
echo "=================="
echo "📂 Your distribution files:"
echo "   • App Bundle: out/Downlodr-darwin-arm64/Downlodr.app"
echo "   • DMG Installer: $DMG_PATH"
echo ""
echo "📊 File sizes:"
ls -lh out/Downlodr-darwin-arm64/Downlodr.app
ls -lh "$DMG_PATH"
echo ""
echo "✅ Ready for distribution!"
