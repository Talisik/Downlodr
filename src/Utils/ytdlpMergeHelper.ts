/**
 * Helper utilities for managing yt-dlp merging of video and audio streams
 */

import { app } from 'electron';
import path from 'path';
import fs from 'fs';
import { spawn } from 'child_process';

interface MergeOptions {
  videoPath: string;
  audioPath: string;
  outputPath: string;
  onProgress?: (percent: number) => void;
  onComplete?: () => void;
  onError?: (error: string) => void;
}

/**
 * Get the correct FFmpeg binary path based on the platform
 */
export function getFFmpegPath(): string {
  if (!app.isPackaged) {
    // Development mode
    return process.platform === 'darwin' ? '/opt/homebrew/bin/ffmpeg' : 'ffmpeg';
  }

  // Production mode
  const userDataPath = app.getPath('userData');
  const ffmpegName = process.platform === 'win32' ? 'ffmpeg.exe' : 'ffmpeg';
  return path.join(userDataPath, ffmpegName);
}

/**
 * Check if FFmpeg is available
 */
export async function checkFFmpegAvailable(): Promise<boolean> {
  return new Promise((resolve) => {
    const ffmpegPath = getFFmpegPath();
    const ffmpeg = spawn(ffmpegPath, ['-version']);
    
    ffmpeg.on('error', () => {
      console.error('FFmpeg not found at:', ffmpegPath);
      resolve(false);
    });
    
    ffmpeg.on('close', (code) => {
      resolve(code === 0);
    });
  });
}

/**
 * Manually merge video and audio files using FFmpeg
 */
export async function mergeVideoAudio(options: MergeOptions): Promise<boolean> {
  const { videoPath, audioPath, outputPath, onProgress, onComplete, onError } = options;

  // Validate input files
  if (!fs.existsSync(videoPath)) {
    onError?.(`Video file not found: ${videoPath}`);
    return false;
  }

  if (!fs.existsSync(audioPath)) {
    onError?.(`Audio file not found: ${audioPath}`);
    return false;
  }

  const ffmpegPath = getFFmpegPath();
  
  // FFmpeg arguments for merging
  const args = [
    '-i', videoPath,      // Input video
    '-i', audioPath,      // Input audio
    '-c:v', 'copy',       // Copy video codec (no re-encoding)
    '-c:a', 'copy',       // Copy audio codec (no re-encoding)
    '-map', '0:v:0',      // Map video stream from first input
    '-map', '1:a:0',      // Map audio stream from second input
    '-movflags', '+faststart',  // Optimize for streaming
    '-y',                 // Overwrite output
    outputPath
  ];

  console.log(`🎬 Merging video and audio: ${path.basename(outputPath)}`);

  return new Promise((resolve) => {
    const ffmpeg = spawn(ffmpegPath, args);
    let duration = 0;
    let currentTime = 0;

    ffmpeg.stderr.on('data', (data) => {
      const output = data.toString();
      
      // Parse duration
      const durationMatch = output.match(/Duration: (\d{2}):(\d{2}):(\d{2})/);
      if (durationMatch) {
        const hours = parseInt(durationMatch[1]);
        const minutes = parseInt(durationMatch[2]);
        const seconds = parseInt(durationMatch[3]);
        duration = hours * 3600 + minutes * 60 + seconds;
      }

      // Parse current time for progress
      const timeMatch = output.match(/time=(\d{2}):(\d{2}):(\d{2})/);
      if (timeMatch && duration > 0) {
        const hours = parseInt(timeMatch[1]);
        const minutes = parseInt(timeMatch[2]);
        const seconds = parseInt(timeMatch[3]);
        currentTime = hours * 3600 + minutes * 60 + seconds;
        
        const progress = Math.min(100, (currentTime / duration) * 100);
        onProgress?.(progress);
      }
    });

    ffmpeg.on('close', (code) => {
      if (code === 0) {
        console.log(`✅ Successfully merged: ${path.basename(outputPath)}`);
        
        // Clean up temporary files
        try {
          fs.unlinkSync(videoPath);
          fs.unlinkSync(audioPath);
          console.log('🗑️ Cleaned up temporary files');
        } catch (error) {
          console.warn('Could not clean up temporary files:', error);
        }
        
        onComplete?.();
        resolve(true);
      } else {
        const error = `FFmpeg merge failed with code ${code}`;
        console.error(`❌ ${error}`);
        onError?.(error);
        resolve(false);
      }
    });

    ffmpeg.on('error', (error) => {
      console.error('❌ FFmpeg error:', error.message);
      onError?.(error.message);
      resolve(false);
    });
  });
}

/**
 * Find and merge orphaned video/audio file pairs
 */
export async function findAndMergeOrphans(downloadPath: string): Promise<string[]> {
  const merged: string[] = [];
  
  try {
    const files = fs.readdirSync(downloadPath);
    
    // Look for file pairs with format IDs (e.g., video.f137.mp4 and video.f140.m4a)
    const videoFiles = files.filter(f => f.match(/\.f\d+\.(mp4|webm|mkv)$/));
    const audioFiles = files.filter(f => f.match(/\.f\d+\.(m4a|webm|opus|aac)$/));
    
    for (const videoFile of videoFiles) {
      // Extract base name without format ID
      const baseName = videoFile.replace(/\.f\d+\.\w+$/, '');
      
      // Find matching audio file
      const matchingAudio = audioFiles.find(a => a.startsWith(baseName));
      
      if (matchingAudio) {
        const videoPath = path.join(downloadPath, videoFile);
        const audioPath = path.join(downloadPath, matchingAudio);
        const outputPath = path.join(downloadPath, `${baseName}.mp4`);
        
        // Skip if output already exists
        if (fs.existsSync(outputPath)) {
          continue;
        }
        
        console.log(`🔍 Found orphaned pair: ${videoFile} + ${matchingAudio}`);
        
        const success = await mergeVideoAudio({
          videoPath,
          audioPath,
          outputPath,
          onProgress: (p) => console.log(`Progress: ${p.toFixed(1)}%`),
        });
        
        if (success) {
          merged.push(outputPath);
        }
      }
    }
  } catch (error) {
    console.error('Error scanning for orphans:', error);
  }
  
  return merged;
}

/**
 * Configure yt-dlp to use the correct FFmpeg path
 */
export function configureYTDLPFFmpeg(ytdlpModule: any): void {
  const ffmpegPath = getFFmpegPath();
  
  if (ytdlpModule?.Config) {
    ytdlpModule.Config.ffmpegPath = ffmpegPath;
    console.log(`📦 Configured yt-dlp to use FFmpeg at: ${ffmpegPath}`);
  }
}
