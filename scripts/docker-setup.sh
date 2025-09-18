#!/bin/bash

# Docker Setup Script for Downlodr
# Separate from existing build scripts - provides containerized deployment option
# Usage: ./scripts/docker-setup.sh [command]

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Project info
PROJECT_NAME="downlodr"
DOCKER_IMAGE="downlodr:latest"
CONTAINER_NAME="downlodr-app"
VNC_PORT=5900
WEB_PORT=8000

print_banner() {
    echo -e "${BLUE}"
    echo "╔══════════════════════════════════════════════════════════════╗"
    echo "║                    Downlodr Docker Setup                     ║"
    echo "║              Cross-Platform Containerized Deployment         ║"
    echo "╚══════════════════════════════════════════════════════════════╝"
    echo -e "${NC}"
}

print_help() {
    echo -e "${YELLOW}Usage: $0 [command]${NC}"
    echo ""
    echo "Commands:"
    echo "  build     - Build Docker image"
    echo "  run       - Run container (production mode)"
    echo "  dev       - Run container (development mode)"
    echo "  stop      - Stop running container"
    echo "  clean     - Remove container and image"
    echo "  logs      - Show container logs"
    echo "  shell     - Open shell in running container"
    echo "  status    - Show container status"
    echo "  setup     - Complete setup (build + run)"
    echo "  help      - Show this help"
    echo ""
    echo "Access methods after running:"
    echo "  VNC Client: vnc://localhost:$VNC_PORT"
    echo "  Web Browser: http://localhost:$WEB_PORT"
    echo ""
}

check_docker() {
    if ! command -v docker &> /dev/null; then
        echo -e "${RED}Error: Docker is not installed or not in PATH${NC}"
        echo "Please install Docker from: https://docs.docker.com/get-docker/"
        exit 1
    fi

    if ! docker info &> /dev/null; then
        echo -e "${RED}Error: Docker daemon is not running${NC}"
        echo "Please start Docker and try again"
        exit 1
    fi
}

check_docker_compose() {
    if ! command -v docker-compose &> /dev/null; then
        echo -e "${YELLOW}Warning: docker-compose not found, using docker compose instead${NC}"
        DOCKER_COMPOSE="docker compose"
    else
        DOCKER_COMPOSE="docker-compose"
    fi
}

create_docker_compose() {
    echo -e "${BLUE}Creating docker-compose.yml...${NC}"

    cat > docker-compose.yml << 'EOF'
version: '3.8'

services:
  downlodr:
    build: .
    container_name: downlodr-app
    ports:
      - "5900:5900"    # VNC
      - "8000:8080"    # Web VNC (noVNC)
    volumes:
      - ./downloads:/app/downloads
      - ./data:/app/data
      - /tmp/.X11-unix:/tmp/.X11-unix:rw
    environment:
      - DISPLAY=:99
      - NODE_ENV=production
      - ELECTRON_DISABLE_SECURITY_WARNINGS=true
    restart: unless-stopped
    healthcheck:
      test: ["CMD", "pgrep", "-f", "electron"]
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: 60s

  # noVNC for web browser access
  novnc:
    image: theasp/novnc:latest
    container_name: downlodr-novnc
    ports:
      - "8000:8080"
    environment:
      - DISPLAY_WIDTH=1280
      - DISPLAY_HEIGHT=720
      - RUN_XTERM=no
    depends_on:
      - downlodr
    command: ["websockify", "--web=/usr/share/novnc/", "8080", "downlodr:5900"]
    restart: unless-stopped

networks:
  default:
    name: downlodr-network
EOF

    echo -e "${GREEN}✓ docker-compose.yml created${NC}"
}

create_dockerignore() {
    echo -e "${BLUE}Creating .dockerignore...${NC}"

    cat > .dockerignore << 'EOF'
# Node modules
node_modules/
npm-debug.log*
yarn-debug.log*
yarn-error.log*

# Build outputs
out/
dist/
.vite/
*.dmg
*.pkg
*.deb
*.rpm
*.exe
*.msi

# Development files
.env.local
.env.development.local
.env.test.local
.env.production.local

# IDE
.vscode/
.idea/
*.swp
*.swo

# OS
.DS_Store
Thumbs.db

# Git
.git/
.gitignore

# Documentation
docs/
*.md
!README.md
!DOCKER_SETUP.md

# Logs
logs/
*.log

# Downloads (will be mounted)
downloads/
data/

# Scripts (except docker-related)
scripts/build-*
scripts/test-*
scripts/diagnose-*
!scripts/docker-*
!scripts/verify-binaries.sh

# Test files
test-*
debug-*
fix-*
validate-*

# Temporary files
tmp/
temp/
EOF

    echo -e "${GREEN}✓ .dockerignore created${NC}"
}

build_image() {
    echo -e "${BLUE}Building Docker image...${NC}"
    echo "Architecture: $(uname -m)"
    echo "Platform: $(uname -s)"

    docker build -t $DOCKER_IMAGE . \
        --build-arg BUILDKIT_INLINE_CACHE=1 \
        --progress=plain

    echo -e "${GREEN}✓ Docker image built successfully${NC}"
}

run_container() {
    local mode=${1:-production}

    echo -e "${BLUE}Starting Downlodr container in $mode mode...${NC}"

    # Create necessary directories
    mkdir -p downloads data

    # Stop existing container if running
    stop_container 2>/dev/null || true

    if [[ "$mode" == "development" ]]; then
        # Development mode with source mounting
        docker run -d \
            --name $CONTAINER_NAME \
            -p $VNC_PORT:5900 \
            -p 8001:8080 \
            -v "$(pwd):/app:rw" \
            -v "$(pwd)/downloads:/app/downloads:rw" \
            -v "$(pwd)/data:/app/data:rw" \
            -v /tmp/.X11-unix:/tmp/.X11-unix:rw \
            -e DISPLAY=:99 \
            -e NODE_ENV=development \
            --restart unless-stopped \
            $DOCKER_IMAGE

        echo -e "${GREEN}✓ Development container started${NC}"
        echo -e "${YELLOW}Access: http://localhost:8001${NC}"
    else
        # Production mode
        $DOCKER_COMPOSE up -d

        echo -e "${GREEN}✓ Production containers started${NC}"
        echo -e "${YELLOW}Access: http://localhost:$WEB_PORT${NC}"
    fi

    echo ""
    echo -e "${BLUE}Access Methods:${NC}"
    echo "  🌐 Web Browser: http://localhost:$WEB_PORT"
    echo "  🖥️  VNC Client: vnc://localhost:$VNC_PORT"
    echo ""
    echo -e "${BLUE}Container Commands:${NC}"
    echo "  📋 View logs: $0 logs"
    echo "  🛑 Stop: $0 stop"
    echo "  🔍 Status: $0 status"
}

stop_container() {
    echo -e "${BLUE}Stopping Downlodr containers...${NC}"

    if [[ -f "docker-compose.yml" ]]; then
        $DOCKER_COMPOSE down
    fi

    # Also stop standalone container if running
    if docker ps -q -f name=$CONTAINER_NAME | grep -q .; then
        docker stop $CONTAINER_NAME
        docker rm $CONTAINER_NAME
    fi

    echo -e "${GREEN}✓ Containers stopped${NC}"
}

clean_all() {
    echo -e "${YELLOW}Cleaning up Docker resources...${NC}"

    # Stop containers
    stop_container

    # Remove images
    if docker images -q $DOCKER_IMAGE | grep -q .; then
        docker rmi $DOCKER_IMAGE
        echo -e "${GREEN}✓ Docker image removed${NC}"
    fi

    # Clean build cache
    docker builder prune -f

    echo -e "${GREEN}✓ Cleanup complete${NC}"
}

show_logs() {
    if [[ -f "docker-compose.yml" ]]; then
        $DOCKER_COMPOSE logs -f
    elif docker ps -q -f name=$CONTAINER_NAME | grep -q .; then
        docker logs -f $CONTAINER_NAME
    else
        echo -e "${RED}No running containers found${NC}"
    fi
}

open_shell() {
    if docker ps -q -f name=$CONTAINER_NAME | grep -q .; then
        docker exec -it $CONTAINER_NAME sh
    else
        echo -e "${RED}Container not running. Start it first with: $0 run${NC}"
    fi
}

show_status() {
    echo -e "${BLUE}Docker Status:${NC}"

    # Check if containers are running
    if docker ps -q -f name=$CONTAINER_NAME | grep -q .; then
        echo -e "${GREEN}✓ Downlodr container: RUNNING${NC}"
    else
        echo -e "${RED}✗ Downlodr container: STOPPED${NC}"
    fi

    if docker ps -q -f name=downlodr-novnc | grep -q .; then
        echo -e "${GREEN}✓ noVNC container: RUNNING${NC}"
    else
        echo -e "${RED}✗ noVNC container: STOPPED${NC}"
    fi

    # Show port mappings
    echo ""
    echo -e "${BLUE}Port Mappings:${NC}"
    docker ps --filter name=downlodr --format "table {{.Names}}\t{{.Ports}}" 2>/dev/null || echo "No containers running"

    # Show resource usage
    echo ""
    echo -e "${BLUE}Resource Usage:${NC}"
    docker stats --no-stream --filter name=downlodr 2>/dev/null || echo "No containers running"
}

complete_setup() {
    echo -e "${BLUE}Running complete Docker setup...${NC}"

    create_docker_compose
    create_dockerignore
    build_image
    run_container production

    echo ""
    echo -e "${GREEN}🎉 Setup complete!${NC}"
    echo ""
    echo -e "${BLUE}Next steps:${NC}"
    echo "1. Open http://localhost:$WEB_PORT in your browser"
    echo "2. Or use VNC client: vnc://localhost:$VNC_PORT"
    echo "3. Downloads will be saved to ./downloads/"
    echo ""
    echo -e "${YELLOW}Useful commands:${NC}"
    echo "  $0 logs   - View application logs"
    echo "  $0 stop   - Stop the application"
    echo "  $0 status - Check application status"
}

# Main script logic
print_banner

case "${1:-help}" in
    build)
        check_docker
        create_dockerignore
        build_image
        ;;
    run)
        check_docker
        check_docker_compose
        run_container production
        ;;
    dev)
        check_docker
        run_container development
        ;;
    stop)
        check_docker
        stop_container
        ;;
    clean)
        check_docker
        clean_all
        ;;
    logs)
        check_docker
        show_logs
        ;;
    shell)
        check_docker
        open_shell
        ;;
    status)
        check_docker
        show_status
        ;;
    setup)
        check_docker
        check_docker_compose
        complete_setup
        ;;
    help|--help|-h)
        print_help
        ;;
    *)
        echo -e "${RED}Unknown command: $1${NC}"
        print_help
        exit 1
        ;;
esac