#!/bin/bash
# Verification script for Linux build

echo "🔍 Downlodr Linux Build Verification"
echo "===================================="
echo ""

# Check packages exist
echo "📦 Checking generated packages..."
if [ -f "out/make/deb/x64/downlodr_1.7.7-stable_amd64.deb" ]; then
    echo "  ✅ DEB package: $(du -h out/make/deb/x64/downlodr_*.deb | cut -f1)"
else
    echo "  ❌ DEB package missing"
fi

if [ -f "out/make/rpm/x64/downlodr-1.7.7.stable-1.x86_64.rpm" ]; then
    echo "  ✅ RPM package: $(du -h out/make/rpm/x64/downlodr-*.rpm | cut -f1)"
else
    echo "  ❌ RPM package missing"
fi

if [ -f "out/make/zip/linux/x64/Downlodr-linux-x64-1.7.7-stable.zip" ]; then
    echo "  ✅ ZIP package: $(du -h out/make/zip/linux/x64/Downlodr-*.zip | cut -f1)"
else
    echo "  ❌ ZIP package missing"
fi

echo ""
echo "🔧 Checking bundled binaries..."
if [ -d "out/Downlodr-linux-x64/resources/bin" ]; then
    if [ -x "out/Downlodr-linux-x64/resources/bin/yt-dlp" ]; then
        echo "  ✅ yt-dlp: $(du -h out/Downlodr-linux-x64/resources/bin/yt-dlp | cut -f1)"
    else
        echo "  ❌ yt-dlp missing or not executable"
    fi
    
    if [ -x "out/Downlodr-linux-x64/resources/bin/ffmpeg" ]; then
        echo "  ✅ ffmpeg: $(du -h out/Downlodr-linux-x64/resources/bin/ffmpeg | cut -f1)"
    else
        echo "  ❌ ffmpeg missing or not executable"
    fi
    
    if [ -x "out/Downlodr-linux-x64/resources/bin/ffprobe" ]; then
        echo "  ✅ ffprobe: $(du -h out/Downlodr-linux-x64/resources/bin/ffprobe | cut -f1)"
    else
        echo "  ❌ ffprobe missing or not executable"
    fi
else
    echo "  ❌ Binary directory not found"
fi

echo ""
echo "🎨 Checking icon configuration..."
if dpkg-deb -c out/make/deb/x64/downlodr_*.deb 2>/dev/null | grep -q "usr/share/pixmaps/downlodr.png"; then
    echo "  ✅ Icon installed to /usr/share/pixmaps/"
else
    echo "  ❌ Icon not found in package"
fi

if dpkg-deb -c out/make/deb/x64/downlodr_*.deb 2>/dev/null | grep -q "usr/share/applications/downlodr.desktop"; then
    echo "  ✅ Desktop entry created"
else
    echo "  ❌ Desktop entry not found"
fi

echo ""
echo "📋 Checking Logo resources..."
if [ -f "out/Downlodr-linux-x64/resources/Logo/Downlodr-Logo.svg" ]; then
    echo "  ✅ SVG logo bundled"
else
    echo "  ⚠️  SVG logo not in resources (may still work)"
fi

echo ""
echo "✅ Build verification complete!"
echo ""
echo "🚀 Ready for distribution!"
