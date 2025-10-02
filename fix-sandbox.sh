#!/bin/bash

# Fix Chrome Sandbox Permissions for Downlodr
# This script fixes the chrome-sandbox permission issue for Electron apps

set -e

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

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$SCRIPT_DIR"
CHROME_SANDBOX="$PROJECT_ROOT/node_modules/electron/dist/chrome-sandbox"

print_status "🔧 Fixing Chrome Sandbox Permissions for Downlodr"
print_status "Project root: $PROJECT_ROOT"

# Check if chrome-sandbox exists
if [ ! -f "$CHROME_SANDBOX" ]; then
    print_error "Chrome sandbox binary not found at: $CHROME_SANDBOX"
    print_status "Please run 'yarn install' first to install Electron"
    exit 1
fi

print_status "Found chrome-sandbox at: $CHROME_SANDBOX"

# Check current permissions
CURRENT_PERMS=$(ls -la "$CHROME_SANDBOX")
print_status "Current permissions: $CURRENT_PERMS"

# Check if we have sudo access
if ! sudo -n true 2>/dev/null; then
    print_warning "This script requires sudo access to fix sandbox permissions"
    print_status "You will be prompted for your password"
fi

print_status "Fixing chrome-sandbox permissions..."

# Fix ownership and permissions
if sudo chown root:root "$CHROME_SANDBOX" && sudo chmod 4755 "$CHROME_SANDBOX"; then
    print_success "Chrome sandbox permissions fixed!"
    
    # Verify the fix
    NEW_PERMS=$(ls -la "$CHROME_SANDBOX")
    print_status "New permissions: $NEW_PERMS"
    
    print_success "✅ Downlodr should now run without sandbox errors!"
    print_status ""
    print_status "You can now run:"
    print_status "  yarn start    # Start development"
    print_status "  yarn build:linux  # Build Linux packages"
    
else
    print_error "Failed to fix chrome-sandbox permissions"
    print_status ""
    print_status "Alternative solutions:"
    print_status "1. Run the app with disabled sandbox (development only):"
    print_status "   NODE_ENV=development yarn start"
    print_status ""
    print_status "2. Set the environment variable:"
    print_status "   export ELECTRON_DISABLE_SANDBOX=1"
    print_status "   yarn start"
    
    exit 1
fi
