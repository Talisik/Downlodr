#!/usr/bin/env node

/**
 * Diagnostic and recovery script for unmerged yt-dlp downloads
 * This script finds and merges orphaned video/audio file pairs
 */

const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

// Configuration
const ffmpegPath = process.platform === 'darwin' ? '/opt/homebrew/bin/ffmpeg' : 'ffmpeg';

// Get download directory from command line or use default
const downloadDir = process.argv[2] || path.join(process.env.HOME, 'Downloads');

console.log('🔍 Scanning for unmerged downloads in:', downloadDir);
console.log('=' .repeat(60));

// Find potential unmerged file pairs
function findUnmergedPairs(directory) {
  const files = fs.readdirSync(directory);
  const pairs = [];
  
  // Pattern to match yt-dlp format-specific files
  // e.g., "video.f137.mp4", "video.f140.m4a"
  const formatPattern = /^(.+)\.f(\d+)\.(mp4|webm|mkv|m4a|opus|aac|ogg)$/;
  
  // Group files by base name
  const fileGroups = {};
  
  files.forEach(file => {
    const match = file.match(formatPattern);
    if (match) {
      const baseName = match[1];
      const formatId = match[2];
      const extension = match[3];
      
      if (!fileGroups[baseName]) {
        fileGroups[baseName] = [];
      }
      
      fileGroups[baseName].push({
        file,
        formatId,
        extension,
        isVideo: ['mp4', 'webm', 'mkv'].includes(extension),
        isAudio: ['m4a', 'opus', 'aac', 'ogg'].includes(extension),
        path: path.join(directory, file)
      });
    }
  });
  
  // Find pairs that have both video and audio
  Object.keys(fileGroups).forEach(baseName => {
    const group = fileGroups[baseName];
    const videoFiles = group.filter(f => f.isVideo);
    const audioFiles = group.filter(f => f.isAudio);
    
    if (videoFiles.length > 0 && audioFiles.length > 0) {
      // Check if merged file already exists
      const outputName = `${baseName}.mp4`;
      const outputPath = path.join(directory, outputName);
      
      if (!fs.existsSync(outputPath)) {
        pairs.push({
          baseName,
          video: videoFiles[0],
          audio: audioFiles[0],
          outputPath
        });
      }
    }
  });
  
  return pairs;
}

// Merge a single pair
async function mergePair(pair) {
  return new Promise((resolve, reject) => {
    console.log(`\n🎬 Merging: ${pair.baseName}`);
    console.log(`  📹 Video: ${pair.video.file} (${getFileSize(pair.video.path)})`);
    console.log(`  🎵 Audio: ${pair.audio.file} (${getFileSize(pair.audio.path)})`);
    
    const args = [
      '-i', pair.video.path,
      '-i', pair.audio.path,
      '-c:v', 'copy',
      '-c:a', 'copy',
      '-map', '0:v:0',
      '-map', '1:a:0',
      '-movflags', '+faststart',
      '-y',
      pair.outputPath
    ];
    
    const ffmpeg = spawn(ffmpegPath, args);
    let lastProgress = '';
    
    ffmpeg.stderr.on('data', (data) => {
      const output = data.toString();
      const timeMatch = output.match(/time=[\d:\.]+/);
      if (timeMatch) {
        lastProgress = timeMatch[0];
        process.stdout.write(`\r  ⏳ Progress: ${lastProgress}`);
      }
    });
    
    ffmpeg.on('close', (code) => {
      process.stdout.write('\r' + ' '.repeat(40) + '\r'); // Clear progress line
      
      if (code === 0) {
        const outputSize = getFileSize(pair.outputPath);
        console.log(`  ✅ Success! Output: ${path.basename(pair.outputPath)} (${outputSize})`);
        
        // Ask about cleanup
        console.log(`  🗑️  Removing temporary files...`);
        try {
          fs.unlinkSync(pair.video.path);
          fs.unlinkSync(pair.audio.path);
          console.log(`  ✅ Temporary files removed`);
        } catch (error) {
          console.log(`  ⚠️  Could not remove temporary files: ${error.message}`);
        }
        
        resolve(true);
      } else {
        console.log(`  ❌ Failed! FFmpeg exited with code ${code}`);
        resolve(false);
      }
    });
    
    ffmpeg.on('error', (error) => {
      console.log(`  ❌ Error: ${error.message}`);
      resolve(false);
    });
  });
}

// Get human-readable file size
function getFileSize(filePath) {
  try {
    const stats = fs.statSync(filePath);
    const bytes = stats.size;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    if (bytes === 0) return '0 B';
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return Math.round(bytes / Math.pow(1024, i) * 100) / 100 + ' ' + sizes[i];
  } catch {
    return 'unknown';
  }
}

// Check FFmpeg availability
function checkFFmpeg() {
  return new Promise((resolve) => {
    const ffmpeg = spawn(ffmpegPath, ['-version']);
    ffmpeg.on('error', () => resolve(false));
    ffmpeg.on('close', (code) => resolve(code === 0));
  });
}

// Main execution
async function main() {
  // Check FFmpeg
  console.log('🔧 Checking FFmpeg...');
  const ffmpegAvailable = await checkFFmpeg();
  
  if (!ffmpegAvailable) {
    console.error('❌ FFmpeg not found! Please install FFmpeg first.');
    console.error('   On macOS: brew install ffmpeg');
    console.error('   On Windows: Download from https://ffmpeg.org/download.html');
    process.exit(1);
  }
  
  console.log('✅ FFmpeg is available\n');
  
  // Find unmerged pairs
  const pairs = findUnmergedPairs(downloadDir);
  
  if (pairs.length === 0) {
    console.log('✨ No unmerged file pairs found!');
    console.log('\nIf you expected to find unmerged files, they might:');
    console.log('  - Already be merged');
    console.log('  - Be in a different directory');
    console.log('  - Not follow the expected naming pattern (*.f<id>.<ext>)');
    return;
  }
  
  console.log(`📦 Found ${pairs.length} unmerged file pair(s)\n`);
  
  // Process each pair
  let successCount = 0;
  let failCount = 0;
  
  for (const pair of pairs) {
    const success = await mergePair(pair);
    if (success) {
      successCount++;
    } else {
      failCount++;
    }
  }
  
  // Summary
  console.log('\n' + '=' .repeat(60));
  console.log('📊 Summary:');
  console.log(`  ✅ Successfully merged: ${successCount}`);
  if (failCount > 0) {
    console.log(`  ❌ Failed: ${failCount}`);
  }
  console.log('\n✨ Done!');
}

// Run the script
main().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
