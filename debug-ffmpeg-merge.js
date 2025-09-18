#!/usr/bin/env node

/**
 * Debug script to test FFmpeg merging of video and audio streams
 * This helps diagnose issues with yt-dlp's post-processing
 */

const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

// Check if FFmpeg is available
const ffmpegPath = process.platform === 'darwin' ? '/opt/homebrew/bin/ffmpeg' : 'ffmpeg';

// Test files - replace these with actual file paths from your downloads folder
const videoFile = process.argv[2]; // e.g., "video.f137.mp4"
const audioFile = process.argv[3]; // e.g., "video.f140.m4a"
const outputFile = process.argv[4] || 'merged_output.mp4';

if (!videoFile || !audioFile) {
  console.log('Usage: node debug-ffmpeg-merge.js <video_file> <audio_file> [output_file]');
  console.log('Example: node debug-ffmpeg-merge.js video.f137.mp4 video.f140.m4a output.mp4');
  process.exit(1);
}

// Check if input files exist
if (!fs.existsSync(videoFile)) {
  console.error(`Video file not found: ${videoFile}`);
  process.exit(1);
}

if (!fs.existsSync(audioFile)) {
  console.error(`Audio file not found: ${audioFile}`);
  process.exit(1);
}

console.log('🔍 Testing FFmpeg merge functionality...');
console.log(`Video: ${videoFile}`);
console.log(`Audio: ${audioFile}`);
console.log(`Output: ${outputFile}`);

// FFmpeg command to merge video and audio
const ffmpegArgs = [
  '-i', videoFile,       // Input video
  '-i', audioFile,       // Input audio
  '-c:v', 'copy',        // Copy video codec (no re-encoding)
  '-c:a', 'copy',        // Copy audio codec (no re-encoding)
  '-map', '0:v:0',       // Map video stream from first input
  '-map', '1:a:0',       // Map audio stream from second input
  '-y',                  // Overwrite output file
  outputFile
];

console.log(`\n📹 Running: ${ffmpegPath} ${ffmpegArgs.join(' ')}\n`);

const ffmpeg = spawn(ffmpegPath, ffmpegArgs);

let errorOutput = '';

ffmpeg.stdout.on('data', (data) => {
  console.log(`stdout: ${data}`);
});

ffmpeg.stderr.on('data', (data) => {
  const output = data.toString();
  errorOutput += output;
  console.log(`FFmpeg: ${output}`);
});

ffmpeg.on('close', (code) => {
  if (code === 0) {
    console.log('\n✅ Merge completed successfully!');
    
    // Check output file
    if (fs.existsSync(outputFile)) {
      const stats = fs.statSync(outputFile);
      console.log(`📁 Output file: ${outputFile}`);
      console.log(`📏 Size: ${(stats.size / 1024 / 1024).toFixed(2)} MB`);
    }
  } else {
    console.error(`\n❌ FFmpeg exited with code ${code}`);
    console.error('Error output:', errorOutput);
  }
});

ffmpeg.on('error', (error) => {
  console.error('❌ Failed to start FFmpeg:', error.message);
  console.error('Make sure FFmpeg is installed and accessible');
});
