# Docker Setup for Downlodr (React + Electron App)

This document provides comprehensive instructions for dockerizing and running the Downlodr application using Docker.

## Overview

Downlodr is an **Electron + React desktop application** for downloading videos from various platforms. Built with:

- **Electron Forge**: Application packaging and development
- **React**: User interface components  
- **Vite**: Build tooling and development server
- **TypeScript**: Type-safe development

The Docker setup includes:

- **GUI Support**: Access the Electron app via VNC
- **Volume Mounting**: Persistent storage for downloads and app data
- **Multi-stage Build**: Optimized production image
- **Security**: Non-root user execution
- **React Hot Reload**: Development mode support

## Files Created

### Docker Files
- `Dockerfile` - Production-optimized multi-stage build
- `Dockerfile.dev` - Development version with enhanced debugging
- `docker-compose.yml` - Complete orchestration setup
- `.dockerignore` - Excludes unnecessary files from build context

## Quick Start

### Using Docker Compose (Recommended)

1. **Build and start the Electron + React application:**
   ```bash
   # Production mode (runs yarn start via Electron Forge)
   docker-compose up --build
   
   # Development mode (with React hot-reload)
   docker-compose -f docker-compose.dev.yml up --build
   ```

2. **Access the application:**
   - **VNC Client**: Connect to `localhost:5900` (no password)
   - **Web Browser**: Visit `http://localhost:8080` for web-based VNC

3. **Stop the application:**
   ```bash
   docker-compose down
   ```

### Using Makefile (Simplified Commands)

```bash
# Production setup (Electron Forge + React)
make setup

# Development setup (with React hot-reload)
make setup-dev

# Electron-specific commands
make electron-start     # Start Electron app directly
make electron-package   # Package the app
make electron-make      # Create distributables

# View logs
make logs              # Production logs
make logs-dev          # Development logs
```

### Using Docker Commands

1. **Build the image:**
   ```bash
   docker build -t downlodr:latest .
   ```

2. **Run the container:**
   ```bash
   docker run -d \
     --name downlodr-app \
     -p 5900:5900 \
     -v $(pwd)/downloads:/app/downloads \
     -v $(pwd)/data:/app/data \
     downlodr:latest
   ```

## Configuration

### Environment Variables

- `DISPLAY` - X11 display (default: :99)
- `NODE_ENV` - Node environment (default: production)
- `ELECTRON_DISABLE_SECURITY_WARNINGS` - Disable Electron warnings

### Volume Mounts

- `/app/downloads` - Downloaded files storage
- `/app/data` - Application data and settings
- `/tmp/.X11-unix` - X11 socket (optional for native X11)

### Port Mapping

- `5900` - VNC server port
- `8080` - Web VNC client (when using docker-compose)

## Development Setup

For development with hot-reloading and debugging:

1. **Use the development Dockerfile:**
   ```bash
   docker build -f Dockerfile.dev -t downlodr:dev .
   ```

2. **Run with source code mounting:**
   ```bash
   docker run -d \
     --name downlodr-dev \
     -p 5900:5900 \
     -v $(pwd):/app \
     -v $(pwd)/downloads:/app/downloads \
     -v /tmp/.X11-unix:/tmp/.X11-unix:rw \
     -e DISPLAY=$DISPLAY \
     downlodr:dev
   ```

## Accessing the Application

### VNC Clients

**macOS:**
- Built-in Screen Sharing: `vnc://localhost:5900`
- TigerVNC Viewer
- RealVNC Viewer

**Windows:**
- TigerVNC Viewer
- UltraVNC
- RealVNC Viewer

**Linux:**
- Remmina
- TigerVNC Viewer
- Vinagre

### Web Browser Access

When using docker-compose, access the application at:
`http://localhost:8080`

This provides a web-based VNC client that works in any modern browser.

## Troubleshooting

### Common Issues

1. **Application won't start:**
   ```bash
   docker logs downlodr-app
   ```

2. **VNC connection refused:**
   - Check if port 5900 is available
   - Ensure container is running: `docker ps`

3. **Missing binaries:**
   - Verify yt-dlp download in container
   - Check binaries directory permissions

4. **Permission issues:**
   - Ensure download directories are writable
   - Check user permissions in container

### Debugging Commands

1. **Enter container shell:**
   ```bash
   docker exec -it downlodr-app sh
   ```

2. **Check running processes:**
   ```bash
   docker exec downlodr-app ps aux
   ```

3. **View container logs:**
   ```bash
   docker logs -f downlodr-app
   ```

4. **Check X11 server:**
   ```bash
   docker exec downlodr-app ps aux | grep Xvfb
   ```

## Performance Optimization

### For Better Performance:

1. **Allocate more memory:**
   ```bash
   docker run --memory=2g --cpus=2 downlodr:latest
   ```

2. **Use SSD storage:**
   Mount downloads directory to SSD location

3. **Network optimization:**
   ```bash
   docker run --network=host downlodr:latest
   ```

## Security Considerations

1. **Non-root user**: Container runs as `electron` user (UID 1001)
2. **No password VNC**: Consider using SSH tunneling for remote access
3. **Volume permissions**: Ensure proper file permissions on mounted volumes
4. **Network exposure**: Limit VNC port exposure in production

## Platform-Specific Notes

### macOS
- X11 forwarding may require XQuartz installation
- Use `host.docker.internal` for localhost connections

### Windows
- WSL2 recommended for Docker Desktop
- Use Windows paths for volume mounting

### Linux
- Native X11 forwarding supported
- Consider using `--network=host` for better performance

## Maintenance

### Updating the Application

1. **Pull latest changes:**
   ```bash
   git pull origin main
   ```

2. **Rebuild image:**
   ```bash
   docker-compose build --no-cache
   ```

3. **Restart services:**
   ```bash
   docker-compose up -d
   ```

### Cleaning Up

1. **Remove containers:**
   ```bash
   docker-compose down -v
   ```

2. **Clean unused images:**
   ```bash
   docker image prune -a
   ```

3. **Clean build cache:**
   ```bash
   docker builder prune -a
   ```

## Support

For issues related to:
- **Docker setup**: Check this documentation and Docker logs
- **Application functionality**: Refer to main project README
- **VNC connection**: Verify network connectivity and firewall settings

## Next Steps

1. Test the Docker setup with your environment
2. Customize environment variables as needed
3. Set up automated builds if deploying to production
4. Consider using Docker secrets for sensitive configuration
5. Implement monitoring and logging solutions

---

*This Docker setup provides a complete containerized environment for running Downlodr with GUI support via VNC.*
