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
      // PRIORITY: Always prefer bundled FFmpeg over system FFmpeg
      let ffmpegPath = process.env.FFMPEG_PATH;
      let ffmpegSource = 'environment variable';
      
      if (!ffmpegPath) {
        // Check bundled FFmpeg first (should always be present in packaged app)
        const bundledFFmpegPath = path.join(userDataPath, process.platform === 'win32' ? 'ffmpeg.exe' : 'ffmpeg');
        
        if (fs.existsSync(bundledFFmpegPath)) {
          ffmpegPath = bundledFFmpegPath;
          ffmpegSource = 'bundled binary';
          console.log(`✅ Using bundled FFmpeg at: ${bundledFFmpegPath}`);
        } else {
          console.warn(`⚠️  Bundled FFmpeg not found at: ${bundledFFmpegPath}`);
          console.warn(`⚠️  This may indicate a build or installation issue`);
          
          // Fallback to system FFmpeg locations (NOT recommended for packaged app)
          const systemPaths = [
            '/opt/homebrew/bin/ffmpeg', // Homebrew on Apple Silicon
            '/usr/local/bin/ffmpeg',    // Homebrew on Intel Mac
            '/usr/bin/ffmpeg',           // System FFmpeg (Linux/Mac)
            'ffmpeg'                     // PATH fallback
          ];
          
          for (const testPath of systemPaths) {
            if (fs.existsSync(testPath)) {
              ffmpegPath = testPath;
              ffmpegSource = `system FFmpeg (fallback)`;
              console.warn(`⚠️  Using system FFmpeg as fallback: ${testPath}`);
              console.warn(`⚠️  This should NOT happen in packaged app!`);
              break;
            }
          }
          
          if (!ffmpegPath) {
            // Last resort: use a default path (will likely fail)
            ffmpegPath = process.platform === 'darwin' ? '/opt/homebrew/bin/ffmpeg' : 'ffmpeg';
            ffmpegSource = 'fallback (may not exist)';
            console.error(`❌ FFmpeg not found anywhere, using fallback: ${ffmpegPath}`);
            console.error(`❌ Video+audio merging WILL fail without FFmpeg`);
            console.error(`❌ Please reinstall the app or report this as a build issue`);
          }
        }
      } else {
        console.log(`✅ FFmpeg path from environment: ${ffmpegPath}`);
      }
      
      // Only set config if we have a valid path
      if (ffmpegPath && ffmpegPath !== '') {
        const ffmpegExists = fs.existsSync(ffmpegPath);
        
        YTDLP.Config.ffmpegPath = ffmpegPath;
        YTDLP.Config.ffmpegLocation = ffmpegPath; // Some versions use this property
        
        // Also set environment variable for child processes
        process.env.FFMPEG_PATH = ffmpegPath;
        
        // Only add to PATH if the directory exists
        const ffmpegDir = path.dirname(ffmpegPath);
        if (fs.existsSync(ffmpegDir)) {
          process.env.PATH = `${ffmpegDir}:${process.env.PATH}`;
        }
        
        console.log(`📦 FFmpeg configured from: ${ffmpegSource}`);
        console.log(`📍 FFmpeg path: ${ffmpegPath}`);
        console.log(`✅ FFmpeg exists: ${ffmpegExists}`);
        
        if (!ffmpegExists) {
          console.error(`❌ FFmpeg not found at configured path: ${ffmpegPath}`);
          console.error(`❌ Downloads requiring merge (video+audio) will fail!`);
          if (app.isPackaged) {
            console.error(`❌ Build issue: Bundled FFmpeg missing from packaged app`);
            console.error(`❌ Expected at: ${path.join(app.getPath('userData'), 'ffmpeg')}`);
          }
        }
      } else {
        console.error(`❌ FFmpeg path is null or empty - merging will not work!`);
        console.error(`❌ This is a critical configuration error`);
      }
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
