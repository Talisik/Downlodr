# Downlodr

## Overview

Downlodr is a powerful, user-friendly video downloading solution that supports multiple platforms, including YouTube, Vimeo, Twitch, Twitter, TikTok, and others more. Downlodr provides a seamless experience for managing your video downloads, tracking download progress, and organizing content with tags and categories.

Built with Electron Forge and Vite, Downlodr offers a modern desktop experience with robust functionality and an intuitive interface.

Current application has only been packaged for Windows.

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
   yarn add -
   ```

### Running the Application

To start the application in development mode:

yarn start


### Building and Packaging

To build and package the application:

yarn make


This will create distributable packages for your platform in the `out` directory.

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

- The yt-dlp project for providing the core downloading functionality
- All contributors who have helped make Downlodr better.
