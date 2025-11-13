#!/bin/bash

###############################################################################
# Test Release Locally
# 
# This script helps test the release process locally before pushing to GitHub.
# It simulates the GitHub Actions workflow environment.
###############################################################################

set -e  # Exit on error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Logging functions
log_info() {
    echo -e "${BLUE}ℹ️  $1${NC}"
}

log_success() {
    echo -e "${GREEN}✅ $1${NC}"
}

log_warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

log_error() {
    echo -e "${RED}❌ $1${NC}"
}

# Print banner
echo ""
echo "========================================="
echo "    Local Release Testing Script        "
echo "========================================="
echo ""

# Check if running on macOS
if [[ "$OSTYPE" != "darwin"* ]]; then
    log_error "This script must be run on macOS"
    exit 1
fi

log_success "Running on macOS"

# Check for required environment variables
REQUIRED_VARS=("APPLE_IDENTITY" "APPLE_ID" "APPLE_PASSWORD" "APPLE_TEAM_ID")
MISSING_VARS=()

for var in "${REQUIRED_VARS[@]}"; do
    if [ -z "${!var}" ]; then
        MISSING_VARS+=("$var")
    fi
done

if [ ${#MISSING_VARS[@]} -ne 0 ]; then
    log_error "Missing required environment variables:"
    for var in "${MISSING_VARS[@]}"; do
        echo "  - $var"
    done
    echo ""
    echo "Please set these variables:"
    echo ""
    echo "export APPLE_IDENTITY=\"Developer ID Application: Your Name (TEAM_ID)\""
    echo "export APPLE_ID=\"your-apple-id@email.com\""
    echo "export APPLE_PASSWORD=\"your-app-specific-password\""
    echo "export APPLE_TEAM_ID=\"YOUR_TEAM_ID\""
    echo ""
    echo "Or source them from a file:"
    echo "source ~/.apple-credentials"
    exit 1
fi

log_success "All required environment variables set"

# Verify signing identity
log_info "Verifying signing identity..."
if security find-identity -v -p codesigning | grep -q "$APPLE_IDENTITY"; then
    log_success "Signing identity found: $APPLE_IDENTITY"
else
    log_error "Signing identity not found in keychain"
    log_info "Available identities:"
    security find-identity -v -p codesigning
    exit 1
fi

# Get architecture choice
echo ""
echo "Select architecture to build:"
echo "  1) Apple Silicon (arm64)"
echo "  2) Intel (x64)"
echo "  3) Both"
echo ""
read -p "Enter choice [1-3]: " arch_choice

case $arch_choice in
    1)
        ARCH="arm64"
        log_info "Building for Apple Silicon (arm64)"
        ;;
    2)
        ARCH="x64"
        log_info "Building for Intel (x64)"
        ;;
    3)
        ARCH="both"
        log_info "Building for both architectures"
        ;;
    *)
        log_error "Invalid choice"
        exit 1
        ;;
esac

# Check if installer identity is needed
if [ -z "$APPLE_INSTALLER_IDENTITY" ]; then
    log_warning "APPLE_INSTALLER_IDENTITY not set, using APPLE_IDENTITY"
    export APPLE_INSTALLER_IDENTITY="$APPLE_IDENTITY"
fi

# Clean previous builds
log_info "Cleaning previous builds..."
rm -rf out/
log_success "Cleaned build directories"

# Install dependencies
log_info "Installing dependencies..."
if yarn install --frozen-lockfile; then
    log_success "Dependencies installed"
else
    log_error "Failed to install dependencies"
    exit 1
fi

# Build function
build_for_arch() {
    local arch=$1
    log_info "Building for $arch..."
    
    if yarn make --arch="$arch" --platform=darwin; then
        log_success "Build completed for $arch"
        return 0
    else
        log_error "Build failed for $arch"
        return 1
    fi
}

# Build based on choice
if [ "$ARCH" = "both" ]; then
    build_for_arch "arm64"
    build_for_arch "x64"
else
    build_for_arch "$ARCH"
fi

# List built artifacts
echo ""
log_info "Build artifacts:"
echo ""

# Find and display PKG files
if find out/make -name "*.pkg" -type f | grep -q .; then
    echo "📦 PKG Files:"
    find out/make -name "*.pkg" -type f | while read file; do
        size=$(ls -lh "$file" | awk '{print $5}')
        echo "  - $(basename "$file") ($size)"
    done
    echo ""
fi

# Find and display DMG files
if find out/make -name "*.dmg" -type f | grep -q .; then
    echo "💿 DMG Files:"
    find out/make -name "*.dmg" -type f | while read file; do
        size=$(ls -lh "$file" | awk '{print $5}')
        echo "  - $(basename "$file") ($size)"
    done
    echo ""
fi

# Find and display ZIP files
if find out/make -name "*.zip" -type f | grep -q .; then
    echo "📚 ZIP Files:"
    find out/make -name "*.zip" -type f | while read file; do
        size=$(ls -lh "$file" | awk '{print $5}')
        echo "  - $(basename "$file") ($size)"
    done
    echo ""
fi

# Ask about notarization
echo ""
read -p "Do you want to notarize the PKG files? (y/n): " notarize_choice

if [[ "$notarize_choice" =~ ^[Yy]$ ]]; then
    log_info "Starting notarization process..."
    
    # Find all PKG files
    find out/make -name "*.pkg" -type f | while read pkg_file; do
        log_info "Notarizing: $(basename "$pkg_file")"
        
        # Submit for notarization
        if xcrun notarytool submit "$pkg_file" \
            --apple-id "$APPLE_ID" \
            --password "$APPLE_PASSWORD" \
            --team-id "$APPLE_TEAM_ID" \
            --wait; then
            
            log_success "Notarization approved: $(basename "$pkg_file")"
            
            # Staple the ticket
            log_info "Stapling notarization ticket..."
            if xcrun stapler staple "$pkg_file"; then
                log_success "Ticket stapled: $(basename "$pkg_file")"
            else
                log_warning "Failed to staple ticket (non-critical)"
            fi
        else
            log_error "Notarization failed: $(basename "$pkg_file")"
        fi
    done
    
    log_success "Notarization process complete"
else
    log_info "Skipping notarization"
fi

# Verification
echo ""
log_info "Running verification checks..."

# Verify signatures
find out/make -name "*.pkg" -type f | while read pkg_file; do
    echo ""
    log_info "Verifying: $(basename "$pkg_file")"
    
    # Check signature
    if pkgutil --check-signature "$pkg_file" > /dev/null 2>&1; then
        log_success "Signature valid"
    else
        log_warning "Signature verification failed or not signed"
    fi
    
    # Check if notarized (only if we notarized)
    if [[ "$notarize_choice" =~ ^[Yy]$ ]]; then
        if xcrun stapler validate "$pkg_file" > /dev/null 2>&1; then
            log_success "Notarization ticket found"
        else
            log_warning "No notarization ticket found"
        fi
        
        # Gatekeeper assessment
        if spctl -a -v --type install "$pkg_file" 2>&1 | grep -q "accepted"; then
            log_success "Gatekeeper will accept this package"
        else
            log_warning "Gatekeeper may reject this package"
        fi
    fi
done

# Summary
echo ""
echo "========================================="
echo "           Build Summary                 "
echo "========================================="
echo ""
log_success "Build completed successfully!"
echo ""
echo "Artifacts location: out/make/"
echo ""
echo "Next steps:"
echo "  1. Test the built application"
echo "  2. Verify all features work"
echo "  3. If everything looks good, create a release tag"
echo ""
echo "To create a release:"
echo "  git tag -a v1.8.0 -m \"Release version 1.8.0\""
echo "  git push origin v1.8.0"
echo ""

# Ask to open artifacts folder
read -p "Open artifacts folder? (y/n): " open_choice
if [[ "$open_choice" =~ ^[Yy]$ ]]; then
    open out/make/
fi

log_success "Done! 🎉"

