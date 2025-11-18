#!/bin/bash

# 🎯 Downlodr Debian Build Script
# This script downloads required binaries and builds a Debian package for Downlodr
# Creates .deb package for Debian/Ubuntu systems with bundled yt-dlp and ffmpeg

set -euo pipefail

# Color codes for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
BINARIES_DIR="$PROJECT_ROOT/binaries"
LINUX_BINARIES_DIR="$BINARIES_DIR/linux"
BUILD_DIR="$PROJECT_ROOT/out"

# URLs for latest binaries
YT_DLP_URL="https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp"
FFMPEG_URL="https://github.com/yt-dlp/FFmpeg-Builds/releases/latest/download/ffmpeg-master-latest-linux64-gpl.tar.xz"

# Function to print colored output
print_status() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Function to check if a command exists
command_exists() {
    command -v "$1" >/dev/null 2>&1
}

# Function to check system requirements
check_requirements() {
    print_status "Checking system requirements..."
    
    local missing_deps=()
    
    # Check for required commands
    if ! command_exists curl; then
        missing_deps+=("curl")
    fi
    
    if ! command_exists tar; then
        missing_deps+=("tar")
    fi
    
    if ! command_exists xz; then
        missing_deps+=("xz-utils")
    fi
    
    if ! command_exists node; then
        missing_deps+=("nodejs")
    fi
    
    if ! command_exists yarn; then
        missing_deps+=("yarn")
    fi
    
    # Check for Debian package building tools
    if ! command_exists dpkg-deb; then
        missing_deps+=("dpkg-deb")
    fi
    
    if [ ${#missing_deps[@]} -ne 0 ]; then
        print_error "Missing required dependencies: ${missing_deps[*]}"
        print_status "Please install missing dependencies and try again."
        print_status "Install command: sudo apt-get install ${missing_deps[*]}"
        exit 1
    fi
    
    print_success "All requirements satisfied!"
}

# Function to create directory structure
create_directories() {
    print_status "Creating directory structure..."
    
    mkdir -p "$BINARIES_DIR"
    mkdir -p "$LINUX_BINARIES_DIR"
    mkdir -p "$BUILD_DIR"
    
    print_success "Directory structure created!"
}

# Function to download yt-dlp binary
download_ytdlp() {
    print_status "Downloading yt-dlp binary..."
    
    local ytdlp_path="$LINUX_BINARIES_DIR/yt-dlp"
    
    if [ -f "$ytdlp_path" ]; then
        print_warning "yt-dlp already exists. Use --force to redownload."
        return 0
    fi
    
    curl -L --progress-bar "$YT_DLP_URL" -o "$ytdlp_path"
    chmod +x "$ytdlp_path"
    
    # Verify the download
    if "$ytdlp_path" --version >/dev/null 2>&1; then
        local version=$("$ytdlp_path" --version)
        print_success "Downloaded yt-dlp version: $version"
    else
        print_error "Failed to verify yt-dlp binary"
        exit 1
    fi
}

# Function to download and extract ffmpeg
download_ffmpeg() {
    print_status "Downloading ffmpeg binaries..."
    
    local ffmpeg_path="$LINUX_BINARIES_DIR/ffmpeg"
    local ffprobe_path="$LINUX_BINARIES_DIR/ffprobe"
    
    if [ -f "$ffmpeg_path" ] && [ -f "$ffprobe_path" ]; then
        print_warning "ffmpeg binaries already exist. Use --force to redownload."
        return 0
    fi
    
    local temp_dir=$(mktemp -d)
    local ffmpeg_archive="$temp_dir/ffmpeg.tar.xz"
    
    # Download ffmpeg archive
    curl -L --progress-bar "$FFMPEG_URL" -o "$ffmpeg_archive"
    
    # Extract the archive
    print_status "Extracting ffmpeg archive..."
    tar -xf "$ffmpeg_archive" -C "$temp_dir"
    
    # Find the extracted directory
    local extracted_dir=$(find "$temp_dir" -name "ffmpeg-*" -type d | head -n 1)
    
    if [ -z "$extracted_dir" ]; then
        print_error "Failed to find extracted ffmpeg directory"
        rm -rf "$temp_dir"
        exit 1
    fi
    
    # Copy binaries
    cp "$extracted_dir/bin/ffmpeg" "$ffmpeg_path"
    cp "$extracted_dir/bin/ffprobe" "$ffprobe_path"
    
    # Make them executable
    chmod +x "$ffmpeg_path" "$ffprobe_path"
    
    # Clean up
    rm -rf "$temp_dir"
    
    # Verify the binaries
    if "$ffmpeg_path" -version >/dev/null 2>&1 && "$ffprobe_path" -version >/dev/null 2>&1; then
        local ffmpeg_version=$("$ffmpeg_path" -version 2>&1 | head -n 1 | cut -d' ' -f3)
        print_success "Downloaded ffmpeg version: $ffmpeg_version"
    else
        print_error "Failed to verify ffmpeg binaries"
        exit 1
    fi
}

# Function to install dependencies
install_dependencies() {
    print_status "Installing project dependencies..."
    
    cd "$PROJECT_ROOT"
    
    # Install Node.js dependencies
    if [ -f "package.json" ]; then
        yarn install --frozen-lockfile
        print_success "Dependencies installed successfully!"
    else
        print_error "package.json not found in project root"
        exit 1
    fi
}

# Function to build the application
build_application() {
    print_status "Building Downlodr application..."
    
    cd "$PROJECT_ROOT"
    
    # Clean previous builds
    if [ -d "out" ]; then
        rm -rf out
        print_status "Cleaned previous build artifacts"
    fi
    
    # Build for Debian/Ubuntu
    print_status "Creating Debian package..."
    
    # Build DEB package only
    yarn make --platform=linux --targets=@electron-forge/maker-deb
    
    print_success "Debian package built successfully!"
}

# Function to create AppImage (optional)
create_appimage() {
    if ! command_exists appimagetool; then
        print_warning "appimagetool not found. Skipping AppImage creation."
        print_status "To create AppImages, install appimagetool: https://appimage.github.io/appimagetool/"
        return 0
    fi
    
    print_status "Creating AppImage..."
    
    # This would require additional AppImage-specific setup
    # For now, we'll skip this and focus on DEB packages
    print_warning "AppImage creation not implemented yet. Focus on DEB packages."
}

# Function to verify build outputs
verify_build() {
    print_status "Verifying build outputs..."
    
    local build_found=false
    
    if [ -d "$BUILD_DIR" ]; then
        print_status "Build artifacts in $BUILD_DIR:"
        
        # Find created DEB package
        find "$BUILD_DIR" -name "*.deb" | while read -r package; do
            local size=$(du -h "$package" | cut -f1)
            print_success "  📦 $(basename "$package") ($size)"
            build_found=true
        done
        
        if [ "$build_found" = false ]; then
            print_warning "No build artifacts found"
        fi
    else
        print_error "Build directory not found"
        exit 1
    fi
}

# Function to show usage
show_usage() {
    cat << EOF
Usage: $0 [OPTIONS]

Downlodr Debian Build Script

OPTIONS:
    --help, -h          Show this help message
    --force, -f         Force redownload of binaries
    --skip-deps         Skip dependency installation
    --skip-binaries     Skip binary downloads
    --verbose, -v       Enable verbose output

EXAMPLES:
    $0                  Full build with binary downloads
    $0 --force          Force redownload binaries and build
    $0 --skip-deps      Skip dependency installation
    $0 --skip-binaries  Build with existing binaries

BUILD OUTPUTS:
    The script creates a .deb package for Debian/Ubuntu systems

REQUIREMENTS:
    - Node.js and Yarn
    - curl, tar, xz-utils
    - dpkg-deb (Debian package building tools)

EOF
}

# Main execution function
main() {
    local force_download=false
    local skip_deps=false
    local skip_binaries=false
    local verbose=false
    
    # Parse command line arguments
    while [[ $# -gt 0 ]]; do
        case $1 in
            --help|-h)
                show_usage
                exit 0
                ;;
            --force|-f)
                force_download=true
                shift
                ;;
            --skip-deps)
                skip_deps=true
                shift
                ;;
            --skip-binaries)
                skip_binaries=true
                shift
                ;;
            --verbose|-v)
                verbose=true
                set -x
                shift
                ;;
            *)
                print_error "Unknown option: $1"
                show_usage
                exit 1
                ;;
        esac
    done
    
    print_status "🚀 Starting Downlodr Debian build process..."
    print_status "Project root: $PROJECT_ROOT"
    
    # Force redownload if requested
    if [ "$force_download" = true ]; then
        print_status "Force mode enabled - cleaning existing binaries"
        rm -f "$LINUX_BINARIES_DIR"/*
    fi
    
    # Execute build steps
    check_requirements
    create_directories
    
    if [ "$skip_binaries" = false ]; then
        download_ytdlp
        download_ffmpeg
    else
        print_warning "Skipping binary downloads"
    fi
    
    if [ "$skip_deps" = false ]; then
        install_dependencies
    else
        print_warning "Skipping dependency installation"
    fi
    
    build_application
    verify_build
    
    print_success "🎉 Debian build completed successfully!"
    print_status "Build artifacts are available in: $BUILD_DIR"
    print_status ""
    print_status "📋 Installation instructions:"
    print_status "  Debian/Ubuntu: sudo dpkg -i $BUILD_DIR/make/deb/x64/*.deb"
    print_status "  Or: sudo apt install $BUILD_DIR/make/deb/x64/*.deb"
    print_status ""
    print_status "💡 After installation, you can launch Downlodr from your application menu"
    print_status "   or run 'downlodr' from the command line"
    print_status ""
    print_status "✨ Happy downloading!"
}

# Execute main function with all arguments
main "$@"
