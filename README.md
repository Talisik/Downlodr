# Downlodr

## Overview

Downlodr is a powerful, user-friendly video downloading solution that supports multiple platforms, including YouTube, Vimeo, Twitch, Twitter, TikTok, and others more. Downlodr provides a seamless experience for managing your video downloads, tracking download progress, and organizing content with tags and categories.

Built with Electron Forge and Vite, Downlodr offers a modern desktop experience with robust functionality and an intuitive interface.

Available for **Windows** and **macOS** with comprehensive build and distribution systems.

To download current version and learn more about Downlodr, visit site: <a href="https://downlodr.com/">Downlodr Official Site</a>

## Features

- **Download Management**: Track the status of downloads, including currently downloading, finished, and historical download logs
- **Tag and Category Management**: Organize downloads with tags and categories for easy retrieval
- **User-Friendly Interface**: Intuitive UI for managing downloads and settings
- **Playlist Support**: Download entire channels or playlists with one click
- **Quality Selection**: Choose your preferred video quality and format
- **Settings Configuration**: Customize default download location, speed, and connection limits

## Technologies Used

- **ElectronJS**: Framework for building cross-platform desktop applications.
- **Electron Forge**: Packaging and distribution tool for Electron applications.
- **YTDLP**: Command-line tool for audio and video downloads from various platforms.
- **FFMPEG**: Multimedia framework that provides users with the ability to process and manipulate audio and video files.
- **React**: JavaScript library for building user interfaces.
- **Vite**: Local development server.
- **Zustand**: Small, fast state-management solution.
- **TypeScript**: Typed superset of JavaScript.
- **TailwindCSS**: Utility-first CSS framework for rapid UI development.

## Getting Started

### Prerequisites

- Node.js (version ^20.17.0)
- yarn (version ^v1.22.19)

### Installation

1. Clone the repository:
   ```
   git clone https://github.com/your-username/downlodr.git
   ```

2. Navigate to the project directory:
   ```
   cd downlodr
   ```

3. Install the dependencies:
   ```
   yarn
   ```

4. Install the yt-dlp package:
   ```
   yarn add github:Talisik/yt-dlp-helper
   ```

### Running the Application

To start the application in development mode:
   ```
yarn start
   ```

### Building and Packaging

#### For macOS (Enhanced Build System)
```bash
# Full production build with code signing and notarization
yarn build:dmg

# Test DMG creation without notarization
yarn test:dmg
```

#### For Other Platforms
```bash
# Standard Electron Forge packaging
yarn make
```

This will create distributable packages for your platform in the `out` directory.

📚 **Documentation**: See [`BUILD_SYSTEM_README.md`](BUILD_SYSTEM_README.md) for comprehensive build documentation.

## Usage Guide

1. **Adding Downloads**:
   - Click the "Add URL" button or use the File menu
   - Paste a valid video URL and select the download destination
   - Click "Download" to add it to your queue

2. **Managing Downloads**:
   - Use the play (▶️), pause (⏸️), and stop (⏹️) buttons to control downloads
   - Right-click on downloads for additional options
   - View detailed information by clicking on a download

3. **Customizing Settings**:
   - Set your default download location
   - Configure download speed limits
   - Adjust maximum concurrent downloads

## Documentation

### Build and Distribution
| Document | Purpose |
|----------|---------|
| [`BUILD_SYSTEM_README.md`](BUILD_SYSTEM_README.md) | Overview of enhanced build system |
| [`docs/MACOS_BUILD_DISTRIBUTION.md`](docs/MACOS_BUILD_DISTRIBUTION.md) | Complete macOS build documentation |
| [`docs/TROUBLESHOOTING_MACOS.md`](docs/TROUBLESHOOTING_MACOS.md) | Troubleshooting build and distribution issues |
| [`docs/USER_INSTALLATION_GUIDE.md`](docs/USER_INSTALLATION_GUIDE.md) | User-friendly installation guide |

### Development
| Document | Purpose |
|----------|---------|
| [`docs/architecture.md`](docs/architecture.md) | Application architecture overview |
| [`docs/PLUGIN_DEVELOPMENT.MD`](docs/PLUGIN_DEVELOPMENT.MD) | Plugin development guide |
| [`docs/technical.md`](docs/technical.md) | Technical implementation details |

### Additional Resources
| Document | Purpose |
|----------|---------|
| [`CONTRIBUTING.md`](CONTRIBUTING.md) | Contributing guidelines |
| [`CODE_OF_CONDUCT.md`](CODE_OF_CONDUCT.md) | Community standards |
| [`CHANGELOG.md`](CHANGELOG.md) | Version history and changes |

## Contributing

We welcome contributions from the community! Please see our [CONTRIBUTING.md](CONTRIBUTING.md) file for guidelines on how to get involved.

## Code of Conduct

This project adheres to a [Code of Conduct](CODE_OF_CONDUCT.md) to ensure a welcoming and inclusive environment for all contributors and users.

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Acknowledgments

- The yt-dlp project and FFMPEG project for providing the core downloading functionality
- All contributors who have helped make Downlodr better.
