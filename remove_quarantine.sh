#!/bin/bash

echo "🔧 Downlodr Quarantine Removal Tool"
echo "==================================="
echo
echo "This script removes macOS quarantine attributes that prevent Downlodr from running."
echo

# Check for DMG first, then Applications folder
if [ -d "/Volumes/Install Downlodr" ]; then
    echo "✅ Found mounted DMG: /Volumes/Install Downlodr"
    echo "🔧 Removing quarantine attribute from DMG..."
    if sudo xattr -r -d com.apple.quarantine "/Volumes/Install Downlodr/Downlodr.app" 2>/dev/null; then
        echo "✅ Quarantine removed! You can now drag Downlodr to Applications."
    else
        echo "⚠️  Note: Quarantine attribute may not have been present on DMG"
    fi
elif [ -d "/Applications/Downlodr.app" ]; then
    echo "✅ Found Downlodr in Applications folder"
    echo "🔧 Removing quarantine attribute from Applications..."
    if sudo xattr -r -d com.apple.quarantine "/Applications/Downlodr.app" 2>/dev/null; then
        echo "✅ Success! Quarantine attribute removed"
        echo "   Downlodr should now launch without issues"
    else
        echo "⚠️  Note: Quarantine attribute may not have been present"
        echo "   This is normal if you've already opened the app"
    fi
else
    echo "❌ Downlodr not found. Please:"
    echo "   1. Mount the DMG file first, or"
    echo "   2. Install Downlodr to Applications folder"
    echo "   3. Then run this script again"
    exit 1
fi

echo
echo "🚀 You can now launch Downlodr normally!"
echo "   The app will be trusted for all future launches"
echo