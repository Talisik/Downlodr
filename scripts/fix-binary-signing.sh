#!/bin/bash

# Script to fix binary signing issues after build
# This should be run after the app is built but before notarization

set -e

echo "🔧 Fixing binary signing issues..."

# Check if we have the required environment variables
if [ -z "$APPLE_IDENTITY" ]; then
    echo "❌ APPLE_IDENTITY environment variable is not set"
    exit 1
fi

# Find the built app (auto-detect: the output dir/app name can vary by
# @electron/packager version, so don't assume a hardcoded path).
APP_PATH=$(find ./out -maxdepth 2 -name "*.app" -type d 2>/dev/null | head -1)
if [ -z "$APP_PATH" ]; then
    echo "❌ Could not find a built .app under ./out. Contents:"
    ls -la ./out 2>/dev/null || echo "  (./out does not exist)"
    exit 1
fi

echo "📱 Found app at: $APP_PATH"

# Find the yt-dlp binaries in the app
RESOURCES_PATH="$APP_PATH/Contents/Resources"
YTDLP_BINARIES=("$RESOURCES_PATH/yt-dlp" "$RESOURCES_PATH/yt-dlp_macos")

echo "🔍 Checking yt-dlp binaries..."

for BINARY_PATH in "${YTDLP_BINARIES[@]}"; do
    if [ -f "$BINARY_PATH" ]; then
        echo "   Found binary: $BINARY_PATH"
        
        # Check current permissions
        PERMS=$(stat -f "%OLp" "$BINARY_PATH")
        echo "   Current permissions: $PERMS"
        
        # Make sure it's executable
        chmod 755 "$BINARY_PATH"
        echo "   ✅ Made executable"
        
        # Sign the binary with proper entitlements
        echo "   🔐 Signing binary..."
        codesign \
            --sign "$APPLE_IDENTITY" \
            --force \
            --options runtime \
            --timestamp \
            --entitlements "./yt-dlp-entitlements.plist" \
            --deep \
            --strict \
            "$BINARY_PATH"
        
        if [ $? -eq 0 ]; then
            echo "   ✅ Successfully signed"
            
            # Verify the signature
            echo "   🔍 Verifying signature..."
            codesign --verify --deep --strict "$BINARY_PATH"
            if [ $? -eq 0 ]; then
                echo "   ✅ Signature verified"
            else
                echo "   ⚠️  Signature verification failed"
            fi
        else
            echo "   ❌ Failed to sign binary"
            exit 1
        fi
    else
        echo "   ❌ Binary not found: $BINARY_PATH"
    fi
done

# Also check FFmpeg binaries
FFMPEG_BINARIES=(
    "$RESOURCES_PATH/ffmpeg-arm64"
    "$RESOURCES_PATH/ffmpeg-x64" 
    "$RESOURCES_PATH/ffmpeg"
)

echo "🔍 Checking FFmpeg binaries..."

for BINARY_PATH in "${FFMPEG_BINARIES[@]}"; do
    if [ -f "$BINARY_PATH" ]; then
        BINARY_NAME=$(basename "$BINARY_PATH")
        echo "   Found binary: $BINARY_PATH"
        
        # Check current permissions
        PERMS=$(stat -f "%OLp" "$BINARY_PATH")
        echo "   Current permissions: $PERMS"
        
        # Make sure it's executable
        chmod 755 "$BINARY_PATH"
        echo "   ✅ Made executable"
        
        # Sign the binary (FFmpeg doesn't need special entitlements)
        echo "   🔐 Signing $BINARY_NAME binary..."
        codesign \
            --sign "$APPLE_IDENTITY" \
            --force \
            --options runtime \
            --timestamp \
            --deep \
            --strict \
            "$BINARY_PATH"
        
        if [ $? -eq 0 ]; then
            echo "   ✅ Successfully signed"
            
            # Verify the signature
            echo "   🔍 Verifying signature..."
            codesign --verify --deep --strict "$BINARY_PATH"
            if [ $? -eq 0 ]; then
                echo "   ✅ Signature verified"
            else
                echo "   ⚠️  Signature verification failed"
            fi
        else
            echo "   ⚠️  Failed to sign $BINARY_NAME binary (continuing...)"
        fi
    else
        BINARY_NAME=$(basename "$BINARY_PATH")
        echo "   ❌ $BINARY_NAME not found: $BINARY_PATH"
    fi
done

# Re-sign the main app to ensure everything is properly signed
echo "🔐 Re-signing main application with production entitlements..."
codesign \
    --sign "$APPLE_IDENTITY" \
    --force \
    --options runtime \
    --entitlements "./entitlements-production.plist" \
    --deep \
    --strict \
    "$APP_PATH"

if [ $? -eq 0 ]; then
    echo "✅ Main application re-signed successfully"
    
    # Verify the app signature
    echo "🔍 Verifying app signature..."
    codesign --verify --deep --strict "$APP_PATH"
    if [ $? -eq 0 ]; then
        echo "✅ App signature verified"
    else
        echo "⚠️  App signature verification failed"
    fi
else
    echo "❌ Failed to re-sign main application"
    exit 1
fi

# Sign ALL Electron Framework components for notarization compliance
echo "🔧 Comprehensive Electron Framework signing..."

FRAMEWORKS_PATH="$APP_PATH/Contents/Frameworks"
ENTITLEMENTS_PATH=$(pwd)/entitlements-production.plist

# Helper function to sign Electron components
sign_electron_component() {
    local COMPONENT_PATH="$1"
    local COMPONENT_NAME="$2"
    local USE_ENTITLEMENTS="$3"
    
    if [ -f "$COMPONENT_PATH" ] || [ -d "$COMPONENT_PATH" ]; then
        echo "   🔐 Signing $COMPONENT_NAME..."
        
        local SIGN_ARGS=(
            --sign "$APPLE_IDENTITY"
            --force
            --options runtime
            --timestamp
            --deep
            --strict
        )
        
        # Add entitlements if specified
        if [ "$USE_ENTITLEMENTS" = "true" ] && [ -f "$ENTITLEMENTS_PATH" ]; then
            SIGN_ARGS+=(--entitlements "$ENTITLEMENTS_PATH")
        fi
        
        SIGN_ARGS+=("$COMPONENT_PATH")
        
        codesign "${SIGN_ARGS[@]}" 2>/dev/null
        
        if [ $? -eq 0 ]; then
            echo "   ✅ Successfully signed $COMPONENT_NAME"
        else
            echo "   ⚠️  Failed to sign $COMPONENT_NAME (continuing...)"
            return 1
        fi
        
        # Verify signature
        codesign --verify --deep --strict "$COMPONENT_PATH" 2>/dev/null
        if [ $? -eq 0 ]; then
            echo "   ✅ $COMPONENT_NAME signature verified"
        else
            echo "   ⚠️  $COMPONENT_NAME signature verification failed"
        fi
    else
        echo "   ⚠️  $COMPONENT_NAME not found at $COMPONENT_PATH"
    fi
}

# Sign Electron Framework libraries
if [ -d "$FRAMEWORKS_PATH/Electron Framework.framework" ]; then
    echo "🔍 Signing Electron Framework libraries..."
    
    # Sign individual libraries first
    find "$FRAMEWORKS_PATH/Electron Framework.framework" -name "*.dylib" -type f 2>/dev/null | while read -r LIB_PATH; do
        LIB_NAME=$(basename "$LIB_PATH")
        sign_electron_component "$LIB_PATH" "$LIB_NAME" false
    done
    
    # Sign helper executables
    find "$FRAMEWORKS_PATH/Electron Framework.framework" -name "chrome_crashpad_handler" -type f 2>/dev/null | while read -r HELPER_PATH; do
        sign_electron_component "$HELPER_PATH" "chrome_crashpad_handler" false
    done
    
    # Sign the main framework
    sign_electron_component "$FRAMEWORKS_PATH/Electron Framework.framework" "Electron Framework" false
fi

# Sign Electron Helper apps
echo "🔍 Signing Electron Helper applications..."

HELPER_APPS=(
    "Downlodr Helper.app"
    "Downlodr Helper (GPU).app" 
    "Downlodr Helper (Plugin).app"
    "Downlodr Helper (Renderer).app"
)

for HELPER_APP in "${HELPER_APPS[@]}"; do
    HELPER_PATH="$FRAMEWORKS_PATH/$HELPER_APP"
    if [ -d "$HELPER_PATH" ]; then
        # Sign the helper app executable
        HELPER_EXECUTABLE="$HELPER_PATH/Contents/MacOS/${HELPER_APP%%.app}"
        if [ -f "$HELPER_EXECUTABLE" ]; then
            sign_electron_component "$HELPER_EXECUTABLE" "${HELPER_APP%%.app} executable" true
        fi
        
        # Sign the entire helper app bundle
        sign_electron_component "$HELPER_PATH" "$HELPER_APP" true
    fi
done

# Sign third-party frameworks
echo "🔍 Signing third-party frameworks..."

THIRD_PARTY_FRAMEWORKS=(
    "Mantle.framework"
    "ReactiveObjC.framework"
    "Squirrel.framework"
)

for FRAMEWORK in "${THIRD_PARTY_FRAMEWORKS[@]}"; do
    FRAMEWORK_PATH="$FRAMEWORKS_PATH/$FRAMEWORK"
    if [ -d "$FRAMEWORK_PATH" ]; then
        # Sign framework executables first
        find "$FRAMEWORK_PATH" -type f -perm +111 2>/dev/null | while read -r EXEC_PATH; do
            EXEC_NAME=$(basename "$EXEC_PATH")
            sign_electron_component "$EXEC_PATH" "$FRAMEWORK $EXEC_NAME" false
        done
        
        # Sign the framework bundle
        sign_electron_component "$FRAMEWORK_PATH" "$FRAMEWORK" false
    fi
done

echo "🎉 Comprehensive binary signing completed successfully!"

echo ""
echo "📋 Next steps:"
echo "   1. Test the app to ensure yt-dlp works"
echo "   2. Create DMG from properly signed app"
echo "   3. Submit for notarization"
echo "   4. Distribute the signed and notarized app"
