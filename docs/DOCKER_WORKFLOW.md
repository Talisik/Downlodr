# Docker Workflow for Downlodr

**Standalone Docker deployment separate from existing build scripts**

## Overview

This Docker setup provides a containerized version of Downlodr that runs alongside your existing DMG/native build workflows. It's completely separate and doesn't interfere with your current build scripts.

## Quick Start

### Option 1: One-Command Setup
```bash
# Complete setup (builds + runs + configures everything)
./scripts/docker-setup.sh setup

# Access via web browser
open http://localhost:8000
```

### Option 2: Using Makefile
```bash
# Setup production environment
make setup

# Access the app
make vnc-info
```

### Option 3: Using Docker Compose
```bash
# Build and run
docker-compose up --build -d

# Access at http://localhost:8000
```

## Access Methods

🌐 **Web Browser (Recommended)**: `http://localhost:8000`
- Works on any device with a browser
- No additional software needed
- Mobile-friendly interface

🖥️ **VNC Client**: `vnc://localhost:5900`
- Native VNC clients for better performance
- Better for intensive usage

## File Structure

The Docker setup creates these files **separate** from your build scripts:

```
downlodr/
├── scripts/
│   └── docker-setup.sh          # ✨ New standalone Docker script
├── docker-compose.yml           # ✨ Updated for port 8000
├── Makefile                     # ✨ Updated with Docker commands
├── Dockerfile                   # ✅ Existing
├── DOCKER_SETUP.md             # ✅ Existing
├── scripts/build-*.sh           # ✅ Your existing build scripts (unchanged)
└── binaries/                    # ✅ Existing FFmpeg binaries
```

## Commands Reference

### Docker Setup Script Commands
```bash
# Complete workflows
./scripts/docker-setup.sh setup     # Build + run production
./scripts/docker-setup.sh dev       # Run development mode

# Individual operations
./scripts/docker-setup.sh build     # Build image only
./scripts/docker-setup.sh run       # Run production container
./scripts/docker-setup.sh stop      # Stop containers
./scripts/docker-setup.sh clean     # Remove containers + images
./scripts/docker-setup.sh logs      # View logs
./scripts/docker-setup.sh status    # Check status
./scripts/docker-setup.sh shell     # Open container shell
```

### Makefile Commands
```bash
# Quick setup
make setup                 # Production environment
make setup-dev            # Development environment

# Individual operations
make build                 # Build Docker image
make start                 # Start containers
make stop                  # Stop containers
make logs                  # View logs
make status                # Check status
make vnc-info             # Show connection info
make clean                # Clean up resources
```

### Docker Compose Commands
```bash
# Standard operations
docker-compose up -d             # Start in background
docker-compose down              # Stop containers
docker-compose logs -f           # Follow logs
docker-compose restart          # Restart services
```

## Development vs Production

### Production Mode
- **Purpose**: End-user deployment
- **Command**: `./scripts/docker-setup.sh setup`
- **Access**: `http://localhost:8000`
- **Features**: Optimized, stable, auto-restart

### Development Mode
- **Purpose**: Development/debugging
- **Command**: `./scripts/docker-setup.sh dev`
- **Access**: `http://localhost:8001`
- **Features**: Source mounting, hot-reload, debugging tools

## Directory Mapping

When Docker runs, it creates these directories:

```bash
downlodr/
├── downloads/            # ✨ Downloaded videos appear here
├── data/                # ✨ App settings and data
└── ...
```

Files downloaded in the Docker container automatically appear in your local `downloads/` folder.

## Platform Support

| Platform | Status | Notes |
|----------|--------|-------|
| **macOS Silicon** | ✅ Full Support | Uses `ffmpeg-arm64` binary |
| **macOS Intel** | ✅ Full Support | Uses `ffmpeg-x64` binary |
| **Windows** | ✅ Full Support | All architectures supported |
| **Linux** | ✅ Full Support | AMD64 and ARM64 |

## Integration with Existing Workflow

### Your Current Build Process (Unchanged)
```bash
# These continue to work exactly as before
./scripts/build-with-create-dmg.sh
./scripts/build-with-create-dmg-intel.sh
npm run make
npm run package
```

### New Docker Process (Separate)
```bash
# Completely independent Docker workflow
./scripts/docker-setup.sh setup
# OR
make setup
```

### Both Can Coexist
- ✅ Build DMG files for distribution
- ✅ Run Docker for development/testing
- ✅ No conflicts between workflows
- ✅ Same source code, different deployment methods

## Common Workflows

### Daily Development
```bash
# Start Docker environment
./scripts/docker-setup.sh dev

# Make code changes
# (Docker automatically reflects changes)

# Test in browser: http://localhost:8001
# Stop when done
./scripts/docker-setup.sh stop
```

### Creating Releases
```bash
# Build DMG for distribution (existing process)
./scripts/build-with-create-dmg.sh

# Also provide Docker option for users
docker build -t downlodr:v1.7.7 .
docker push your-registry/downlodr:v1.7.7
```

### User Deployment Options
Users can choose their preferred method:

**Traditional Installation**:
```bash
# Download DMG → Install to Applications
```

**Docker Deployment**:
```bash
# One command deployment
git clone your-repo
cd downlodr
./scripts/docker-setup.sh setup
open http://localhost:8000
```

## Troubleshooting

### Common Issues

**Port 8000 already in use**:
```bash
# Check what's using the port
lsof -i :8000

# Stop Docker to free the port
./scripts/docker-setup.sh stop
```

**Container won't start**:
```bash
# Check logs
./scripts/docker-setup.sh logs

# Check Docker status
docker ps -a
```

**Can't access GUI**:
```bash
# Verify containers are running
./scripts/docker-setup.sh status

# Try different access method
open vnc://localhost:5900
```

### Debug Commands
```bash
# Enter container shell
./scripts/docker-setup.sh shell

# Check container resources
docker stats downlodr-app

# View detailed logs
docker logs -f downlodr-app
```

## Performance Notes

### Optimal Performance
- **Web Browser**: Fastest startup, good for casual use
- **VNC Client**: Better performance for intensive usage
- **Native App**: Still fastest, use Docker for convenience

### Resource Usage
- **RAM**: ~500MB for container
- **CPU**: Similar to native app
- **Disk**: ~2GB for Docker image
- **Network**: Only for downloads (same as native)

## Security Considerations

✅ **Built-in Security**:
- Non-root user execution
- Isolated container environment
- No system-wide installations
- Controlled network access

⚠️ **Network Access**:
- VNC server listens on localhost only
- Web interface on localhost:8000
- For remote access, use SSH tunneling

## Next Steps

1. **Try it out**: `./scripts/docker-setup.sh setup`
2. **Access**: `http://localhost:8000`
3. **Download a video** to test functionality
4. **Check downloads folder** to see results
5. **Use alongside your existing build process**

## Support

For Docker-specific issues:
- Check logs: `./scripts/docker-setup.sh logs`
- View status: `./scripts/docker-setup.sh status`
- Reset everything: `./scripts/docker-setup.sh clean`

For app functionality issues:
- Use the same debugging process as native app
- Container includes all the same tools and binaries

---

*This Docker setup provides an alternative deployment method that complements your existing build process without replacing it.*