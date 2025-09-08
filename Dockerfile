# Production Dockerfile for Downlodr - Electron + React Video Downloading Application

FROM node:20-alpine as builder

# Install build dependencies
RUN apk add --no-cache python3 make g++ libc6-compat

# Set working directory
WORKDIR /app

# Install yarn
RUN npm install -g yarn

# Copy package files
COPY package.json yarn.lock* ./

# Install dependencies (including dev dependencies for building)
RUN yarn install --frozen-lockfile

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
    libxss \
    libxtst \
    at-spi2-atk \
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
RUN echo '#!/bin/sh\n\
# Start Xvfb\n\
Xvfb :99 -screen 0 1280x720x24 &\n\
export DISPLAY=:99\n\
\n\
# Start VNC server\n\
x11vnc -display :99 -nopw -listen 0.0.0.0 -xkb -ncache 10 -ncache_cr -forever -bg\n\
\n\
# Start window manager\n\
fluxbox -display :99 &\n\
\n\
# Wait for X server to start\n\
sleep 3\n\
\n\
# Start the Electron application using electron-forge\n\
yarn start\n\
' > /app/start.sh && chmod +x /app/start.sh

# Switch to non-root user
USER electron

# Expose VNC port
EXPOSE 5900

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=60s --retries=3 \
    CMD pgrep -f electron || exit 1

# Default command
CMD ["/app/start.sh"]
