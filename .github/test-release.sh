#!/bin/bash

# 🧪 Test Release Script
# This script helps you test the GitHub Actions setup with a test release

set -euo pipefail

# Colors
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo -e "${BLUE}🧪 Downlodr GitHub Actions Test Script${NC}"
echo ""

# Get current version from package.json
CURRENT_VERSION=$(node -p "require('./package.json').version")
echo -e "${BLUE}Current version:${NC} $CURRENT_VERSION"
echo ""

# Ask for test tag
echo -e "${YELLOW}This script will create a TEST release to verify GitHub Actions.${NC}"
echo -e "${YELLOW}The test release can be deleted after verification.${NC}"
echo ""
read -p "Create test tag? (y/n): " -n 1 -r
echo ""

if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo -e "${RED}Aborted.${NC}"
    exit 0
fi

# Generate test tag
TEST_TAG="v${CURRENT_VERSION}-test"

echo -e "${BLUE}Test tag:${NC} $TEST_TAG"
echo ""

# Check if tag exists
if git rev-parse "$TEST_TAG" >/dev/null 2>&1; then
    echo -e "${YELLOW}Tag already exists. Delete it first? (y/n):${NC}"
    read -p "" -n 1 -r
    echo ""
    
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        echo -e "${BLUE}Deleting local tag...${NC}"
        git tag -d "$TEST_TAG"
        
        echo -e "${BLUE}Deleting remote tag...${NC}"
        git push origin ":refs/tags/$TEST_TAG" || echo "Remote tag doesn't exist"
        
        echo -e "${GREEN}✅ Tag deleted${NC}"
    else
        echo -e "${RED}Aborted.${NC}"
        exit 1
    fi
fi

# Confirm current branch
CURRENT_BRANCH=$(git branch --show-current)
echo -e "${BLUE}Current branch:${NC} $CURRENT_BRANCH"
echo ""

# Create tag
echo -e "${BLUE}Creating test tag...${NC}"
git tag -a "$TEST_TAG" -m "Test release for GitHub Actions verification"

# Check if remote exists
if ! git remote get-url origin >/dev/null 2>&1; then
    echo -e "${RED}❌ No remote 'origin' configured${NC}"
    echo -e "${YELLOW}Add a remote first:${NC}"
    echo "  git remote add origin <your-repo-url>"
    exit 1
fi

REMOTE_URL=$(git remote get-url origin)
echo -e "${BLUE}Remote URL:${NC} $REMOTE_URL"
echo ""

# Extract repo info
if [[ $REMOTE_URL =~ github.com[:/]([^/]+)/([^/.]+) ]]; then
    OWNER="${BASH_REMATCH[1]}"
    REPO="${BASH_REMATCH[2]}"
    
    echo -e "${GREEN}✅ GitHub repository detected${NC}"
    echo -e "${BLUE}Owner:${NC} $OWNER"
    echo -e "${BLUE}Repo:${NC} $REPO"
    echo ""
fi

# Push tag
echo -e "${YELLOW}Ready to push tag. This will trigger GitHub Actions.${NC}"
read -p "Continue? (y/n): " -n 1 -r
echo ""

if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo -e "${RED}Aborted. Cleaning up local tag...${NC}"
    git tag -d "$TEST_TAG"
    exit 0
fi

echo -e "${BLUE}Pushing tag to remote...${NC}"
git push origin "$TEST_TAG"

echo ""
echo -e "${GREEN}✅ Test tag pushed successfully!${NC}"
echo ""
echo -e "${BLUE}═══════════════════════════════════════════════════${NC}"
echo -e "${GREEN}🎉 GitHub Actions workflow has been triggered!${NC}"
echo -e "${BLUE}═══════════════════════════════════════════════════${NC}"
echo ""
echo -e "${YELLOW}Next steps:${NC}"
echo ""
echo -e "1. Monitor the build:"
if [[ -n "${OWNER:-}" && -n "${REPO:-}" ]]; then
    echo -e "   ${BLUE}https://github.com/$OWNER/$REPO/actions${NC}"
fi
echo ""
echo -e "2. Check the release (after build completes):"
if [[ -n "${OWNER:-}" && -n "${REPO:-}" ]]; then
    echo -e "   ${BLUE}https://github.com/$OWNER/$REPO/releases/tag/$TEST_TAG${NC}"
fi
echo ""
echo -e "3. Verify packages:"
echo -e "   - 3 Ubuntu versions (20.04, 22.04, 24.04)"
echo -e "   - 3 package formats (.deb, .rpm, .zip)"
echo -e "   - Total: 9 packages"
echo ""
echo -e "4. ${YELLOW}Delete test release after verification:${NC}"
echo -e "   - Go to Releases page"
echo -e "   - Click on the test release"
echo -e "   - Click 'Delete' button"
echo -e "   - Then run: ${BLUE}git push origin :refs/tags/$TEST_TAG${NC}"
echo ""
echo -e "${BLUE}═══════════════════════════════════════════════════${NC}"
echo ""
echo -e "${GREEN}Build time: ~15-30 minutes${NC}"
echo ""
echo -e "${YELLOW}Tip:${NC} Enable GitHub notifications to get alerts when build completes"
echo ""

