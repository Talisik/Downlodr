#!/bin/bash

# Quick dependency installation script for Ubuntu
# Run with: chmod +x install-deps.sh && ./install-deps.sh

set -e

echo "🔧 Installing Node.js and build dependencies for Downlodr..."

# Update package list
echo "📦 Updating package list..."
sudo apt update

# Install prerequisites
echo "🔨 Installing prerequisites..."
sudo apt install -y curl software-properties-common apt-transport-https

# Add NodeSource repository
echo "📥 Adding NodeSource repository..."
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -

# Install Node.js
echo "⚡ Installing Node.js..."
sudo apt install -y nodejs

# Install build tools
echo "🛠️  Installing build tools..."
sudo apt install -y rpm build-essential tar xz-utils

# Install Yarn
echo "🧶 Installing Yarn..."
sudo npm install -g yarn

# Verify installations
echo "✅ Verifying installations..."
echo "Node.js version: $(node --version)"
echo "npm version: $(npm --version)"
echo "Yarn version: $(yarn --version)"

echo ""
echo "🎉 All dependencies installed successfully!"
echo "Next steps:"
echo "  1. cd /home/erickluna/Downloads/talisik_repo/Downlodr"
echo "  2. yarn install"
echo "  3. yarn build:linux"
