#!/bin/bash

# Diagnostic script for distribution issues
# This script checks for common macOS app distribution problems

set -e

echo "🔍 Downlodr Distribution Diagnostic Tool"
echo "========================================"

# Load environment variables
if [ -f ".env" ]; then
    echo "📋 Loading environment variables from .env..."
    set -a  # automatically export all variables
    source .env
    set +a  # stop automatically exporting
fi

APP_PATH="out/Downlodr-darwin-arm64/Downlodr.app"
DMG_PATH="out/make/Downlodr-1.7.2-stable-20250813-144454.dmg"

echo ""
echo "🎯 Testing Issues Reported by Users:"
echo "1. Move to Trash security warning"
echo "2. Password prompt after 'Open Anyway'"
echo "3. Downloaded videos not playable"
echo ""

# Issue 1: Security warnings and notarization
echo "=" | tr '=' '-' | head -c 60 && echo ""
echo "🔐 ISSUE 1: Security Warnings Analysis"
echo "=" | tr '=' '-' | head -c 60 && echo ""

if [ ! -d "$APP_PATH" ]; then
    echo "❌ App bundle not found: $APP_PATH"
    exit 1
fi

echo "📍 Checking app bundle signature..."
if codesign --verify --deep --strict --verbose=2 "$APP_PATH" 2>/dev/null; then
    echo "✅ Basic code signature verification passed"
else
    echo "❌ Code signature verification failed!"
    echo "Running detailed signature check..."
    codesign --verify --deep --strict --verbose=4 "$APP_PATH"
fi

echo ""
echo "📍 Checking signing identity..."
codesign --display --verbose=4 "$APP_PATH" 2>&1 | grep -E "(Authority|TeamIdentifier|Timestamp|Identifier)"

echo ""
echo "📍 Checking Gatekeeper assessment..."
if spctl --assess --verbose --type execute "$APP_PATH" 2>&1 | tee /tmp/spctl_output.txt; then
    echo "✅ Gatekeeper assessment passed"
else
    echo "❌ Gatekeeper assessment failed!"
    echo "This explains the 'Move to Trash' warning"
fi

echo ""
echo "📍 Checking notarization status..."
if grep -q "source=Notarized Developer ID" /tmp/spctl_output.txt; then
    echo "✅ App is properly notarized"
elif grep -q "source=Developer ID" /tmp/spctl_output.txt; then
    echo "⚠️  App is signed but NOT notarized - this causes security warnings"
    echo "💡 Solution: The DMG needs proper notarization"
else
    echo "❌ App is not properly signed or notarized"
fi

echo ""
echo "📍 Checking hardened runtime..."
codesign --display --entitlements - "$APP_PATH" 2>/dev/null | head -20

echo ""
echo "📍 Checking DMG notarization (if DMG exists)..."
if [ -f "$DMG_PATH" ]; then
    echo "DMG found: $DMG_PATH"
    if spctl --assess --verbose --type open --context context:primary-signature "$DMG_PATH" 2>&1; then
        echo "✅ DMG passes Gatekeeper assessment"
    else
        echo "❌ DMG fails Gatekeeper assessment"
    fi
else
    echo "⚠️  DMG not found: $DMG_PATH"
fi

# Issue 2: Password prompts
echo ""
echo "=" | tr '=' '-' | head -c 60 && echo ""
echo "🔑 ISSUE 2: Password Prompt Analysis"
echo "=" | tr '=' '-' | head -c 60 && echo ""

echo "📍 Checking for problematic entitlements..."
PROBLEMATIC_ENTITLEMENTS=(
    "com.apple.security.cs.allow-jit"
    "com.apple.security.cs.allow-unsigned-executable-memory"
    "com.apple.security.cs.disable-library-validation"
    "com.apple.security.automation.apple-events"
)

for entitlement in "${PROBLEMATIC_ENTITLEMENTS[@]}"; do
    if codesign --display --entitlements - "$APP_PATH" 2>/dev/null | grep -q "$entitlement"; then
        echo "⚠️  Found potentially problematic entitlement: $entitlement"
    fi
done

echo ""
echo "📍 Checking binary permissions..."
MAIN_BINARY="$APP_PATH/Contents/MacOS/Downlodr"
if [ -f "$MAIN_BINARY" ]; then
    ls -la "$MAIN_BINARY"
    if [ -x "$MAIN_BINARY" ]; then
        echo "✅ Main binary is executable"
    else
        echo "❌ Main binary is not executable"
    fi
fi

echo ""
echo "📍 Checking external binaries that might need keychain access..."
EXTERNAL_BINARIES=(
    "$APP_PATH/Contents/Resources/yt-dlp"
    "$APP_PATH/Contents/Resources/yt-dlp_macos"
    "$APP_PATH/Contents/Resources/ffmpeg"
    "$APP_PATH/Contents/Resources/ffmpeg-arm64"
    "$APP_PATH/Contents/Resources/ffmpeg-x64"
)

for binary in "${EXTERNAL_BINARIES[@]}"; do
    if [ -f "$binary" ]; then
        echo "Binary: $(basename "$binary")"
        if codesign --verify --verbose=2 "$binary" 2>/dev/null; then
            echo "  ✅ Signed"
        else
            echo "  ❌ Not signed - this could cause password prompts"
        fi
        
        # Check if binary tries to access keychain
        if otool -L "$binary" 2>/dev/null | grep -q Security; then
            echo "  ⚠️  Links to Security framework - may request keychain access"
        fi
    fi
done

# Issue 3: Video playback
echo ""
echo "=" | tr '=' '-' | head -c 60 && echo ""
echo "🎬 ISSUE 3: Video Playback Analysis"
echo "=" | tr '=' '-' | head -c 60 && echo ""

echo "📍 Checking FFmpeg binaries..."
for ffmpeg_binary in "ffmpeg" "ffmpeg-arm64" "ffmpeg-x64"; do
    FFMPEG_PATH="$APP_PATH/Contents/Resources/$ffmpeg_binary"
    if [ -f "$FFMPEG_PATH" ]; then
        echo ""
        echo "Binary: $ffmpeg_binary"
        echo "  Size: $(ls -lh "$FFMPEG_PATH" | awk '{print $5}')"
        echo "  Permissions: $(ls -l "$FFMPEG_PATH" | awk '{print $1}')"
        
        if [ -x "$FFMPEG_PATH" ]; then
            echo "  ✅ Executable"
            
            # Test if FFmpeg can run
            if "$FFMPEG_PATH" -version 2>/dev/null | head -3; then
                echo "  ✅ FFmpeg runs successfully"
            else
                echo "  ❌ FFmpeg cannot execute - this breaks video processing"
            fi
        else
            echo "  ❌ Not executable"
        fi
        
        # Check code signature
        if codesign --verify --verbose=2 "$FFMPEG_PATH" 2>/dev/null; then
            echo "  ✅ Code signed"
        else
            echo "  ❌ Not code signed - may be blocked by Gatekeeper"
        fi
    else
        echo "❌ $ffmpeg_binary not found"
    fi
done

echo ""
echo "📍 Checking yt-dlp binaries..."
for ytdlp_binary in "yt-dlp" "yt-dlp_macos"; do
    YTDLP_PATH="$APP_PATH/Contents/Resources/$ytdlp_binary"
    if [ -f "$YTDLP_PATH" ]; then
        echo ""
        echo "Binary: $ytdlp_binary"
        echo "  Size: $(ls -lh "$YTDLP_PATH" | awk '{print $5}')"
        echo "  Permissions: $(ls -l "$YTDLP_PATH" | awk '{print $1}')"
        
        if [ -x "$YTDLP_PATH" ]; then
            echo "  ✅ Executable"
            
            # Test if yt-dlp can run
            if timeout 5 "$YTDLP_PATH" --version 2>/dev/null; then
                echo "  ✅ yt-dlp runs successfully"
            else
                echo "  ❌ yt-dlp cannot execute or timed out"
            fi
        else
            echo "  ❌ Not executable"
        fi
        
        # Check code signature
        if codesign --verify --verbose=2 "$YTDLP_PATH" 2>/dev/null; then
            echo "  ✅ Code signed"
        else
            echo "  ❌ Not code signed - may be blocked by Gatekeeper"
        fi
    else
        echo "❌ $ytdlp_binary not found"
    fi
done

# Summary and recommendations
echo ""
echo "=" | tr '=' '-' | head -c 60 && echo ""
echo "📋 DIAGNOSTIC SUMMARY & RECOMMENDATIONS"
echo "=" | tr '=' '-' | head -c 60 && echo ""

echo ""
echo "🔍 Based on the analysis above:"
echo ""

echo "1️⃣ SECURITY WARNINGS ('Move to Trash'):"
if grep -q "source=Notarized Developer ID" /tmp/spctl_output.txt 2>/dev/null; then
    echo "   ✅ Should not occur - app is properly notarized"
    echo "   💡 If users still see warnings, they may have downloaded a corrupted copy"
else
    echo "   ❌ CAUSE IDENTIFIED: App/DMG is not properly notarized"
    echo "   💡 SOLUTION: Re-run notarization process for the DMG"
fi

echo ""
echo "2️⃣ PASSWORD PROMPTS:"
echo "   💡 Usually caused by unsigned external binaries trying to access system resources"
echo "   💡 SOLUTION: Ensure all yt-dlp and FFmpeg binaries are properly signed"

echo ""
echo "3️⃣ VIDEO PLAYBACK ISSUES:"
echo "   💡 Usually caused by FFmpeg binaries being blocked or corrupted"
echo "   💡 SOLUTION: Verify FFmpeg binaries are signed, executable, and functional"

echo ""
echo "🚀 RECOMMENDED FIXES:"
echo "   1. Re-sign all external binaries with proper entitlements"
echo "   2. Re-notarize the entire DMG (not just the app)"
echo "   3. Test on a clean macOS system before distribution"

echo ""
echo "🔧 To fix these issues, run:"
echo "   ./scripts/fix-binary-signing.sh    # Re-sign all binaries"
echo "   yarn build:dmg                     # Create new notarized DMG"

# Cleanup
rm -f /tmp/spctl_output.txt
