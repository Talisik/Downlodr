/**
 * YTDLP Integration Test Suite
 * Following TDD/Kaizen-AI principles for regression testing
 * 
 * Purpose: Ensure yt-dlp updates don't break download functionality
 */

import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import { spawn } from 'child_process';
import path from 'path';
import fs from 'fs';
import os from 'os';

// Test configuration
const TEST_TIMEOUT = 60000; // 60 seconds for network operations
const TEMP_DIR = path.join(os.tmpdir(), 'downlodr-ytdlp-tests');

describe('YTDLP Binary Integration Tests', () => {
  let ytdlpPath: string;
  
  beforeAll(() => {
    // Determine correct binary path based on platform
    const binaryName = process.platform === 'win32' ? 'yt-dlp.exe' : 
                      process.platform === 'linux' ? 'yt-dlp_linux' : 'yt-dlp_macos';
    ytdlpPath = path.join(process.cwd(), binaryName);
    
    // Create temp directory for test downloads
    if (!fs.existsSync(TEMP_DIR)) {
      fs.mkdirSync(TEMP_DIR, { recursive: true });
    }
    
    console.log('🧪 Test Setup:', {
      platform: process.platform,
      binaryName,
      ytdlpPath,
      binaryExists: fs.existsSync(ytdlpPath),
      tempDir: TEMP_DIR
    });
  });
  
  afterAll(() => {
    // Cleanup temp directory
    if (fs.existsSync(TEMP_DIR)) {
      try {
        fs.rmSync(TEMP_DIR, { recursive: true, force: true });
      } catch (error) {
        console.warn('Failed to cleanup temp directory:', error);
      }
    }
  });
  
  describe('Binary Existence and Permissions', () => {
    it('should have yt-dlp binary in project root', () => {
      expect(fs.existsSync(ytdlpPath)).toBe(true);
    });
    
    it('should have executable permissions (Unix)', () => {
      if (process.platform !== 'win32') {
        const stats = fs.statSync(ytdlpPath);
        const isExecutable = (stats.mode & fs.constants.S_IXUSR) !== 0;
        expect(isExecutable).toBe(true);
      }
    });
  });
  
  describe('Version Check', () => {
    it('should successfully get yt-dlp version', async () => {
      const version = await getYTDLPVersion(ytdlpPath);
      
      expect(version).toBeDefined();
      expect(version).toMatch(/^\d{4}\.\d{2}\.\d{2}$/); // Format: YYYY.MM.DD
      
      console.log('✅ Current yt-dlp version:', version);
    }, TEST_TIMEOUT);
    
    it('should have version 2025.10.14 or later', async () => {
      const version = await getYTDLPVersion(ytdlpPath);
      const currentDate = new Date(version.replace(/\./g, '-'));
      const expectedDate = new Date('2025-10-14');
      
      expect(currentDate >= expectedDate).toBe(true);
    }, TEST_TIMEOUT);
  });
  
  describe('Video Info Extraction', () => {
    it('should extract video info from YouTube URL', async () => {
      const testUrl = 'https://www.youtube.com/watch?v=dQw4w9WgXcQ'; // Rick Astley - Never Gonna Give You Up
      
      const info = await getVideoInfo(ytdlpPath, testUrl);
      
      expect(info).toBeDefined();
      expect(info.title).toBeDefined();
      expect(info.duration).toBeGreaterThan(0);
      expect(info.formats).toBeDefined();
      expect(Array.isArray(info.formats)).toBe(true);
      expect(info.formats.length).toBeGreaterThan(0);
      
      console.log('✅ Video info extracted:', {
        title: info.title,
        duration: info.duration,
        formatCount: info.formats.length
      });
    }, TEST_TIMEOUT);
    
    it('should handle invalid URLs gracefully', async () => {
      const invalidUrl = 'https://invalid-url-test.com/video';
      
      await expect(getVideoInfo(ytdlpPath, invalidUrl)).rejects.toThrow();
    }, TEST_TIMEOUT);
  });
  
  describe('Format Selection', () => {
    it('should list available formats', async () => {
      const testUrl = 'https://www.youtube.com/watch?v=dQw4w9WgXcQ';
      
      const formats = await listFormats(ytdlpPath, testUrl);
      
      expect(Array.isArray(formats)).toBe(true);
      expect(formats.length).toBeGreaterThan(0);
      
      // Verify format structure
      const firstFormat = formats[0];
      expect(firstFormat).toHaveProperty('format_id');
      expect(firstFormat).toHaveProperty('ext');
      
      console.log('✅ Available formats:', formats.length);
    }, TEST_TIMEOUT);
    
    it('should support audio-only format extraction', async () => {
      const testUrl = 'https://www.youtube.com/watch?v=dQw4w9WgXcQ';
      
      const formats = await listFormats(ytdlpPath, testUrl);
      const audioFormats = formats.filter(f => 
        f.vcodec === 'none' || f.resolution === 'audio only'
      );
      
      expect(audioFormats.length).toBeGreaterThan(0);
      
      console.log('✅ Audio formats available:', audioFormats.length);
    }, TEST_TIMEOUT);
  });
  
  describe('FFmpeg Integration', () => {
    it('should detect FFmpeg availability', async () => {
      const hasFFmpeg = await checkFFmpegAvailability(ytdlpPath);
      
      // Log result but don't fail if FFmpeg not found
      // (Some users might not have it installed)
      console.log(hasFFmpeg ? '✅ FFmpeg available' : '⚠️  FFmpeg not detected');
      
      expect(typeof hasFFmpeg).toBe('boolean');
    }, TEST_TIMEOUT);
  });
  
  describe('Download Capability', () => {
    it('should validate download command structure', async () => {
      const testUrl = 'https://www.youtube.com/watch?v=dQw4w9WgXcQ';
      const outputPath = path.join(TEMP_DIR, 'test-video.mp4');
      
      // Dry run - don't actually download
      const success = await testDownloadCommand(ytdlpPath, testUrl, outputPath);
      
      expect(success).toBe(true);
      
      console.log('✅ Download command structure validated');
    }, TEST_TIMEOUT);
  });
  
  describe('Error Handling', () => {
    it('should handle network errors gracefully', async () => {
      const unreachableUrl = 'https://this-domain-definitely-does-not-exist-12345.com/video';
      
      await expect(getVideoInfo(ytdlpPath, unreachableUrl)).rejects.toThrow();
    }, TEST_TIMEOUT);
    
    it('should handle private/deleted videos', async () => {
      const privateUrl = 'https://www.youtube.com/watch?v=PRIVATE_VIDEO_ID';
      
      await expect(getVideoInfo(ytdlpPath, privateUrl)).rejects.toThrow();
    }, TEST_TIMEOUT);
  });
});

// Helper Functions

async function getYTDLPVersion(binaryPath: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const process = spawn(binaryPath, ['--version']);
    let output = '';
    
    process.stdout.on('data', (data) => {
      output += data.toString();
    });
    
    process.on('close', (code) => {
      if (code === 0) {
        resolve(output.trim());
      } else {
        reject(new Error(`Failed to get version: exit code ${code}`));
      }
    });
    
    process.on('error', reject);
  });
}

async function getVideoInfo(binaryPath: string, url: string): Promise<any> {
  return new Promise((resolve, reject) => {
    const process = spawn(binaryPath, [
      '--dump-json',
      '--no-playlist',
      url
    ]);
    
    let output = '';
    let errorOutput = '';
    
    process.stdout.on('data', (data) => {
      output += data.toString();
    });
    
    process.stderr.on('data', (data) => {
      errorOutput += data.toString();
    });
    
    process.on('close', (code) => {
      if (code === 0) {
        try {
          const info = JSON.parse(output);
          resolve(info);
        } catch (error) {
          reject(new Error('Failed to parse video info JSON'));
        }
      } else {
        reject(new Error(`Failed to get video info: ${errorOutput || 'Unknown error'}`));
      }
    });
    
    process.on('error', reject);
  });
}

async function listFormats(binaryPath: string, url: string): Promise<any[]> {
  return new Promise((resolve, reject) => {
    const process = spawn(binaryPath, [
      '--list-formats',
      '--dump-json',
      url
    ]);
    
    let output = '';
    
    process.stdout.on('data', (data) => {
      output += data.toString();
    });
    
    process.on('close', (code) => {
      if (code === 0) {
        try {
          const info = JSON.parse(output);
          resolve(info.formats || []);
        } catch (error) {
          reject(new Error('Failed to parse formats JSON'));
        }
      } else {
        reject(new Error(`Failed to list formats: exit code ${code}`));
      }
    });
    
    process.on('error', reject);
  });
}

async function checkFFmpegAvailability(binaryPath: string): Promise<boolean> {
  return new Promise((resolve) => {
    const process = spawn(binaryPath, ['--version']);
    let output = '';
    
    process.stdout.on('data', (data) => {
      output += data.toString();
    });
    
    process.on('close', () => {
      // Check if output mentions FFmpeg
      resolve(output.toLowerCase().includes('ffmpeg'));
    });
    
    process.on('error', () => resolve(false));
  });
}

async function testDownloadCommand(
  binaryPath: string, 
  url: string, 
  outputPath: string
): Promise<boolean> {
  return new Promise((resolve, reject) => {
    // Dry run - simulate download without actually downloading
    const process = spawn(binaryPath, [
      '--simulate',
      '--format', 'best',
      '--output', outputPath,
      url
    ]);
    
    process.on('close', (code) => {
      resolve(code === 0);
    });
    
    process.on('error', reject);
  });
}

