#!/bin/bash

# Docker Hub Publishing Script for Downlodr
# Publishes multi-architecture Docker images to Docker Hub

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
DOCKER_USERNAME="${DOCKER_USERNAME:-}"
DOCKER_REPO="${DOCKER_REPO:-downlodr}"
VERSION="${1:-latest}"
PLATFORMS="linux/amd64,linux/arm64"

print_banner() {
    echo -e "${BLUE}"
    echo "╔══════════════════════════════════════════════════════════════╗"
    echo "║                 Downlodr Docker Publisher                    ║"
    echo "║              Multi-Architecture Image Builder                ║"
    echo "╚══════════════════════════════════════════════════════════════╝"
    echo -e "${NC}"
}

print_help() {
    echo -e "${YELLOW}Usage: $0 [version]${NC}"
    echo ""
    echo "Examples:"
    echo "  $0                    # Build and push as 'latest'"
    echo "  $0 v1.7.7             # Build and push as 'v1.7.7'"
    echo "  $0 stable             # Build and push as 'stable'"
    echo ""
    echo "Environment Variables:"
    echo "  DOCKER_USERNAME       # Your Docker Hub username"
    echo "  DOCKER_REPO           # Repository name (default: downlodr)"
    echo ""
    echo "Prerequisites:"
    echo "  - Docker logged in: docker login"
    echo "  - Buildx enabled: docker buildx create --use"
    echo ""
}

check_prerequisites() {
    echo -e "${BLUE}Checking prerequisites...${NC}"

    # Check Docker
    if ! command -v docker &> /dev/null; then
        echo -e "${RED}Error: Docker is not installed${NC}"
        exit 1
    fi

    # Check Docker login
    if ! docker info &> /dev/null; then
        echo -e "${RED}Error: Docker daemon not running${NC}"
        exit 1
    fi

    # Check Docker Hub login
    if ! docker system info | grep -q "Username:"; then
        echo -e "${RED}Error: Not logged into Docker Hub${NC}"
        echo "Please run: docker login"
        exit 1
    fi

    # Get username if not set
    if [[ -z "$DOCKER_USERNAME" ]]; then
        DOCKER_USERNAME=$(docker system info | grep "Username:" | awk '{print $2}')
        echo -e "${YELLOW}Using Docker username: $DOCKER_USERNAME${NC}"
    fi

    # Check buildx
    if ! docker buildx version &> /dev/null; then
        echo -e "${RED}Error: Docker Buildx not available${NC}"
        echo "Please enable Docker Buildx"
        exit 1
    fi

    echo -e "${GREEN}✓ Prerequisites check passed${NC}"
}

setup_buildx() {
    echo -e "${BLUE}Setting up Docker Buildx...${NC}"

    # Create builder if it doesn't exist
    if ! docker buildx ls | grep -q "downlodr-builder"; then
        docker buildx create --name downlodr-builder --use
        echo -e "${GREEN}✓ Created buildx builder: downlodr-builder${NC}"
    else
        docker buildx use downlodr-builder
        echo -e "${GREEN}✓ Using existing builder: downlodr-builder${NC}"
    fi

    # Bootstrap builder
    docker buildx inspect --bootstrap
}

build_and_push() {
    local image_tag="$DOCKER_USERNAME/$DOCKER_REPO:$VERSION"
    local latest_tag="$DOCKER_USERNAME/$DOCKER_REPO:latest"

    echo -e "${BLUE}Building and pushing multi-architecture image...${NC}"
    echo "Image: $image_tag"
    echo "Platforms: $PLATFORMS"
    echo ""

    # Build arguments
    local build_args=(
        --platform "$PLATFORMS"
        --tag "$image_tag"
        --push
        --file Dockerfile
        .
    )

    # Add latest tag if version is not latest
    if [[ "$VERSION" != "latest" ]]; then
        build_args+=(--tag "$latest_tag")
    fi

    # Build and push
    docker buildx build "${build_args[@]}"

    echo -e "${GREEN}✓ Successfully built and pushed: $image_tag${NC}"
    if [[ "$VERSION" != "latest" ]]; then
        echo -e "${GREEN}✓ Also tagged as: $latest_tag${NC}"
    fi
}

generate_user_instructions() {
    local image_tag="$DOCKER_USERNAME/$DOCKER_REPO:$VERSION"

    echo -e "${BLUE}Generating user instructions...${NC}"

    cat > docker-run-instructions.md << EOF
# Running Downlodr from Docker Hub

## Quick Start

### Option 1: Simple Run (Recommended)
\`\`\`bash
docker run -d \\
  --name downlodr \\
  -p 8000:8080 \\
  -p 5900:5900 \\
  -v \$(pwd)/downloads:/app/downloads \\
  $image_tag
\`\`\`

**Access**: http://localhost:8000

### Option 2: With Data Persistence
\`\`\`bash
docker run -d \\
  --name downlodr \\
  -p 8000:8080 \\
  -p 5900:5900 \\
  -v \$(pwd)/downloads:/app/downloads \\
  -v \$(pwd)/data:/app/data \\
  --restart unless-stopped \\
  $image_tag
\`\`\`

### Option 3: Using Docker Compose
Create \`docker-compose.yml\`:
\`\`\`yaml
version: '3.8'
services:
  downlodr:
    image: $image_tag
    container_name: downlodr
    ports:
      - "8000:8080"
      - "5900:5900"
    volumes:
      - ./downloads:/app/downloads
      - ./data:/app/data
    restart: unless-stopped

  novnc:
    image: theasp/novnc:latest
    container_name: downlodr-web
    ports:
      - "8000:8080"
    command: ["websockify", "--web=/usr/share/novnc/", "8080", "downlodr:5900"]
    depends_on:
      - downlodr
\`\`\`

Run: \`docker-compose up -d\`

## Access Methods

- 🌐 **Web Browser**: http://localhost:8000
- 🖥️ **VNC Client**: vnc://localhost:5900

## Management Commands

\`\`\`bash
# View logs
docker logs -f downlodr

# Stop container
docker stop downlodr

# Remove container
docker rm downlodr

# Update to latest
docker pull $image_tag
docker stop downlodr && docker rm downlodr
# Then run again with same command
\`\`\`

## Supported Platforms

- ✅ Linux AMD64 (Intel/AMD)
- ✅ Linux ARM64 (Apple Silicon, Raspberry Pi 4+)
- ✅ macOS (via Docker Desktop)
- ✅ Windows (via Docker Desktop)

## Troubleshooting

**Port already in use**: Change \`8000:8080\` to \`8001:8080\`
**Permission issues**: Run \`chmod 755 downloads data\`
**Can't access GUI**: Try VNC client: vnc://localhost:5900
EOF

    echo -e "${GREEN}✓ Created docker-run-instructions.md${NC}"
}

create_release_package() {
    echo -e "${BLUE}Creating release package...${NC}"

    # Create release directory
    mkdir -p release-package
    cd release-package

    # Copy essential files
    cp ../docker-run-instructions.md ./
    cp ../docker-compose.yml ./
    cp ../README.md ./ 2>/dev/null || echo "# Downlodr Docker" > README.md

    # Create simple run script
    cat > run-downlodr.sh << 'EOF'
#!/bin/bash

# Simple Downlodr launcher
set -e

IMAGE="$1"
if [[ -z "$IMAGE" ]]; then
    echo "Usage: $0 <docker-image>"
    echo "Example: $0 username/downlodr:latest"
    exit 1
fi

echo "🚀 Starting Downlodr..."
echo "Image: $IMAGE"

# Create directories
mkdir -p downloads data

# Stop existing container
docker stop downlodr 2>/dev/null || true
docker rm downlodr 2>/dev/null || true

# Run container
docker run -d \
  --name downlodr \
  -p 8000:8080 \
  -p 5900:5900 \
  -v $(pwd)/downloads:/app/downloads \
  -v $(pwd)/data:/app/data \
  --restart unless-stopped \
  "$IMAGE"

echo "✅ Downlodr started!"
echo "🌐 Web access: http://localhost:8000"
echo "🖥️  VNC access: vnc://localhost:5900"
echo ""
echo "Management commands:"
echo "  docker logs -f downlodr    # View logs"
echo "  docker stop downlodr       # Stop app"
echo "  docker start downlodr      # Start app"
EOF

    chmod +x run-downlodr.sh

    # Create archive
    cd ..
    tar -czf downlodr-docker-${VERSION}.tar.gz release-package/
    zip -r downlodr-docker-${VERSION}.zip release-package/

    echo -e "${GREEN}✓ Created release packages:${NC}"
    echo "  - downlodr-docker-${VERSION}.tar.gz"
    echo "  - downlodr-docker-${VERSION}.zip"
}

# Main execution
print_banner

if [[ "${1:-}" == "help" ]] || [[ "${1:-}" == "--help" ]] || [[ "${1:-}" == "-h" ]]; then
    print_help
    exit 0
fi

echo -e "${YELLOW}Publishing Downlodr to Docker Hub${NC}"
echo "Version: $VERSION"
echo "Repository: $DOCKER_USERNAME/$DOCKER_REPO"
echo "Platforms: $PLATFORMS"
echo ""

check_prerequisites
setup_buildx
build_and_push
generate_user_instructions
create_release_package

echo ""
echo -e "${GREEN}🎉 Publication complete!${NC}"
echo ""
echo -e "${BLUE}Docker Hub Image:${NC}"
echo "  docker pull $DOCKER_USERNAME/$DOCKER_REPO:$VERSION"
echo ""
echo -e "${BLUE}Users can run with:${NC}"
echo "  docker run -d -p 8000:8080 -p 5900:5900 -v \$(pwd)/downloads:/app/downloads $DOCKER_USERNAME/$DOCKER_REPO:$VERSION"
echo ""
echo -e "${BLUE}Or download release package:${NC}"
echo "  - downlodr-docker-${VERSION}.tar.gz"
echo "  - downlodr-docker-${VERSION}.zip"
echo ""
echo -e "${YELLOW}Next steps:${NC}"
echo "1. Upload release packages to GitHub Releases"
echo "2. Update README with Docker instructions"
echo "3. Announce availability to users"