# Downlodr - Linux Installation Guide

## About Downlodr

Downlodr is a powerful desktop application for downloading videos from 1,800+ platforms. It comes with built-in yt-dlp and FFmpeg, so no additional software installation is required!

## System Requirements

- **Operating System:** Linux (64-bit)
  - Debian/Ubuntu (DEB package)
  - Fedora/RHEL/CentOS (RPM package)
  - Any Linux distribution (ZIP archive)
- **Architecture:** x86_64 (64-bit)
- **RAM:** 2GB minimum, 4GB recommended
- **Disk Space:** 500MB for installation + space for downloads

## Installation Methods

### Option 1: DEB Package (Debian/Ubuntu/Mint)

**For Debian, Ubuntu, Linux Mint, Pop!_OS, elementary OS, etc.**

```bash
# Download the .deb file from releases
# Then install:
sudo dpkg -i downlodr_*.deb

# If you get dependency errors, run:
sudo apt-get install -f
```

**Launch the app:**
```bash
downlodr
# or find it in your Applications menu
```

**Uninstall:**
```bash
sudo apt-get remove downlodr
```

---

### Option 2: RPM Package (Fedora/RHEL/CentOS)

**For Fedora, RHEL, CentOS, openSUSE, etc.**

```bash
# Download the .rpm file from releases
# Then install:
sudo rpm -i downlodr-*.rpm

# Or using dnf (Fedora):
sudo dnf install downlodr-*.rpm

# Or using yum (RHEL/CentOS):
sudo yum install downlodr-*.rpm
```

**Launch the app:**
```bash
downlodr
# or find it in your Applications menu
```

**Uninstall:**
```bash
# Fedora:
sudo dnf remove downlodr

# RHEL/CentOS:
sudo yum remove downlodr
```

---

### Option 3: ZIP Archive (Universal)

**For any Linux distribution**

```bash
# Download and extract the .zip file
unzip downlodr-linux-x64-*.zip

# Navigate to the extracted folder
cd downlodr-linux-x64

# Run the application
./downlodr
```

**To create a desktop shortcut:**
```bash
# Create .desktop file
cat > ~/.local/share/applications/downlodr.desktop << 'DESKTOP'
[Desktop Entry]
Version=1.0
Type=Application
Name=Downlodr
Comment=Download videos from 1800+ platforms
Exec=/full/path/to/downlodr-linux-x64/downlodr
Icon=/full/path/to/downlodr-linux-x64/resources/app/.vite/build/icon.png
Terminal=false
Categories=AudioVideo;Video;Network;
MimeType=x-scheme-handler/https;x-scheme-handler/http;
DESKTOP

# Update desktop database
update-desktop-database ~/.local/share/applications/
```

**Uninstall:**
```bash
rm -rf downlodr-linux-x64/
rm ~/.local/share/applications/downlodr.desktop
```

---

## First Run

1. **Launch Downlodr** from your applications menu or terminal
2. **Paste a video URL** (YouTube, Vimeo, etc.)
3. **Select quality/format** from the dropdown
4. **Click Download** - that's it!

## Features

✅ **Built-in yt-dlp** - No separate installation needed
✅ **Built-in FFmpeg** - Automatic video/audio merging
✅ **1,800+ Platforms** - YouTube, Vimeo, Twitch, and more
✅ **Multiple Formats** - MP4, MKV, WebM, MP3, M4A, etc.
✅ **Quality Selection** - Choose from 144p to 8K
✅ **Playlist Support** - Download entire playlists/channels
✅ **Subtitles** - Auto-download available subtitles
✅ **Thumbnails** - Save video thumbnails
✅ **Speed Limiting** - Control download speed
✅ **Queue Management** - Manage multiple downloads
✅ **Plugin System** - Extend functionality

## Default Download Location

Downloads are saved to: `~/Downloads/`

You can change this in Settings.

## Troubleshooting

### App won't start

**Check if you have the required dependencies:**
```bash
# For DEB-based systems:
sudo apt-get install libgtk-3-0 libnotify4 libnss3 libxss1 libxtst6 xdg-utils libatspi2.0-0 libuuid1 libsecret-1-0

# For RPM-based systems:
sudo dnf install gtk3 libnotify nss libXScrnSaver libXtst xdg-utils at-spi2-core libuuid libsecret
```

### Downloads failing

1. **Check internet connection**
2. **Try a different video URL**
3. **Check if the platform is supported** (use --list-extractors in terminal)
4. **Clear app cache:** Delete `~/.config/Downlodr/`

### Video and audio not merging

This should be fixed in the latest version! If you still experience this:
1. Make sure you're running the latest version
2. Check console output for `[Merger]` messages
3. Report the issue on GitHub with console logs

### Permission denied errors

```bash
# Make the binary executable (if using ZIP):
chmod +x downlodr

# For DEB/RPM, this shouldn't be necessary
```

## Getting Help

- **Documentation:** https://github.com/Talisik/Downlodr/docs
- **Issues:** https://github.com/Talisik/Downlodr/issues
- **Discussions:** https://github.com/Talisik/Downlodr/discussions

## Updating

### DEB/RPM Packages

Download the new version and install it. It will automatically replace the old version:

```bash
# DEB:
sudo dpkg -i downlodr_NEW_VERSION.deb

# RPM:
sudo rpm -U downlodr-NEW_VERSION.rpm
```

### ZIP Archive

1. Download the new ZIP file
2. Extract to a new location
3. Delete the old folder
4. Update your desktop shortcut if needed

## Data Locations

- **Download History:** `~/.config/Downlodr/`
- **Logs:** `~/.config/Downlodr/logs/`
- **Plugins:** `~/.config/Downlodr/plugins/`
- **Settings:** `~/.config/Downlodr/settings.json`

## Uninstalling

See the uninstall instructions under each installation method above.

To also remove user data:
```bash
rm -rf ~/.config/Downlodr/
```

## Building from Source

See [CONTRIBUTING.md](CONTRIBUTING.md) for build instructions.

## License

Downlodr is open source software licensed under the MIT License.
See [LICENSE](LICENSE) for details.

---

**Enjoy Downlodr!** 🎉

If you encounter any issues, please report them on GitHub.
