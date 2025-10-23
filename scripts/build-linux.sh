#!/bin/bash

# Downlodr Linux Build Script
# Creates AppImage, DEB, and RPM packages for Linux distribution

set -e

echo "🐧 Downlodr Linux Build Script"
echo "=============================="

# Check if we're on Linux (for native builds) or if cross-compilation is supported
if [[ "$OSTYPE" != "linux-gnu"* ]]; then
    echo "⚠️  Warning: Building Linux packages from non-Linux platform"
    echo "   Cross-compilation will create ZIP packages only"
    echo "   DEB and RPM packages require native Linux build environment"
    echo "   For full Linux packages, run this script on a Linux machine"
    echo ""
fi

# Verify required binaries exist
echo "🔍 Verifying Linux binaries..."
if [ ! -f "yt-dlp_linux" ]; then
    echo "❌ yt-dlp_linux binary not found"
    echo "💡 Downloading yt-dlp for Linux..."
    curl -L https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp_linux -o yt-dlp_linux
    chmod +x yt-dlp_linux
    echo "✅ yt-dlp_linux downloaded"
fi

if [ ! -f "binaries/ffmpeg-linux" ]; then
    echo "❌ ffmpeg-linux binary not found"
    echo "💡 Downloading FFmpeg for Linux..."
    mkdir -p binaries
    curl -L https://github.com/eugeneware/ffmpeg-static/releases/download/b6.0/linux-x64 -o binaries/ffmpeg-linux
    chmod +x binaries/ffmpeg-linux
    echo "✅ ffmpeg-linux downloaded"
fi

echo "✅ All Linux binaries verified"
echo ""

# Clean previous builds
echo "🧹 Cleaning previous Linux builds..."
rm -rf out/make-linux/
rm -rf out/Downlodr-linux-x64/
echo "✅ Previous Linux builds cleaned"
echo ""

# Build for Linux
echo "🔧 Building Downlodr for Linux..."
echo "📦 Target platform: linux"
if [[ "$OSTYPE" == "linux-gnu"* ]]; then
    echo "🏗️  Makers: DEB, RPM, ZIP (native Linux build)"
else
    echo "🏗️  Makers: ZIP only (cross-platform build)"
fi
echo ""

# Set environment for Linux build
export ELECTRON_BUILDER_CACHE_DIR=~/.cache/electron-builder
export npm_config_target_platform=linux
export npm_config_target_arch=x64
export npm_config_target_libc=glibc

# Package the application
yarn electron-forge package --platform=linux --arch=x64

# Create distributions
echo "📦 Creating Linux distribution packages..."
yarn electron-forge make --platform=linux --arch=x64

# Move Linux builds to separate directory to avoid conflicts with macOS builds
echo ""
echo "📁 Organizing Linux build outputs..."
if [ -d "out/make" ]; then
    # Create the Linux-specific directory
    mkdir -p out/make-linux
    
    # Move Linux-specific outputs
    if [ -d "out/make/deb" ]; then
        echo "   📦 Moving DEB packages..."
        mv out/make/deb out/make-linux/
    fi
    
    if [ -d "out/make/rpm" ]; then
        echo "   📦 Moving RPM packages..."
        mv out/make/rpm out/make-linux/
    fi
    
    if [ -d "out/make/snap" ]; then
        echo "   📦 Moving Snap packages..."
        mv out/make/snap out/make-linux/
    fi
    
    # Move ZIP files for Linux
    if [ -d "out/make/zip" ]; then
        if [ -d "out/make/zip/linux" ]; then
            echo "   📦 Moving ZIP packages..."
            mkdir -p out/make-linux/zip
            mv out/make/zip/linux out/make-linux/zip/
        fi
        
        # If only Linux ZIP was created, move the entire zip directory
        if [ ! "$(ls -A out/make/zip 2>/dev/null)" ]; then
            rm -rf out/make/zip
        fi
    fi
    
    # Remove empty make directory if all contents were moved
    if [ ! "$(ls -A out/make 2>/dev/null)" ]; then
        rm -rf out/make
    fi
    
    echo "✅ Linux build outputs organized in out/make-linux/"
fi

echo ""
echo "🎉 Linux build complete!"
echo "========================"
echo ""
echo "📂 Distribution files created:"
if [[ "$OSTYPE" == "linux-gnu"* ]]; then
    echo "   • DEB package: out/make-linux/deb/x64/"
    echo "   • RPM package: out/make-linux/rpm/x64/"
    echo "   • ZIP archive: out/make-linux/zip/linux/x64/"
else
    echo "   • ZIP archive: out/make/zip/linux/x64/ (cross-platform build)"
    echo "   ℹ️  For DEB/RPM packages, build on native Linux system"
fi
echo ""
echo "📊 Package contents include:"
echo "   • Downlodr application"
echo "   • yt-dlp for Linux"
echo "   • Static FFmpeg binary"
echo "   • All required dependencies"
echo ""
echo "✅ Ready for Linux distribution!"
echo ""
echo "💡 Installation instructions:"
if [[ "$OSTYPE" == "linux-gnu"* ]]; then
    echo "   DEB: sudo dpkg -i downlodr_*_amd64.deb"
    echo "   RPM: sudo rpm -i downlodr-*.x86_64.rpm"
    echo "   ZIP: Extract and run ./downlodr"
else
    echo "   ZIP: Extract and run ./downlodr"
    echo "   📝 Note: For system packages (DEB/RPM), build on Linux"
fi
