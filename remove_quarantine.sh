#!/bin/bash

echo "🔧 Downlodr Quarantine Removal Tool"
echo "==================================="
echo

# Check if Downlodr.app exists
if [ ! -d "/Applications/Downlodr.app" ]; then
    echo "❌ Downlodr.app not found in Applications folder"
    echo "   Please install Downlodr first"
    exit 1
fi

echo "📋 Removing quarantine attribute from Downlodr.app..."
echo

# Remove quarantine attribute
if sudo xattr -r -d com.apple.quarantine /Applications/Downlodr.app 2>/dev/null; then
    echo "✅ Success! Quarantine attribute removed"
    echo "   Downlodr should now launch without issues"
else
    echo "⚠️  Note: Quarantine attribute may not have been present"
    echo "   This is normal if you've already opened the app"
fi

echo
echo "🚀 You can now launch Downlodr normally!"
echo "   The app will be trusted for all future launches"
echo
