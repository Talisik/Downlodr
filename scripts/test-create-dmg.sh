#!/bin/bash

# Test script for create-dmg workflow (without notarization)
# Use this to test DMG creation before full build

set -e

echo "🧪 Testing create-dmg workflow..."
echo "================================"

# Load environment variables from .env file (optional for test)
if [ -f ".env" ]; then
    echo "📋 Loading environment variables from .env..."
    set -a  # automatically export all variables
    source .env
    set +a  # stop automatically exporting
fi

# Check if we have an existing app bundle
if [ ! -d "out/Downlodr-darwin-arm64/Downlodr.app" ]; then
    echo "❌ No app bundle found. Please run 'yarn package' first."
    exit 1
fi

# Check if create-dmg is available
if ! command -v create-dmg &> /dev/null; then
    echo "📦 Installing create-dmg..."
    if command -v brew &> /dev/null; then
        brew install create-dmg
    else
        echo "❌ Please install create-dmg first:"
        echo "   brew install create-dmg"
        echo "   # or"
        echo "   npm install -g create-dmg"
        exit 1
    fi
fi

# Create test DMG
mkdir -p out/make
APP_VERSION=$(node -p "require('./package.json').version")
DMG_NAME="Downlodr-${APP_VERSION}-test-$(date +%H%M%S).dmg"
DMG_PATH="out/make/$DMG_NAME"

echo "🎨 Creating test DMG with create-dmg..."

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
    "out/Downlodr-darwin-arm64/"

echo "✅ Test DMG created: $DMG_PATH"
ls -lh "$DMG_PATH"

echo ""
echo "🔍 Test the DMG by:"
echo "   1. Double-clicking to mount it"
echo "   2. Verifying the layout looks professional"
echo "   3. Testing drag & drop to Applications"
echo "   4. Checking the app launches correctly"
echo ""
echo "💡 If test DMG works well, run the full build:"
echo "   ./scripts/build-with-create-dmg.sh"
