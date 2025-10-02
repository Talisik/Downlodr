#!/bin/bash

# 🔧 Downlodr Linux Build Setup Script
# This script sets up the build environment for Linux distribution

set -euo pipefail

# Color codes for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

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

# Detect Linux distribution
detect_distro() {
    if [ -f /etc/os-release ]; then
        . /etc/os-release
        echo "$ID"
    elif [ -f /etc/redhat-release ]; then
        echo "rhel"
    elif [ -f /etc/debian_version ]; then
        echo "debian"
    else
        echo "unknown"
    fi
}

# Install dependencies based on distribution
install_deps() {
    local distro=$(detect_distro)
    
    print_status "Detected Linux distribution: $distro"
    
    case $distro in
        ubuntu|debian)
            print_status "Installing dependencies for Ubuntu/Debian..."
            sudo apt-get update
            sudo apt-get install -y \
                curl \
                tar \
                xz-utils \
                build-essential \
                rpm \
                nodejs \
                npm
            
            # Install Yarn if not present
            if ! command -v yarn >/dev/null 2>&1; then
                npm install -g yarn
            fi
            ;;
            
        fedora|centos|rhel)
            print_status "Installing dependencies for Fedora/CentOS/RHEL..."
            if command -v dnf >/dev/null 2>&1; then
                sudo dnf install -y \
                    curl \
                    tar \
                    xz \
                    gcc-c++ \
                    make \
                    rpm-build \
                    nodejs \
                    npm
            else
                sudo yum install -y \
                    curl \
                    tar \
                    xz \
                    gcc-c++ \
                    make \
                    rpm-build \
                    nodejs \
                    npm
            fi
            
            # Install Yarn if not present
            if ! command -v yarn >/dev/null 2>&1; then
                npm install -g yarn
            fi
            ;;
            
        arch|manjaro)
            print_status "Installing dependencies for Arch/Manjaro..."
            sudo pacman -S --needed --noconfirm \
                curl \
                tar \
                xz \
                base-devel \
                nodejs \
                npm \
                yarn
            ;;
            
        opensuse*)
            print_status "Installing dependencies for openSUSE..."
            sudo zypper install -y \
                curl \
                tar \
                xz \
                gcc-c++ \
                make \
                rpm-build \
                nodejs \
                npm
            
            # Install Yarn if not present
            if ! command -v yarn >/dev/null 2>&1; then
                npm install -g yarn
            fi
            ;;
            
        *)
            print_warning "Unknown distribution. Please install manually:"
            print_status "Required packages: curl, tar, xz-utils, build-essential, nodejs, npm, yarn"
            ;;
    esac
}

# Main function
main() {
    print_status "🔧 Setting up Downlodr Linux build environment..."
    
    # Check if running as root
    if [ "$EUID" -eq 0 ]; then
        print_error "Please do not run this script as root!"
        print_status "The script will use sudo when needed."
        exit 1
    fi
    
    # Install dependencies
    install_deps
    
    print_success "✅ Linux build environment setup completed!"
    print_status ""
    print_status "📋 Next steps:"
    print_status "  1. Run: yarn install"
    print_status "  2. Run: yarn build:linux"
    print_status ""
    print_status "📖 For more information, see scripts/README-linux-build.md"
}

main "$@"
