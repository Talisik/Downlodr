#!/bin/bash

# Script to verify all required binaries are present and valid before building
# This ensures the build will include working FFmpeg binaries

set -e

echo "🔍 Verifying Required Binaries for Build"
echo "========================================="
echo ""

# Color codes for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Track if any issues are found
ISSUES_FOUND=0

# Check yt-dlp binary
echo "📦 Checking yt-dlp binary..."
if [ -f "yt-dlp_macos" ]; then
    YTDLP_SIZE=$(ls -lh yt-dlp_macos | awk '{print $5}')
    echo -e "   ${GREEN}✅ Found yt-dlp_macos ($YTDLP_SIZE)${NC}"
    
    # Check if it's executable
    if [ -x "yt-dlp_macos" ]; then
        echo -e "   ${GREEN}✅ yt-dlp is executable${NC}"
    else
        echo -e "   ${YELLOW}⚠️  yt-dlp is not executable, fixing...${NC}"
        chmod +x yt-dlp_macos
        echo -e "   ${GREEN}✅ Made yt-dlp executable${NC}"
    fi
else
    echo -e "   ${RED}❌ yt-dlp_macos not found!${NC}"
    echo "   Please download yt-dlp for macOS"
    ISSUES_FOUND=1
fi
echo ""

# Check FFmpeg binaries
echo "📦 Checking FFmpeg binaries..."

# Check binaries directory exists
if [ ! -d "binaries" ]; then
    echo -e "   ${RED}❌ binaries/ directory not found!${NC}"
    echo "   Creating binaries directory..."
    mkdir -p binaries
    ISSUES_FOUND=1
fi

# Check FFmpeg for ARM64
echo "   Checking ffmpeg-arm64..."
if [ -f "binaries/ffmpeg-arm64" ]; then
    FFMPEG_ARM_SIZE=$(ls -lh binaries/ffmpeg-arm64 | awk '{print $5}')
    echo -e "   ${GREEN}✅ Found ffmpeg-arm64 ($FFMPEG_ARM_SIZE)${NC}"
    
    # Check size (should be > 50MB for static build)
    FFMPEG_ARM_BYTES=$(stat -f%z "binaries/ffmpeg-arm64" 2>/dev/null || stat --format=%s "binaries/ffmpeg-arm64" 2>/dev/null || echo "0")
    if [ "$FFMPEG_ARM_BYTES" -lt 50000000 ]; then
        echo -e "   ${RED}❌ ffmpeg-arm64 is too small (< 50MB)${NC}"
        echo "   This is likely a dynamic build that won't work in production"
        ISSUES_FOUND=1
    else
        # Test if it works
        if ./binaries/ffmpeg-arm64 -version > /dev/null 2>&1; then
            echo -e "   ${GREEN}✅ ffmpeg-arm64 is functional${NC}"
        else
            echo -e "   ${RED}❌ ffmpeg-arm64 failed to run${NC}"
            echo "   Error: $(./binaries/ffmpeg-arm64 -version 2>&1 | head -1)"
            ISSUES_FOUND=1
        fi
    fi
    
    # Check if it's executable
    if [ -x "binaries/ffmpeg-arm64" ]; then
        echo -e "   ${GREEN}✅ ffmpeg-arm64 is executable${NC}"
    else
        echo -e "   ${YELLOW}⚠️  ffmpeg-arm64 is not executable, fixing...${NC}"
        chmod +x binaries/ffmpeg-arm64
        echo -e "   ${GREEN}✅ Made ffmpeg-arm64 executable${NC}"
    fi
else
    echo -e "   ${RED}❌ ffmpeg-arm64 not found!${NC}"
    ISSUES_FOUND=1
fi
echo ""

# Check FFmpeg for x64
echo "   Checking ffmpeg-x64..."
if [ -f "binaries/ffmpeg-x64" ]; then
    FFMPEG_X64_SIZE=$(ls -lh binaries/ffmpeg-x64 | awk '{print $5}')
    echo -e "   ${GREEN}✅ Found ffmpeg-x64 ($FFMPEG_X64_SIZE)${NC}"
    
    # Check size (should be > 50MB for static build)
    FFMPEG_X64_BYTES=$(stat -f%z "binaries/ffmpeg-x64" 2>/dev/null || stat --format=%s "binaries/ffmpeg-x64" 2>/dev/null || echo "0")
    if [ "$FFMPEG_X64_BYTES" -lt 50000000 ]; then
        echo -e "   ${RED}❌ ffmpeg-x64 is too small (< 50MB)${NC}"
        echo "   This is likely a dynamic build that won't work in production"
        ISSUES_FOUND=1
    else
        # Test if it works
        if ./binaries/ffmpeg-x64 -version > /dev/null 2>&1; then
            echo -e "   ${GREEN}✅ ffmpeg-x64 is functional${NC}"
        else
            echo -e "   ${RED}❌ ffmpeg-x64 failed to run${NC}"
            echo "   Error: $(./binaries/ffmpeg-x64 -version 2>&1 | head -1)"
            ISSUES_FOUND=1
        fi
    fi
    
    # Check if it's executable
    if [ -x "binaries/ffmpeg-x64" ]; then
        echo -e "   ${GREEN}✅ ffmpeg-x64 is executable${NC}"
    else
        echo -e "   ${YELLOW}⚠️  ffmpeg-x64 is not executable, fixing...${NC}"
        chmod +x binaries/ffmpeg-x64
        echo -e "   ${GREEN}✅ Made ffmpeg-x64 executable${NC}"
    fi
else
    echo -e "   ${RED}❌ ffmpeg-x64 not found!${NC}"
    ISSUES_FOUND=1
fi
echo ""

# Check if binaries are static builds (no dynamic dependencies)
echo "📊 Checking FFmpeg binary dependencies..."
if [ -f "binaries/ffmpeg-arm64" ]; then
    echo "   Checking ffmpeg-arm64 dependencies..."
    DEPS=$(otool -L binaries/ffmpeg-arm64 2>/dev/null | grep -v "System/Library" | grep -v "usr/lib" | grep -E "homebrew|local" || true)
    if [ -z "$DEPS" ]; then
        echo -e "   ${GREEN}✅ ffmpeg-arm64 has no external dependencies (static build)${NC}"
    else
        echo -e "   ${RED}❌ ffmpeg-arm64 has external dependencies:${NC}"
        echo "$DEPS"
        echo "   This binary will not work on other systems!"
        ISSUES_FOUND=1
    fi
fi

if [ -f "binaries/ffmpeg-x64" ]; then
    echo "   Checking ffmpeg-x64 dependencies..."
    DEPS=$(otool -L binaries/ffmpeg-x64 2>/dev/null | grep -v "System/Library" | grep -v "usr/lib" | grep -E "homebrew|local" || true)
    if [ -z "$DEPS" ]; then
        echo -e "   ${GREEN}✅ ffmpeg-x64 has no external dependencies (static build)${NC}"
    else
        echo -e "   ${RED}❌ ffmpeg-x64 has external dependencies:${NC}"
        echo "$DEPS"
        echo "   This binary will not work on other systems!"
        ISSUES_FOUND=1
    fi
fi
echo ""

# Summary
echo "========================================="
if [ $ISSUES_FOUND -eq 0 ]; then
    echo -e "${GREEN}✅ All binaries verified successfully!${NC}"
    echo ""
    echo "The build will include:"
    echo "   • yt-dlp for downloading videos"
    echo "   • Static FFmpeg for merging audio/video streams"
    echo ""
    echo "Users will NOT need to install any additional software."
    exit 0
else
    echo -e "${RED}❌ Issues found with binaries!${NC}"
    echo ""
    echo "To fix FFmpeg issues:"
    echo "1. Download static FFmpeg from evermeet.cx:"
    echo "   curl -L https://evermeet.cx/ffmpeg/ffmpeg-7.0.2.zip -o ffmpeg.zip"
    echo "   unzip ffmpeg.zip"
    echo "   cp ffmpeg binaries/ffmpeg-arm64"
    echo "   cp ffmpeg binaries/ffmpeg-x64"
    echo ""
    echo "2. Or use the system FFmpeg (if static):"
    echo "   cp $(which ffmpeg) binaries/ffmpeg-arm64"
    echo "   cp $(which ffmpeg) binaries/ffmpeg-x64"
    echo ""
    echo "3. Make them executable:"
    echo "   chmod +x binaries/ffmpeg-*"
    echo ""
    exit 1
fi
