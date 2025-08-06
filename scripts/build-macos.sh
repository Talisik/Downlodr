#!/bin/bash

# macOS Build Script for Downlodr
# This script builds the macOS application with proper environment variables

set -e  # Exit on any error

echo "🍎 Building Downlodr for macOS..."

# Function to check and update yt-dlp
update_ytdlp() {
    echo "🔄 Checking yt-dlp version..."
    
    # Get current version if yt-dlp exists
    if [ -f yt-dlp ]; then
        CURRENT_VERSION=$(./yt-dlp --version 2>/dev/null || echo "unknown")
    else
        CURRENT_VERSION="not found"
    fi
    
    # Get latest version from GitHub API
    LATEST_VERSION=$(curl -s https://api.github.com/repos/yt-dlp/yt-dlp/releases/latest | grep '"tag_name"' | cut -d'"' -f4)
    
    echo "📊 Current yt-dlp version: $CURRENT_VERSION"
    echo "📊 Latest yt-dlp version: $LATEST_VERSION"
    
    if [ "$CURRENT_VERSION" != "$LATEST_VERSION" ]; then
        echo "⬇️  Downloading latest yt-dlp ($LATEST_VERSION) for macOS..."
        curl -L "https://github.com/yt-dlp/yt-dlp/releases/download/$LATEST_VERSION/yt-dlp_macos" -o yt-dlp
        chmod +x yt-dlp
        echo "✅ yt-dlp updated to $LATEST_VERSION"
    else
        echo "✅ yt-dlp is already up to date"
    fi
}

# Update yt-dlp first
update_ytdlp

# Load environment variables from .env file
if [ -f .env ]; then
    echo "📝 Loading environment variables from .env..."
    # Use set -a to automatically export variables, then source the file
    set -a
    source .env
    set +a
else
    echo "⚠️  No .env file found. Building without code signing."
fi

# Clean previous builds
echo "🧹 Cleaning previous builds..."
rm -rf out/

# Build the application
echo "🔨 Building application..."

# Debug: Show environment variables
echo "🔍 Environment check:"
echo "APPLE_IDENTITY: $APPLE_IDENTITY"
echo "Platform: $(uname -s)"

# Ensure environment variables are exported for the build process
export APPLE_IDENTITY
export APPLE_ID
export APPLE_APP_SPECIFIC_PASSWORD
export APPLE_TEAM_ID

# Set CSC_NAME for Electron code signing (standard environment variable)
if [ -n "$APPLE_IDENTITY" ]; then
    export CSC_NAME="$APPLE_IDENTITY"
    echo "🔐 Code signing enabled with CSC_NAME: $CSC_NAME"
fi

# Build for both Intel (x64) and Apple Silicon (arm64)
echo "🏗️  Building for Apple Silicon (arm64)..."
yarn make --platform=darwin --arch=arm64

# Rename ARM64 DMG
if [ -f "out/make/Downlodr.dmg" ]; then
    mv "out/make/Downlodr.dmg" "out/make/Downlodr-arm64.dmg"
    echo "✅ Renamed ARM64 DMG to Downlodr-arm64.dmg"
fi

echo "🏗️  Building for Intel Macs (x64)..."
yarn make --platform=darwin --arch=x64

# Rename Intel DMG
if [ -f "out/make/Downlodr.dmg" ]; then
    mv "out/make/Downlodr.dmg" "out/make/Downlodr-x64.dmg"
    echo "✅ Renamed Intel DMG to Downlodr-x64.dmg"
fi

# Verify yt-dlp binary signing if code signing is enabled
if [ -n "$APPLE_IDENTITY" ] && [ -f "out/Downlodr-darwin-arm64/Downlodr.app/Contents/Resources/yt-dlp" ]; then
    echo "🔍 Verifying yt-dlp binary signature..."
    codesign --verify --verbose=2 "out/Downlodr-darwin-arm64/Downlodr.app/Contents/Resources/yt-dlp"
    if [ $? -eq 0 ]; then
        echo "✅ yt-dlp binary signature verified"
    else
        echo "❌ yt-dlp binary signature verification failed"
    fi
fi

# Check build results
echo "✅ Build completed!"
echo ""
echo "📦 Build artifacts:"
ls -la out/make/

echo ""
echo "🎉 macOS build complete!"
echo ""
echo "📋 Next steps:"
echo "1. Test the app: open out/Downlodr-darwin-arm64/Downlodr.app"
echo "2. Install via PKG: out/make/Downlodr-*.pkg"
echo "3. Distribute via ZIP: out/make/zip/darwin/arm64/Downlodr-*.zip"
echo ""
if [ -n "$APPLE_IDENTITY" ]; then
    echo "🔐 Code signing status: Enabled with identity: $APPLE_IDENTITY"
    echo "🏷️  For notarization, ensure APPLE_ID and APPLE_APP_SPECIFIC_PASSWORD are set"
else
    echo "⚠️  Code signing: Disabled (development build)"
    echo "💡 To enable signing, set APPLE_IDENTITY in .env file"
fi