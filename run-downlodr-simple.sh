#!/bin/bash

# Simple Downlodr Docker Launcher
# For users who just want to run Downlodr without technical setup

set -e

# Colors
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

# Configuration
DEFAULT_IMAGE="username/downlodr:latest"  # Update with your Docker Hub username
CONTAINER_NAME="downlodr"
WEB_PORT=8000
VNC_PORT=5900

print_banner() {
    echo -e "${BLUE}"
    echo "╔══════════════════════════════════════════════════════════════╗"
    echo "║                      🎬 Downlodr                             ║"
    echo "║                  Easy Docker Launcher                        ║"
    echo "╚══════════════════════════════════════════════════════════════╝"
    echo -e "${NC}"
}

check_docker() {
    if ! command -v docker &> /dev/null; then
        echo -e "${RED}❌ Docker is not installed${NC}"
        echo ""
        echo "Please install Docker first:"
        echo "  • macOS/Windows: https://www.docker.com/products/docker-desktop"
        echo "  • Linux: https://docs.docker.com/engine/install/"
        echo ""
        exit 1
    fi

    if ! docker info &> /dev/null; then
        echo -e "${RED}❌ Docker is not running${NC}"
        echo ""
        echo "Please start Docker and try again:"
        echo "  • macOS/Windows: Open Docker Desktop"
        echo "  • Linux: sudo systemctl start docker"
        echo ""
        exit 1
    fi

    echo -e "${GREEN}✅ Docker is ready${NC}"
}

setup_directories() {
    echo -e "${BLUE}📁 Setting up directories...${NC}"

    mkdir -p downloads
    mkdir -p data

    echo -e "${GREEN}✅ Created downloads/ and data/ folders${NC}"
}

stop_existing() {
    if docker ps -q -f name=$CONTAINER_NAME | grep -q .; then
        echo -e "${YELLOW}⏹️  Stopping existing Downlodr...${NC}"
        docker stop $CONTAINER_NAME >/dev/null 2>&1
    fi

    if docker ps -aq -f name=$CONTAINER_NAME | grep -q .; then
        echo -e "${YELLOW}🗑️  Removing old container...${NC}"
        docker rm $CONTAINER_NAME >/dev/null 2>&1
    fi
}

pull_image() {
    local image=${1:-$DEFAULT_IMAGE}

    echo -e "${BLUE}📥 Downloading Downlodr (this may take a few minutes)...${NC}"
    echo "Image: $image"

    if docker pull "$image"; then
        echo -e "${GREEN}✅ Download complete${NC}"
    else
        echo -e "${RED}❌ Failed to download image: $image${NC}"
        echo ""
        echo "Please check:"
        echo "  • Internet connection"
        echo "  • Image name is correct"
        echo "  • Docker Hub is accessible"
        exit 1
    fi
}

start_container() {
    local image=${1:-$DEFAULT_IMAGE}

    echo -e "${BLUE}🚀 Starting Downlodr...${NC}"

    docker run -d \
        --name $CONTAINER_NAME \
        -p $WEB_PORT:8080 \
        -p $VNC_PORT:5900 \
        -v "$(pwd)/downloads:/app/downloads" \
        -v "$(pwd)/data:/app/data" \
        --restart unless-stopped \
        "$image" > /dev/null

    echo -e "${GREEN}✅ Downlodr is starting up!${NC}"
}

wait_for_startup() {
    echo -e "${BLUE}⏳ Waiting for Downlodr to be ready...${NC}"

    local max_attempts=30
    local attempt=1

    while [ $attempt -le $max_attempts ]; do
        if docker exec $CONTAINER_NAME pgrep -f electron >/dev/null 2>&1; then
            echo -e "${GREEN}✅ Downlodr is ready!${NC}"
            return 0
        fi

        echo -n "."
        sleep 2
        ((attempt++))
    done

    echo -e "${YELLOW}⚠️  Downlodr may still be starting up...${NC}"
    echo "Check logs with: docker logs $CONTAINER_NAME"
}

show_access_info() {
    echo ""
    echo -e "${GREEN}🎉 Downlodr is running!${NC}"
    echo ""
    echo -e "${BLUE}🌐 Access Methods:${NC}"
    echo "  • Web Browser: http://localhost:$WEB_PORT"
    echo "  • VNC Client: vnc://localhost:$VNC_PORT"
    echo ""
    echo -e "${BLUE}📁 Your Downloads:${NC}"
    echo "  • Videos will be saved to: $(pwd)/downloads/"
    echo ""
    echo -e "${BLUE}🔧 Management Commands:${NC}"
    echo "  • View logs: docker logs -f $CONTAINER_NAME"
    echo "  • Stop app: docker stop $CONTAINER_NAME"
    echo "  • Start app: docker start $CONTAINER_NAME"
    echo "  • Remove app: docker stop $CONTAINER_NAME && docker rm $CONTAINER_NAME"
    echo ""
    echo -e "${YELLOW}💡 Tip: Bookmark http://localhost:$WEB_PORT for easy access!${NC}"
}

open_browser() {
    echo -e "${BLUE}🌐 Opening web browser...${NC}"

    if command -v open >/dev/null 2>&1; then
        # macOS
        open "http://localhost:$WEB_PORT"
    elif command -v xdg-open >/dev/null 2>&1; then
        # Linux
        xdg-open "http://localhost:$WEB_PORT"
    elif command -v start >/dev/null 2>&1; then
        # Windows
        start "http://localhost:$WEB_PORT"
    else
        echo -e "${YELLOW}Please open http://localhost:$WEB_PORT in your browser${NC}"
    fi
}

# Main execution
print_banner

echo -e "${BLUE}🎬 Welcome to Downlodr Docker Launcher!${NC}"
echo ""

# Handle command line arguments
case "${1:-}" in
    "help"|"--help"|"-h")
        echo "Usage: $0 [docker-image]"
        echo ""
        echo "Examples:"
        echo "  $0                           # Use default image"
        echo "  $0 myuser/downlodr:latest    # Use specific image"
        echo ""
        echo "The script will:"
        echo "  1. Check Docker installation"
        echo "  2. Download Downlodr image"
        echo "  3. Start the application"
        echo "  4. Open web browser"
        echo ""
        exit 0
        ;;
    "stop")
        echo -e "${YELLOW}⏹️  Stopping Downlodr...${NC}"
        docker stop $CONTAINER_NAME 2>/dev/null || echo "Container not running"
        echo -e "${GREEN}✅ Stopped${NC}"
        exit 0
        ;;
    "remove")
        echo -e "${YELLOW}🗑️  Removing Downlodr...${NC}"
        docker stop $CONTAINER_NAME 2>/dev/null || true
        docker rm $CONTAINER_NAME 2>/dev/null || true
        echo -e "${GREEN}✅ Removed${NC}"
        exit 0
        ;;
    "logs")
        docker logs -f $CONTAINER_NAME
        exit 0
        ;;
    "status")
        if docker ps -q -f name=$CONTAINER_NAME | grep -q .; then
            echo -e "${GREEN}✅ Downlodr is running${NC}"
            echo "Access: http://localhost:$WEB_PORT"
        else
            echo -e "${RED}❌ Downlodr is not running${NC}"
            echo "Run: $0"
        fi
        exit 0
        ;;
esac

# Main workflow
image=${1:-$DEFAULT_IMAGE}

check_docker
setup_directories
stop_existing
pull_image "$image"
start_container "$image"
wait_for_startup
show_access_info

# Ask user if they want to open browser
echo ""
read -p "Open web browser now? (y/n): " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    open_browser
fi

echo ""
echo -e "${GREEN}🎉 Setup complete! Enjoy using Downlodr!${NC}"