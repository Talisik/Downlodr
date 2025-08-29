/**
 * Safe wrapper for YTDLP to prevent file system errors in production
 */

import { app } from 'electron';
import path from 'path';
import fs from 'fs';

// Global flag to prevent multiple initializations
let isInitialized = false;

// Only initialize YTDLP after we've configured the environment
export function initializeYTDLP() {
  if (isInitialized) {
    console.log('YTDLP already initialized, returning cached instance');
    return require('yt-dlp-helper');
  }
  
  // Configure paths before loading the module
  const binaryName = process.platform === 'win32' ? 'yt-dlp.exe' : 'yt-dlp_macos';
  const userDataPath = app.getPath('userData');
  const ytdlpPath = path.join(userDataPath, binaryName);
  
  // Ensure the binary exists before requiring the module
  if (app.isPackaged && !fs.existsSync(ytdlpPath)) {
    console.error('YTDLP binary not found at:', ytdlpPath);
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
  
  // Set environment variable before requiring the module
  process.env.YTDLP_PATH = ytdlpPath;
  
  // Prevent yt-dlp-helper from trying to access the binary in the wrong location
  // by changing the working directory temporarily
  const originalCwd = process.cwd();
  if (app.isPackaged) {
    try {
      process.chdir(userDataPath);
    } catch (error) {
      console.error('Failed to change directory:', error);
    }
  }
  
  // Now require the module
  let YTDLP;
  try {
    YTDLP = require('yt-dlp-helper');
  } catch (error) {
    console.error('Failed to require yt-dlp-helper:', error);
    // Restore original working directory
    if (app.isPackaged) {
      try {
        process.chdir(originalCwd);
      } catch (e) {}
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
  YTDLP.Config.ytdlpPath = ytdlpPath;
  YTDLP.Config.ytdlpDownloadDestination = userDataPath;
  YTDLP.Config.ffmpegDownloadDestination = userDataPath;
  
  console.log('YTDLP initialized with config:', {
    ytdlpPath,
    downloadDestination: userDataPath,
    isPackaged: app.isPackaged
  });
  
  isInitialized = true;
  return YTDLP;
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
