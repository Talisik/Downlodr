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
   cd MediaLibrary
   ```

3. Install the dependencies:
   ```
   yarn
   ```

4. Add YTDLP Package manually:
   - ask dev for copy  of ytdlp helper package
   - replace installed ytdlp helper package via 

5. Add Nemesis Package
   - ask dev for copy  of nemesis package
   - install other packages
       - better-sqlite3
       - other one

6. You're good to go!

### Running the Application

To start the application in development mode:
   ```
yarn start
   ```

### Building and Packaging

To build and package the application:
   ```
yarn make
   ```

### Building for macOS

In addition to `yarn make`, macOS-specific production build scripts are
available (see `forge.config.ts` for the underlying packaging/signing logic):
   ```
yarn build:dmg     # arm64 signed DMG via scripts/build-with-create-dmg.sh
yarn build:intel   # Intel signed DMG via scripts/build-with-create-dmg-intel.sh
yarn build:quick   # unsigned package, no DMG — scripts/build-and-package.sh
   ```
Signing requires `APPLE_IDENTITY` (and, for the installer, `APPLE_INSTALLER_IDENTITY`)
set in the environment or a local `.env` file — see `.github/workflows/macos-build.yml`
for the full set of secrets a CI signing run needs.

## Contributing

We welcome contributions from the community! Please see our [CONTRIBUTING.md](CONTRIBUTING.md) file for guidelines on how to get involved.

## Code of Conduct

This project adheres to a [Code of Conduct](CODE_OF_CONDUCT.md) to ensure a welcoming and inclusive environment for all contributors and users.

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Acknowledgments

- The yt-dlp project, FFMPEG project, and WhisperX project for providing the core downloading functionality
- All contributors who have helped make Downlodr better.
