# Downlodr

## Overview

Downlodr is a powerful, user-friendly video downloading solution that supports multiple platforms, including YouTube, Vimeo, Twitch, Twitter, TikTok, and others more. Downlodr provides a seamless experience for managing your video downloads, tracking download progress, and organizing content with tags and categories.

Built with Electron Forge and Vite, Downlodr offers a modern desktop experience with robust functionality and an intuitive interface.

## Platform Support

- **Windows**: Available as installer (NSIS) and portable ZIP
- **Linux**: Automated builds for Ubuntu 20.04, 22.04, 24.04 (DEB, RPM, ZIP formats)
- **macOS**: Coming soon

Linux packages are automatically built via GitHub Actions and published to the [Releases page](../../releases).

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

- Node.js (version ^20.19.0 || >=22.12.0)
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

#### Local Build

To build and package the application for your current platform:
   ```
yarn make
   ```

This will create distributable packages in the `out` directory.

#### Linux Build

To build Linux packages (DEB, RPM, ZIP):
   ```
yarn build:linux
   ```

See [INSTALL_LINUX.md](INSTALL_LINUX.md) for Linux installation instructions.

#### Automated Builds

Linux packages are automatically built and released via GitHub Actions:
- Pushes to version tags trigger automated builds
- Pull requests run test builds
- Releases are published to GitHub Releases page

See [.github/RELEASE_GUIDE.md](.github/RELEASE_GUIDE.md) for release process documentation.

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

## Contributing

We welcome contributions from the community! Please see our [CONTRIBUTING.md](CONTRIBUTING.md) file for guidelines on how to get involved.

## Code of Conduct

This project adheres to a [Code of Conduct](CODE_OF_CONDUCT.md) to ensure a welcoming and inclusive environment for all contributors and users.

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Acknowledgments

- The yt-dlp project and FFMPEG project for providing the core downloading functionality
- All contributors who have helped make Downlodr better.
