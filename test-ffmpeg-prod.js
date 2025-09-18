#!/usr/bin/env node

/**
 * Test script to verify FFmpeg is properly configured in production build
 * Run this after building the app to check FFmpeg availability
 */

const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');

console.log('🔍 FFmpeg Production Build Test');
console.log('=' .repeat(60));

// Check various FFmpeg locations
const locations = [
  // System locations
  '/opt/homebrew/bin/ffmpeg',
  '/usr/local/bin/ffmpeg',
  '/usr/bin/ffmpeg',
  
  // App user data location (production)
  path.join(os.homedir(), 'Library/Application Support/Downlodr/ffmpeg'),
  
  // Current directory
  './ffmpeg',
  
  // PATH
  'ffmpeg'
];

console.log('Checking FFmpeg in the following locations:\n');

async function checkFFmpeg(ffmpegPath) {
  return new Promise((resolve) => {
    const exists = fs.existsSync(ffmpegPath);
    
    if (!exists && !ffmpegPath.includes('/')) {
      // It's just 'ffmpeg', try to run it
      const ffmpeg = spawn(ffmpegPath, ['-version']);
      
      ffmpeg.on('error', () => {
        console.log(`❌ ${ffmpegPath}: Not found in PATH`);
        resolve(false);
      });
      
      ffmpeg.on('close', (code) => {
        if (code === 0) {
          console.log(`✅ ${ffmpegPath}: Found in PATH`);
          resolve(true);
        } else {
          console.log(`❌ ${ffmpegPath}: Found but returned error code ${code}`);
          resolve(false);
        }
      });
    } else if (exists) {
      // File exists, try to run it
      const ffmpeg = spawn(ffmpegPath, ['-version']);
      
      ffmpeg.on('error', (error) => {
        console.log(`⚠️  ${ffmpegPath}: Exists but cannot execute (${error.message})`);
        resolve(false);
      });
      
      ffmpeg.on('close', (code) => {
        if (code === 0) {
          const stats = fs.statSync(ffmpegPath);
          const size = (stats.size / 1024 / 1024).toFixed(2);
          console.log(`✅ ${ffmpegPath}: Working (${size} MB)`);
          resolve(true);
        } else {
          console.log(`⚠️  ${ffmpegPath}: Exists but returned error code ${code}`);
          resolve(false);
        }
      });
    } else {
      console.log(`❌ ${ffmpegPath}: Not found`);
      resolve(false);
    }
  });
}

async function runTests() {
  let foundWorking = false;
  
  for (const location of locations) {
    const works = await checkFFmpeg(location);
    if (works) {
      foundWorking = true;
    }
  }
  
  console.log('\n' + '=' .repeat(60));
  
  if (foundWorking) {
    console.log('✅ FFmpeg is available for the production build');
    console.log('\nRecommendation: The app should work correctly.');
  } else {
    console.log('❌ FFmpeg is NOT available!');
    console.log('\nTo fix this issue:');
    console.log('1. Install FFmpeg: brew install ffmpeg');
    console.log('2. Or copy FFmpeg to the app support directory:');
    console.log('   cp $(which ffmpeg) ~/Library/Application\\ Support/Downlodr/');
    console.log('3. Rebuild the app');
  }
  
  // Check if yt-dlp can find FFmpeg
  console.log('\n' + '=' .repeat(60));
  console.log('Checking if yt-dlp can use FFmpeg...\n');
  
  const ytdlpPath = path.join(os.homedir(), 'Library/Application Support/Downlodr/yt-dlp_macos');
  if (fs.existsSync(ytdlpPath)) {
    const ytdlp = spawn(ytdlpPath, ['--version']);
    
    ytdlp.on('close', (code) => {
      if (code === 0) {
        console.log('✅ yt-dlp is available');
        
        // Test merge capability
        const ytdlpTest = spawn(ytdlpPath, ['--help']);
        let output = '';
        
        ytdlpTest.stdout.on('data', (data) => {
          output += data.toString();
        });
        
        ytdlpTest.on('close', () => {
          if (output.includes('--merge-output-format')) {
            console.log('✅ yt-dlp merge capability available');
          } else {
            console.log('⚠️  yt-dlp merge capability unclear');
          }
        });
      }
    });
  } else {
    console.log('⚠️  yt-dlp not found in app support directory');
  }
}

runTests().catch(console.error);
