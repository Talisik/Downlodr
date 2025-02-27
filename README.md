# Downlodr

## Overview

Downlodr is a powerful, user-friendly video downloading solution that supports multiple platforms, including YouTube, Vimeo, and many more. Downlodr provides a seamless experience for managing your video downloads, track their download progress, and manage tags and categories associated with each download.

Downlodr was primarily developed using ElectronJS with React as its frontend and Zustand for state management.

Current Application has only been packaged for Windows

## Features

- **Download Management**: Track the status of downloads, including currently downloading, finished, and historical download logs.
- **Tag and Category Management**: Organize downloads with tags and categories for easy retrieval.
- **User-Friendly Interface**: Intuitive UI for managing downloads and settings.
- **Playlist Support**: Download multiple videos from a playlist with ease.
- **Settings Configuration**: Customize default download location, speed, and connection limits.

## Technologies Used

- **ElectronJS**: framework for building desktop applications. Embeds Chromium and Node.js into its binary.
- **YTDLP**: a command-line tool used on Windows, macOS, and Linux operating systems for audio and video downloads.
- **React**: A JavaScript library for building user interfaces.
- **Zustand**: A small, fast state-management solution for managing application state.
- **TypeScript**: A typed superset of JavaScript that compiles to plain JavaScript.
- **Markdown**: For documentation and README files.

## Getting Started

### Prerequisites

- Node.js (version ^20.17.0)
- yarn (version ^v1.22.19)

### Installation

1. Clone the repository:
   ```
   git clone https://github.com/
   ```

2. Navigate to the project directory:
   ```
   cd your-repo-name
   ```

3. Install the dependencies:
   ```
      yarn
   ```

4. Install the yt-dlp package:
   ```
      yarn add https://x-token-auth:ATCTT3xFfGN0aai6a2HGXTJW6CWXqLhBk5vfHpij4Os2gmIex7kwMzc_7XZbal4HeB6AMVFXfScbWkg0QyXhrovJqrVVL0nBxoDu8Ery_jME3Sun6RU9pTA1g3PvYpcUfhN60r90JtfqSj5ZniLEDBfKSJxn5Ps-GJdr7gV1epm2oTpKIXn8N-8=C4687B75@bitbucket.org/metawhale/yt-dlp-helper.git
   ```

### Running the Application

To start the application in development mode, run:
   ```yarn start
   ```

### Build and Package the Application

To build and package the application, run:
   ```yarn make
   ```