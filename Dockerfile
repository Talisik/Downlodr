# Production Dockerfile for Downlodr - Electron + React Video Downloading Application

FROM node:20-alpine AS builder

# Install build dependencies
RUN apk add --no-cache python3 make g++ libc6-compat git

# Set working directory
WORKDIR /app

# Enable corepack for yarn
RUN corepack enable

# Copy package files
COPY package.json yarn.lock* ./

# Install dependencies (including dev dependencies for building)
RUN yarn install

# Copy source code
COPY . .

# Note: For Docker, we don't run 'make' (which creates distributables)
# Instead, we prepare the app to run with 'start' command

# Production stage
FROM node:20-alpine

# Create non-root user for security
RUN addgroup -g 1001 -S nodejs && \
    adduser -S electron -u 1001

# Install runtime dependencies for Electron
RUN apk add --no-cache \
    dbus \
    ffmpeg \
    wget \
    xvfb \
    x11vnc \
    fluxbox \
    mesa-gl \
    mesa-dri-gallium \
    libxcomposite \
    libxdamage \
    libxrandr \
    libxscrnsaver \
    libxtst \
    at-spi2-core \
    gtk+3.0 \
    nss \
    chromium \
    && rm -rf /var/cache/apk/*

# Set working directory
WORKDIR /app

# Copy application from builder stage
COPY --from=builder --chown=electron:nodejs /app ./

# Download yt-dlp binary
RUN wget https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp -O /usr/local/bin/yt-dlp \
    && chmod +x /usr/local/bin/yt-dlp

# Create necessary directories
RUN mkdir -p /app/downloads /app/data && \
    chown -R electron:nodejs /app/downloads /app/data

# Set environment variables
ENV DISPLAY=:99
ENV NODE_ENV=production
ENV ELECTRON_DISABLE_SECURITY_WARNINGS=true
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true
ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium-browser

# Create startup script
COPY --chown=electron:nodejs <<EOF /app/start.sh
#!/bin/sh
set -e

echo "Starting Downlodr Docker container..."

# Start Xvfb (virtual display) and wait for it to be ready
echo "Starting virtual display..."
Xvfb :99 -screen 0 1280x720x24 -ac &
XVFB_PID=\$!

# Set display
export DISPLAY=:99

# Wait for X server to be ready
echo "Waiting for X server to be ready..."
for i in \$(seq 1 30); do
  if xdpyinfo -display :99 >/dev/null 2>&1; then
    echo "X server is ready"
    break
  fi
  echo "Waiting for X server... (\$i/30)"
  sleep 1
done

# Check if X server is running
if ! xdpyinfo -display :99 >/dev/null 2>&1; then
  echo "Error: X server failed to start"
  exit 1
fi

# Start window manager
echo "Starting window manager..."
fluxbox -display :99 &

# Wait a bit for window manager
sleep 2

# Start VNC server
echo "Starting VNC server..."
x11vnc -display :99 -nopw -listen 0.0.0.0 -xkb -ncache 10 -ncache_cr -forever -bg

# Wait for VNC to be ready
sleep 2

# Start the Electron application
echo "Starting Electron application..."
exec yarn start
EOF

RUN chmod +x /app/start.sh

# Switch to non-root user
USER electron

# Expose VNC port
EXPOSE 5900

# Default command
CMD ["/app/start.sh"]
