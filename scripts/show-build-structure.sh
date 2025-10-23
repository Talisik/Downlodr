#!/bin/bash

# Script to show the build directory structure
echo "📁 Downlodr Build Directory Structure"
echo "====================================="
echo ""

echo "🍎 macOS Builds:"
if [ -d "out/make" ]; then
    echo "   ✅ out/make/ (macOS builds)"
    find out/make -name "*.dmg" -o -name "*.pkg" 2>/dev/null | head -3 | sed 's/^/      📦 /'
    if [ ! "$(find out/make -name "*.dmg" -o -name "*.pkg" 2>/dev/null)" ]; then
        echo "      📦 (No macOS packages found)"
    fi
else
    echo "   📭 out/make/ (No macOS builds yet)"
fi

echo ""
echo "🐧 Linux Builds:"
if [ -d "out/make-linux" ]; then
    echo "   ✅ out/make-linux/ (Linux builds)"
    find out/make-linux -name "*.deb" -o -name "*.rpm" -o -name "*.snap" 2>/dev/null | head -3 | sed 's/^/      📦 /'
    if [ ! "$(find out/make-linux -name "*.deb" -o -name "*.rpm" -o -name "*.snap" 2>/dev/null)" ]; then
        echo "      📦 (No Linux packages found)"
    fi
else
    echo "   📭 out/make-linux/ (No Linux builds yet)"
fi

echo ""
echo "🪟 Windows Builds:"
if [ -d "out/make-windows" ]; then
    echo "   ✅ out/make-windows/ (Windows builds)"
    find out/make-windows -name "*.exe" -o -name "*.msi" 2>/dev/null | head -3 | sed 's/^/      📦 /'
    if [ ! "$(find out/make-windows -name "*.exe" -o -name "*.msi" 2>/dev/null)" ]; then
        echo "      📦 (No Windows packages found)"
    fi
else
    echo "   📭 out/make-windows/ (No Windows builds yet)"
fi

echo ""
echo "📋 Available Build Commands:"
echo "   yarn build:dmg      # macOS DMG (with signing & notarization)"
echo "   yarn build:intel    # macOS Intel build"
echo "   yarn build:linux    # Linux DEB, RPM, Snap packages"
echo ""
echo "✅ Each platform builds to its own directory - no conflicts!"


