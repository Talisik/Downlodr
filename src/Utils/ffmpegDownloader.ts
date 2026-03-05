/**
 * FFmpeg downloader utility for production builds
 * Downloads FFmpeg binary if not available in the system
 */

import { app } from 'electron';
import path from 'path';
import fs from 'fs';
import https from 'https';
import { spawn } from 'child_process';

/**
 * Check if FFmpeg is available in the system
 */
export async function checkSystemFFmpeg(): Promise<string | null> {
  const possiblePaths = [
    '/opt/homebrew/bin/ffmpeg', // macOS with Homebrew
    '/usr/local/bin/ffmpeg', // macOS/Linux standard
    '/usr/bin/ffmpeg', // Linux standard
    'ffmpeg', // Windows (in PATH)
  ];

  for (const ffmpegPath of possiblePaths) {
    try {
      const result = await new Promise<boolean>((resolve) => {
        const ffmpeg = spawn(ffmpegPath, ['-version']);
        ffmpeg.on('error', () => resolve(false));
        ffmpeg.on('close', (code) => resolve(code === 0));
      });

      if (result) {
        console.log(`Found system FFmpeg at: ${ffmpegPath}`);
        return ffmpegPath;
      }
    } catch {
      // Continue checking other paths
    }
  }

  return null;
}

/**
 * Get FFmpeg download URL based on platform
 */
function getFFmpegDownloadUrl(): string | null {
  const platform = process.platform;
  const arch = process.arch;

  // Using static FFmpeg builds from https://github.com/BtbN/FFmpeg-Builds
  if (platform === 'darwin') {
    // macOS builds
    if (arch === 'arm64') {
      return 'https://github.com/BtbN/FFmpeg-Builds/releases/download/latest/ffmpeg-master-latest-macos-arm64.tar.xz';
    } else {
      return 'https://github.com/BtbN/FFmpeg-Builds/releases/download/latest/ffmpeg-master-latest-macos-x64.tar.xz';
    }
  } else if (platform === 'win32') {
    // Windows builds
    if (arch === 'x64') {
      return 'https://github.com/BtbN/FFmpeg-Builds/releases/download/latest/ffmpeg-master-latest-win64-gpl.zip';
    }
  } else if (platform === 'linux') {
    // Linux builds
    if (arch === 'x64') {
      return 'https://github.com/BtbN/FFmpeg-Builds/releases/download/latest/ffmpeg-master-latest-linux64-gpl.tar.xz';
    }
  }

  return null;
}

/**
 * Download FFmpeg binary
 */
export async function downloadFFmpeg(targetPath: string): Promise<boolean> {
  const url = getFFmpegDownloadUrl();

  if (!url) {
    console.error('No FFmpeg download URL available for this platform');
    return false;
  }

  console.log(`Downloading FFmpeg from: ${url}`);
  console.log(`Target path: ${targetPath}`);

  // Note: This is a simplified version
  // In production, you would need to:
  // 1. Download the archive
  // 2. Extract it
  // 3. Copy the ffmpeg binary to targetPath
  // 4. Set executable permissions

  // For now, we'll just log and return false
  // The app will fall back to requiring system FFmpeg
  console.warn(
    'Automatic FFmpeg download not implemented. Please install FFmpeg manually.',
  );
  return false;
}

/**
 * Ensure FFmpeg is available for the app
 */
export async function ensureFFmpeg(): Promise<string | null> {
  const userDataPath = app.getPath('userData');
  const ffmpegName = process.platform === 'win32' ? 'ffmpeg.exe' : 'ffmpeg';
  const localFFmpegPath = path.join(userDataPath, ffmpegName);

  // Check if we have a local copy
  if (fs.existsSync(localFFmpegPath)) {
    console.log(`Found local FFmpeg at: ${localFFmpegPath}`);
    return localFFmpegPath;
  }

  // Check system FFmpeg
  const systemFFmpeg = await checkSystemFFmpeg();
  if (systemFFmpeg) {
    return systemFFmpeg;
  }

  // Try to download FFmpeg
  console.log('FFmpeg not found, attempting to download...');
  const downloaded = await downloadFFmpeg(localFFmpegPath);

  if (downloaded && fs.existsSync(localFFmpegPath)) {
    return localFFmpegPath;
  }

  console.error('FFmpeg is not available. Please install it manually.');
  return null;
}

/**
 * Copy system FFmpeg to app directory if available
 */
export async function copySystemFFmpegToApp(): Promise<boolean> {
  const systemFFmpeg = await checkSystemFFmpeg();
  if (!systemFFmpeg || systemFFmpeg === 'ffmpeg') {
    return false;
  }

  const userDataPath = app.getPath('userData');
  const ffmpegName = process.platform === 'win32' ? 'ffmpeg.exe' : 'ffmpeg';
  const targetPath = path.join(userDataPath, ffmpegName);

  try {
    // Copy the binary
    fs.copyFileSync(systemFFmpeg, targetPath);

    // Make it executable
    if (process.platform !== 'win32') {
      fs.chmodSync(targetPath, 0o755);
    }

    console.log(`Copied system FFmpeg to: ${targetPath}`);
    return true;
  } catch (error) {
    console.error('Failed to copy system FFmpeg:', error);
    return false;
  }
}
