# 🐧 Downlodr Linux Build Guide

This guide provides comprehensive instructions for building Downlodr for Linux distribution with bundled `yt-dlp` and `ffmpeg` binaries.

## 📋 Overview

The Linux build process creates self-contained packages that include:
- ✅ Downlodr application
- ✅ yt-dlp binary (latest version)
- ✅ ffmpeg and ffprobe binaries (static builds)
- ✅ All necessary dependencies

Users can install and run Downlodr without needing to install `yt-dlp` or `ffmpeg` separately.

## 🏗️ Supported Package Formats

| Format | Description | Target Distributions |
|--------|-------------|---------------------|
| **DEB** | Debian package | Ubuntu, Debian, Linux Mint, elementary OS |
| **RPM** | Red Hat package | Fedora, CentOS, RHEL, openSUSE |
| **ZIP** | Universal archive | Any Linux distribution |

## 🔧 Prerequisites

### System Requirements
- Linux distribution (x64)
- Node.js 16.x or later
- Yarn package manager
- Internet connection (for downloading binaries)

### Required Tools
```bash
# Ubuntu/Debian
sudo apt-get install curl tar xz-utils build-essential rpm nodejs npm

# Fedora/CentOS/RHEL
sudo dnf install curl tar xz gcc-c++ make rpm-build nodejs npm

# Arch/Manjaro
sudo pacman -S curl tar xz base-devel nodejs npm yarn

# Install Yarn globally (if not installed)
npm install -g yarn
```

## 🚀 Quick Start

### Option 1: Automated Setup
```bash
# Run the setup script to install all dependencies
./scripts/setup-linux-build.sh

# Build Linux packages
yarn build:linux
```

### Option 2: Manual Build
```bash
# Install project dependencies
yarn install

# Build all Linux packages (DEB, RPM, ZIP)
yarn build:linux

# Or build specific formats
yarn make:linux:deb  # Debian package only
yarn make:linux:rpm  # RPM package only
yarn make:linux:zip  # ZIP archive only
```

## 📦 Build Process Details

### What the Build Script Does

1. **Environment Check**: Verifies all required tools are installed
2. **Binary Download**: Downloads latest yt-dlp and ffmpeg binaries
3. **Dependency Installation**: Installs Node.js dependencies
4. **Application Build**: Compiles and packages the Electron app
5. **Binary Bundling**: Includes downloaded binaries in the package
6. **Package Creation**: Generates DEB, RPM, and ZIP distributions

### Binary Sources

- **yt-dlp**: Downloaded from [official releases](https://github.com/yt-dlp/yt-dlp/releases)
- **ffmpeg**: Downloaded from [yt-dlp/FFmpeg-Builds](https://github.com/yt-dlp/FFmpeg-Builds/releases)

### Directory Structure
```
project-root/
├── scripts/
│   ├── build-linux.sh          # Main build script
│   ├── setup-linux-build.sh    # Environment setup
│   └── README-linux-build.md   # This file
├── binaries/
│   └── linux/
│       ├── yt-dlp              # Linux yt-dlp binary
│       ├── ffmpeg              # Linux ffmpeg binary
│       └── ffprobe             # Linux ffprobe binary
└── out/
    └── make/
        ├── deb/                # Generated DEB packages
        ├── rpm/                # Generated RPM packages
        └── zip/                # Generated ZIP archives
```

## 🎛️ Build Script Options

```bash
./scripts/build-linux.sh [OPTIONS]

OPTIONS:
    --help, -h          Show help message
    --force, -f         Force redownload of binaries
    --skip-deps         Skip dependency installation
    --skip-binaries     Skip binary downloads
    --verbose, -v       Enable verbose output
```

### Examples

```bash
# Full build with binary downloads
./scripts/build-linux.sh

# Force redownload binaries and build
./scripts/build-linux.sh --force

# Build with existing binaries (faster)
./scripts/build-linux.sh --skip-binaries

# Skip dependency installation (CI/CD environments)
./scripts/build-linux.sh --skip-deps

# Verbose build for debugging
./scripts/build-linux.sh --verbose
```

## 📥 Installation Instructions

### DEB Package (Ubuntu/Debian)
```bash
# Install
sudo dpkg -i out/make/deb/x64/downlodr_1.7.7-stable_amd64.deb

# Fix dependencies if needed
sudo apt-get install -f

# Run
downlodr
```

### RPM Package (Fedora/CentOS/RHEL)
```bash
# Install
sudo rpm -i out/make/rpm/x64/downlodr-1.7.7-1.x86_64.rpm

# Or using dnf/yum
sudo dnf install out/make/rpm/x64/downlodr-1.7.7-1.x86_64.rpm

# Run
downlodr
```

### ZIP Archive (Universal)
```bash
# Extract
unzip out/make/zip/linux/x64/downlodr-linux-x64-1.7.7-stable.zip

# Run
cd downlodr-linux-x64-1.7.7-stable
./downlodr
```

## 🔧 Troubleshooting

### Common Issues

#### Missing Dependencies
**Problem**: Build fails with missing packages
**Solution**: Run the setup script or install manually:
```bash
./scripts/setup-linux-build.sh
```

#### Binary Download Failures
**Problem**: Network issues downloading binaries
**Solution**: Check internet connection and retry with force flag:
```bash
./scripts/build-linux.sh --force
```

#### Permission Issues
**Problem**: Cannot execute binaries after build
**Solution**: The build script automatically sets executable permissions. If issues persist:
```bash
chmod +x binaries/linux/*
```

#### RPM Build Fails
**Problem**: `rpmbuild` command not found
**Solution**: Install RPM build tools:
```bash
# Ubuntu/Debian
sudo apt-get install rpm

# Fedora/CentOS/RHEL
sudo dnf install rpm-build
```

### Debug Mode
Enable verbose output for troubleshooting:
```bash
./scripts/build-linux.sh --verbose
```

### Manual Binary Verification
```bash
# Verify yt-dlp
./binaries/linux/yt-dlp --version

# Verify ffmpeg
./binaries/linux/ffmpeg -version

# Verify ffprobe
./binaries/linux/ffprobe -version
```

## 🔄 CI/CD Integration

### GitHub Actions Example
```yaml
name: Build Linux Packages

on:
  push:
    branches: [ main ]
  pull_request:
    branches: [ main ]

jobs:
  build-linux:
    runs-on: ubuntu-latest
    
    steps:
    - uses: actions/checkout@v3
    
    - name: Setup Node.js
      uses: actions/setup-node@v3
      with:
        node-version: '18'
        cache: 'yarn'
    
    - name: Install system dependencies
      run: |
        sudo apt-get update
        sudo apt-get install -y rpm
    
    - name: Install dependencies
      run: yarn install --frozen-lockfile
    
    - name: Build Linux packages
      run: ./scripts/build-linux.sh --skip-deps
    
    - name: Upload artifacts
      uses: actions/upload-artifact@v3
      with:
        name: linux-packages
        path: out/make/
```

### Docker Build Example
```dockerfile
FROM node:18-bullseye

# Install system dependencies
RUN apt-get update && apt-get install -y \
    curl tar xz-utils build-essential rpm \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY . .

# Install dependencies and build
RUN yarn install --frozen-lockfile
RUN ./scripts/build-linux.sh --skip-deps

# Extract build artifacts
RUN mkdir -p /dist && cp -r out/make/* /dist/
```

## 📊 Build Performance

### Typical Build Times
- **Full build** (with binary downloads): 5-10 minutes
- **Incremental build** (cached binaries): 2-5 minutes
- **CI/CD build** (with caching): 3-7 minutes

### Optimizations
- Use `--skip-binaries` for faster rebuilds
- Cache `binaries/` directory in CI/CD
- Use `--skip-deps` in containerized environments

## 🛡️ Security Considerations

### Binary Verification
- Binaries are downloaded from official sources
- SHA checksums can be verified (implement if needed)
- Static analysis can be performed on downloaded binaries

### Package Security
- DEB/RPM packages include metadata about bundled binaries
- All binaries are marked as executable with proper permissions
- No setuid/setgid permissions are set

## 📝 Contributing

### Adding New Package Formats
1. Add new maker to `forge.config.ts`
2. Update build script to handle new format
3. Add installation instructions to this README
4. Test on target distribution

### Updating Binary Sources
1. Update URLs in `build-linux.sh`
2. Test compatibility with application
3. Update version detection logic if needed

## 📄 License

This build system follows the same license as the main Downlodr project (MIT).

## 🆘 Support

For build-related issues:
1. Check this README for troubleshooting steps
2. Run with `--verbose` flag for detailed output
3. Open an issue with build logs and system information

---

**Happy building! 🚀**
