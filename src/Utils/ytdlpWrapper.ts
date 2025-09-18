/**
 * Safe wrapper for YTDLP to prevent file system errors in production
 */

import { app } from 'electron';
import path from 'path';
import fs from 'fs';

// Global flag to prevent multiple initializations
let isInitialized = false;
let initPromise: Promise<any> | null = null;
let cachedModule: any = null;

// Only initialize YTDLP after we've configured the environment
export async function initializeYTDLP() {
  if (isInitialized && cachedModule) {
    return cachedModule;
  }
  if (initPromise) {
    return initPromise;
  }
  
  initPromise = (async () => {
    // Configure paths before loading the module
    const binaryName = process.platform === 'win32' ? 'yt-dlp.exe' : 'yt-dlp_macos';
    const userDataPath = app.getPath('userData');
    const ytdlpPath = path.join(userDataPath, binaryName);
    
    // Ensure the binary exists before importing the module
    if (app.isPackaged && !fs.existsSync(ytdlpPath)) {
      console.warn('YTDLP binary not found at:', ytdlpPath);
      // Try to copy it from resources
      const sourcePath = path.join(process.resourcesPath, binaryName);
      if (fs.existsSync(sourcePath)) {
        try {
          fs.copyFileSync(sourcePath, ytdlpPath);
          if (process.platform !== 'win32') {
            fs.chmodSync(ytdlpPath, 0o755);
          }
          console.log('Emergency copy of YTDLP binary to:', ytdlpPath);
        } catch (error) {
          console.error('Failed to emergency copy YTDLP binary:', error);
        }
      }
    }
    
    // Set environment variable before importing the module
    process.env.YTDLP_PATH = ytdlpPath;
    
    // Temporarily change working directory to avoid EROFS assumptions during import
    const originalCwd = process.cwd();
    if (app.isPackaged) {
      try {
        process.chdir(userDataPath);
      } catch (error) {
        console.error('Failed to change directory:', error);
      }
    }
    
    let YTDLP: any;
    try {
      // Dynamic ESM import
      const mod = await import('yt-dlp-helper');
      YTDLP = mod;
    } catch (error) {
      console.error('Failed to import yt-dlp-helper:', error);
      // Restore original working directory
      if (app.isPackaged) {
        try {
          process.chdir(originalCwd);
        } catch {}
      }
      throw error;
    }
    
    // Restore original working directory after module is loaded
    if (app.isPackaged) {
      try {
        process.chdir(originalCwd);
      } catch (error) {
        console.error('Failed to restore directory:', error);
      }
    }
    
    // Configure YTDLP for production environment
    if (YTDLP?.Config) {
      YTDLP.Config.ytdlpPath = ytdlpPath;
      YTDLP.Config.ytdlpDownloadDestination = userDataPath;
      YTDLP.Config.ffmpegDownloadDestination = userDataPath;
      
      // Configure FFmpeg path for merging
      // Use environment variable if set (from main.ts setup), otherwise fallback
      let ffmpegPath = process.env.FFMPEG_PATH;
      
      if (!ffmpegPath) {
        // Check common locations
        const possiblePaths = [
          path.join(userDataPath, process.platform === 'win32' ? 'ffmpeg.exe' : 'ffmpeg'),
          '/opt/homebrew/bin/ffmpeg',
          '/usr/local/bin/ffmpeg',
          '/usr/bin/ffmpeg',
          'ffmpeg'
        ];
        
        for (const testPath of possiblePaths) {
          if (fs.existsSync(testPath)) {
            ffmpegPath = testPath;
            break;
          }
        }
        
        if (!ffmpegPath) {
          ffmpegPath = process.platform === 'darwin' ? '/opt/homebrew/bin/ffmpeg' : 'ffmpeg';
        }
      }
      
      YTDLP.Config.ffmpegPath = ffmpegPath;
      YTDLP.Config.ffmpegLocation = ffmpegPath; // Some versions use this property
      
      // Also set environment variable for child processes
      process.env.FFMPEG_PATH = ffmpegPath;
      process.env.PATH = `${path.dirname(ffmpegPath)}:${process.env.PATH}`;
      
      console.log('FFmpeg configured at:', ffmpegPath);
      console.log('FFmpeg exists:', fs.existsSync(ffmpegPath));
    }
    
    console.log('YTDLP initialized with config:', {
      ytdlpPath,
      downloadDestination: userDataPath,
      isPackaged: app.isPackaged,
    });
    
    isInitialized = true;
    cachedModule = YTDLP;
    return YTDLP;
  })();
  
  return initPromise;
}

// Helper to ensure binary exists in production
export async function ensureYTDLPBinary() {
  if (!app.isPackaged) {
    return true; // In development, assume it's handled
  }
  
  const binaryName = process.platform === 'win32' ? 'yt-dlp.exe' : 'yt-dlp_macos';
  const userDataPath = app.getPath('userData');
  const targetPath = path.join(userDataPath, binaryName);
  const sourcePath = path.join(process.resourcesPath, binaryName);
  
  try {
    // Create user data directory if it doesn't exist
    if (!fs.existsSync(userDataPath)) {
      fs.mkdirSync(userDataPath, { recursive: true });
    }
    
    // Copy binary if it doesn't exist
    if (!fs.existsSync(targetPath) && fs.existsSync(sourcePath)) {
      fs.copyFileSync(sourcePath, targetPath);
      if (process.platform !== 'win32') {
        fs.chmodSync(targetPath, 0o755);
      }
      console.log('YTDLP binary copied to:', targetPath);
    }
    
    return true;
  } catch (error) {
    console.error('Failed to ensure YTDLP binary:', error);
    return false;
  }
}
