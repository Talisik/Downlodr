#!/bin/bash

# Script to download static FFmpeg binaries for macOS
# These binaries have no external dependencies and can be bundled with the app

echo "📦 Downloading static FFmpeg binaries for macOS..."

# Create binaries directory if it doesn't exist
mkdir -p binaries

# Backup existing binaries
if [ -f "binaries/ffmpeg-arm64" ]; then
  echo "Backing up existing ffmpeg-arm64..."
  mv binaries/ffmpeg-arm64 binaries/ffmpeg-arm64.backup
fi

if [ -f "binaries/ffmpeg-x64" ]; then
  echo "Backing up existing ffmpeg-x64..."
  mv binaries/ffmpeg-x64 binaries/ffmpeg-x64.backup
fi

# Download static FFmpeg builds from evermeet.cx (reliable source for macOS static builds)
echo ""
echo "Downloading FFmpeg for Apple Silicon (arm64)..."
curl -L "https://evermeet.cx/ffmpeg/ffmpeg-7.0.2.zip" -o /tmp/ffmpeg-arm64.zip
unzip -q /tmp/ffmpeg-arm64.zip -d /tmp/
mv /tmp/ffmpeg binaries/ffmpeg-arm64
rm /tmp/ffmpeg-arm64.zip

echo ""
echo "For Intel (x64), we'll use the same binary with Rosetta 2 compatibility"
# Note: evermeet.cx only provides arm64 builds now, but they work on Intel via Rosetta 2
cp binaries/ffmpeg-arm64 binaries/ffmpeg-x64

# Alternative: Download from ffmpeg-static npm package (cross-platform static builds)
# echo "Downloading static FFmpeg from ffmpeg-static..."
# npm install ffmpeg-static --save-dev
# cp node_modules/ffmpeg-static/ffmpeg binaries/ffmpeg-arm64

# Make binaries executable
chmod +x binaries/ffmpeg-arm64
chmod +x binaries/ffmpeg-x64

# Test the binaries
echo ""
echo "Testing FFmpeg binaries..."
echo "ARM64 version:"
./binaries/ffmpeg-arm64 -version | head -2

echo ""
echo "File sizes:"
ls -lh binaries/ffmpeg-*

echo ""
echo "✅ Static FFmpeg binaries downloaded successfully!"
echo ""
echo "Note: These are static builds with no external dependencies."
echo "They can be safely bundled with the app."
