#!/bin/bash

###############################################################################
# GitHub Secrets Setup Helper
# 
# This script helps you prepare the values needed for GitHub secrets.
# It extracts certificate information and validates your setup.
###############################################################################

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m'

log_info() { echo -e "${BLUE}ℹ️  $1${NC}"; }
log_success() { echo -e "${GREEN}✅ $1${NC}"; }
log_warning() { echo -e "${YELLOW}⚠️  $1${NC}"; }
log_error() { echo -e "${RED}❌ $1${NC}"; }
log_section() { echo -e "${CYAN}$1${NC}"; }

# Print banner
clear
cat << "EOF"
╔═══════════════════════════════════════════════════════════╗
║                                                           ║
║       GitHub Actions Secrets Setup Helper                ║
║       for macOS Code Signing & Notarization               ║
║                                                           ║
╚═══════════════════════════════════════════════════════════╝
EOF
echo ""

# Check macOS
if [[ "$OSTYPE" != "darwin"* ]]; then
    log_error "This script must be run on macOS"
    exit 1
fi

log_success "Running on macOS"
echo ""

# Step 1: Check for signing identities
log_section "═══════════════════════════════════════════════════════════"
log_section "Step 1: Checking for Code Signing Identities"
log_section "═══════════════════════════════════════════════════════════"
echo ""

log_info "Searching for Developer ID certificates in keychain..."
echo ""

IDENTITIES=$(security find-identity -v -p codesigning 2>/dev/null | grep "Developer ID")

if [ -z "$IDENTITIES" ]; then
    log_error "No Developer ID certificates found in keychain"
    echo ""
    echo "You need to:"
    echo "1. Create certificates at https://developer.apple.com/account/resources/certificates"
    echo "2. Download and install them on this Mac"
    echo "3. Run this script again"
    echo ""
    exit 1
fi

log_success "Found Developer ID certificates:"
echo ""
echo "$IDENTITIES"
echo ""

# Extract identity names
APP_IDENTITY=$(echo "$IDENTITIES" | grep "Application" | head -n 1 | sed 's/.*"\(.*\)"/\1/')
INSTALLER_IDENTITY=$(echo "$IDENTITIES" | grep "Installer" | head -n 1 | sed 's/.*"\(.*\)"/\1/')

if [ -n "$APP_IDENTITY" ]; then
    log_success "Application Identity: $APP_IDENTITY"
fi

if [ -n "$INSTALLER_IDENTITY" ]; then
    log_success "Installer Identity: $INSTALLER_IDENTITY"
else
    log_warning "No Installer identity found (will use Application identity)"
    INSTALLER_IDENTITY="$APP_IDENTITY"
fi

# Step 2: Extract Team ID
log_section ""
log_section "═══════════════════════════════════════════════════════════"
log_section "Step 2: Extracting Team ID"
log_section "═══════════════════════════════════════════════════════════"
echo ""

TEAM_ID=$(echo "$APP_IDENTITY" | sed -n 's/.*(\(.*\)).*/\1/p')

if [ -n "$TEAM_ID" ]; then
    log_success "Team ID: $TEAM_ID"
else
    log_warning "Could not extract Team ID from certificate"
    echo "Please find it at: https://developer.apple.com/account (Membership section)"
fi

# Step 3: Certificate export instructions
log_section ""
log_section "═══════════════════════════════════════════════════════════"
log_section "Step 3: Certificate Export"
log_section "═══════════════════════════════════════════════════════════"
echo ""

log_info "You need to export your certificate as a .p12 file"
echo ""
echo "Follow these steps:"
echo "1. Open 'Keychain Access' app"
echo "2. Select 'login' keychain and 'My Certificates' category"
echo "3. Find: $APP_IDENTITY"
echo "4. Right-click → Export"
echo "5. Save as: ~/Desktop/certificate.p12"
echo "6. Set a strong password (remember it!)"
echo ""

read -p "Press Enter after you've exported the certificate..."

if [ ! -f ~/Desktop/certificate.p12 ]; then
    log_warning "Certificate not found at ~/Desktop/certificate.p12"
    echo "Make sure you exported it to your Desktop"
    read -p "Certificate path (or press Enter to skip): " cert_path
    
    if [ -z "$cert_path" ]; then
        log_warning "Skipping certificate conversion"
    else
        if [ -f "$cert_path" ]; then
            cp "$cert_path" ~/Desktop/certificate.p12
        fi
    fi
fi

# Step 4: Convert to base64
log_section ""
log_section "═══════════════════════════════════════════════════════════"
log_section "Step 4: Converting Certificate to Base64"
log_section "═══════════════════════════════════════════════════════════"
echo ""

if [ -f ~/Desktop/certificate.p12 ]; then
    log_info "Converting certificate to base64..."
    
    BASE64_CERT=$(base64 -i ~/Desktop/certificate.p12)
    
    # Save to file
    echo "$BASE64_CERT" > ~/Desktop/certificate-base64.txt
    
    log_success "Base64 certificate saved to: ~/Desktop/certificate-base64.txt"
    log_success "Certificate is also copied to clipboard!"
    
    echo "$BASE64_CERT" | pbcopy
else
    log_warning "Certificate file not found, skipping base64 conversion"
fi

# Step 5: Generate keychain password
log_section ""
log_section "═══════════════════════════════════════════════════════════"
log_section "Step 5: Generating Keychain Password"
log_section "═══════════════════════════════════════════════════════════"
echo ""

KEYCHAIN_PWD=$(openssl rand -base64 32)
log_success "Generated random keychain password:"
echo ""
echo "$KEYCHAIN_PWD"
echo ""
log_info "This password is also saved to: ~/Desktop/keychain-password.txt"
echo "$KEYCHAIN_PWD" > ~/Desktop/keychain-password.txt

# Step 6: App-specific password
log_section ""
log_section "═══════════════════════════════════════════════════════════"
log_section "Step 6: App-Specific Password"
log_section "═══════════════════════════════════════════════════════════"
echo ""

log_info "You need an app-specific password for notarization"
echo ""
echo "Create one at: https://appleid.apple.com/account/manage"
echo ""
echo "Steps:"
echo "1. Go to the URL above and sign in"
echo "2. Navigate to 'Security' → 'App-Specific Passwords'"
echo "3. Click 'Generate Password'"
echo "4. Label it: 'GitHub Actions Notarization'"
echo "5. Copy the password"
echo ""

read -p "Enter your Apple ID email: " APPLE_ID
read -p "Paste your app-specific password: " APPLE_PASSWORD

# Step 7: Create summary
log_section ""
log_section "═══════════════════════════════════════════════════════════"
log_section "Step 7: GitHub Secrets Summary"
log_section "═══════════════════════════════════════════════════════════"
echo ""

SUMMARY_FILE=~/Desktop/github-secrets-summary.txt

cat > "$SUMMARY_FILE" << EOF
GitHub Actions Secrets Configuration
=====================================

Add these secrets to your GitHub repository:
Settings → Secrets and variables → Actions → New repository secret

Required Secrets:
-----------------

1. MACOS_CERTIFICATE
   Description: Base64-encoded .p12 certificate
   File: ~/Desktop/certificate-base64.txt
   (Also in your clipboard)

2. MACOS_CERTIFICATE_PWD
   Description: Password for the .p12 certificate
   Value: [The password you set when exporting]

3. KEYCHAIN_PASSWORD
   Description: Temporary keychain password
   Value: $KEYCHAIN_PWD
   File: ~/Desktop/keychain-password.txt

4. APPLE_IDENTITY
   Description: Application signing identity
   Value: $APP_IDENTITY

5. APPLE_INSTALLER_IDENTITY
   Description: Installer signing identity
   Value: $INSTALLER_IDENTITY

6. APPLE_ID
   Description: Apple ID email
   Value: $APPLE_ID

7. APPLE_PASSWORD
   Description: App-specific password
   Value: $APPLE_PASSWORD

8. APPLE_TEAM_ID
   Description: Developer Team ID
   Value: $TEAM_ID

Files Generated:
----------------
- ~/Desktop/certificate.p12 (original certificate)
- ~/Desktop/certificate-base64.txt (for GitHub secret)
- ~/Desktop/keychain-password.txt (for GitHub secret)
- ~/Desktop/github-secrets-summary.txt (this file)

⚠️  SECURITY WARNING:
- Keep these files secure
- Delete them after adding to GitHub
- Never commit them to git
- Store certificate password in password manager

Next Steps:
-----------
1. Go to your GitHub repository
2. Navigate to: Settings → Secrets and variables → Actions
3. Add each secret listed above
4. Verify all 8 secrets are added
5. Delete the files from Desktop (for security)
6. Test the workflow

Testing:
--------
To test the workflow:
  git tag -a v1.8.0-test -m "Test release"
  git push origin v1.8.0-test

Documentation:
--------------
Full setup guide: docs/GITHUB_ACTIONS_SETUP.md
Quick guide: docs/QUICK_RELEASE_GUIDE.md

EOF

log_success "Summary saved to: ~/Desktop/github-secrets-summary.txt"
echo ""

# Display summary
cat "$SUMMARY_FILE"
echo ""

# Step 8: Verification
log_section "═══════════════════════════════════════════════════════════"
log_section "Step 8: Pre-flight Verification"
log_section "═══════════════════════════════════════════════════════════"
echo ""

log_info "Running verification checks..."
echo ""

# Check certificate validity
if [ -n "$APP_IDENTITY" ]; then
    CERT_EXPIRY=$(security find-certificate -c "$APP_IDENTITY" -p | openssl x509 -text | grep "Not After" | sed 's/.*: //')
    log_success "Certificate expiry: $CERT_EXPIRY"
fi

# Test notarization credentials
if [ -n "$APPLE_ID" ] && [ -n "$APPLE_PASSWORD" ] && [ -n "$TEAM_ID" ]; then
    log_info "Testing notarization credentials..."
    
    if xcrun notarytool history --apple-id "$APPLE_ID" --password "$APPLE_PASSWORD" --team-id "$TEAM_ID" >/dev/null 2>&1; then
        log_success "Notarization credentials valid!"
    else
        log_warning "Could not verify notarization credentials"
        log_info "You can test manually with:"
        echo "xcrun notarytool history --apple-id \"$APPLE_ID\" --password \"$APPLE_PASSWORD\" --team-id \"$TEAM_ID\""
    fi
fi

# Final summary
log_section ""
log_section "═══════════════════════════════════════════════════════════"
log_section "Setup Complete!"
log_section "═══════════════════════════════════════════════════════════"
echo ""

log_success "All information has been collected and verified!"
echo ""
echo "📋 Summary file: ~/Desktop/github-secrets-summary.txt"
echo "🔐 Certificate: ~/Desktop/certificate-base64.txt"
echo "🔑 Keychain password: ~/Desktop/keychain-password.txt"
echo ""
echo "Next steps:"
echo "1. Open ~/Desktop/github-secrets-summary.txt"
echo "2. Add each secret to GitHub (Settings → Secrets)"
echo "3. Delete the Desktop files after setup"
echo "4. Test with: git tag -a v1.8.0-test -m 'Test' && git push origin v1.8.0-test"
echo ""
log_warning "Remember to delete sensitive files from Desktop after setup!"
echo ""

read -p "Open summary file now? (y/n): " open_choice
if [[ "$open_choice" =~ ^[Yy]$ ]]; then
    open "$SUMMARY_FILE"
fi

log_success "Done! 🎉"

