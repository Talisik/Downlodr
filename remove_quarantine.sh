#!/bin/bash
echo "🔧 Downlodr Quarantine Removal Tool"
echo "=================================="
echo
echo "This script removes macOS quarantine attributes that prevent Downlodr from running."
echo
echo "Looking for mounted Downlodr DMG..."

if [ -d "/Volumes/Install Downlodr" ]; then
    echo "✅ Found mounted DMG: /Volumes/Install Downlodr"
    echo "🔧 Removing quarantine attribute..."
    sudo xattr -r -d com.apple.quarantine "/Volumes/Install Downlodr/Downlodr.app"
    echo "✅ Quarantine removed! You can now drag Downlodr to Applications."
elif [ -d "/Applications/Downlodr.app" ]; then
    echo "✅ Found Downlodr in Applications folder"
    echo "🔧 Removing quarantine attribute..."
    sudo xattr -r -d com.apple.quarantine "/Applications/Downlodr.app"
    echo "✅ Quarantine removed! Downlodr should now launch normally."
else
    echo "❌ Downlodr not found. Please:"
    echo "   1. Mount the DMG file first"
    echo "   2. Run this script again"
    echo "   3. Or provide the path to Downlodr.app"
fi
