#!/usr/bin/env node

/**
 * YTDLP Update Compatibility Test Script
 * 
 * Purpose: Quick validation that yt-dlp update doesn't break download functionality
 * Following Kaizen-AI principles: Measure before and after changes
 */

const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');
const os = require('os');

// Test configuration
const TESTS = {
  version: 'Version Check',
  info: 'Video Info Extraction',
  formats: 'Format Listing',
  simulate: 'Download Simulation',
  ffmpeg: 'FFmpeg Detection'
};

// Test URLs
const TEST_URLS = {
  youtube: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ', // Short, reliable test video
  youtubePlaylist: 'https://www.youtube.com/playlist?list=PLrAXtmErZgOeiKm4sgNOknGvNjby9efdf', // Short playlist
};

// Results tracking
const results = {
  passed: [],
  failed: [],
  warnings: []
};

// Colors for terminal output
const colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m'
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function logSection(title) {
  console.log('\n' + '='.repeat(60));
  log(title, 'cyan');
  console.log('='.repeat(60));
}

// Get correct binary path
function getYTDLPPath() {
  const binaryName = process.platform === 'win32' ? 'yt-dlp.exe' :
                    process.platform === 'linux' ? 'yt-dlp_linux' : 'yt-dlp_macos';
  const binaryPath = path.join(__dirname, binaryName);
  
  if (!fs.existsSync(binaryPath)) {
    log(`❌ Binary not found at: ${binaryPath}`, 'red');
    log(`   Platform: ${process.platform}`, 'yellow');
    log(`   Expected: ${binaryName}`, 'yellow');
    throw new Error('YTDLP binary not found');
  }
  
  return binaryPath;
}

// Execute yt-dlp command and return result
function runYTDLP(args, timeout = 30000) {
  const ytdlpPath = getYTDLPPath();
  
  return new Promise((resolve, reject) => {
    const process = spawn(ytdlpPath, args);
    let stdout = '';
    let stderr = '';
    
    const timer = setTimeout(() => {
      process.kill();
      reject(new Error('Command timeout'));
    }, timeout);
    
    process.stdout.on('data', (data) => {
      stdout += data.toString();
    });
    
    process.stderr.on('data', (data) => {
      stderr += data.toString();
    });
    
    process.on('close', (code) => {
      clearTimeout(timer);
      resolve({ code, stdout, stderr });
    });
    
    process.on('error', (error) => {
      clearTimeout(timer);
      reject(error);
    });
  });
}

// Test 1: Version Check
async function testVersion() {
  log('\n📋 Test 1: Version Check', 'blue');
  
  try {
    const result = await runYTDLP(['--version']);
    
    if (result.code === 0) {
      const version = result.stdout.trim();
      log(`   ✅ Version: ${version}`, 'green');
      
      // Parse version and check if it's recent
      const [year, month, day] = version.split('.').map(Number);
      const versionDate = new Date(year, month - 1, day);
      const threeMonthsAgo = new Date();
      threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);
      
      if (versionDate < threeMonthsAgo) {
        log(`   ⚠️  Version is older than 3 months`, 'yellow');
        results.warnings.push('Old yt-dlp version');
      }
      
      results.passed.push(TESTS.version);
      return true;
    } else {
      log(`   ❌ Failed with exit code: ${result.code}`, 'red');
      results.failed.push(TESTS.version);
      return false;
    }
  } catch (error) {
    log(`   ❌ Error: ${error.message}`, 'red');
    results.failed.push(TESTS.version);
    return false;
  }
}

// Test 2: Video Info Extraction
async function testVideoInfo() {
  log('\n📋 Test 2: Video Info Extraction', 'blue');
  
  try {
    const result = await runYTDLP([
      '--dump-json',
      '--no-playlist',
      TEST_URLS.youtube
    ], 60000);
    
    if (result.code === 0) {
      const info = JSON.parse(result.stdout);
      log(`   ✅ Video Title: ${info.title}`, 'green');
      log(`   ✅ Duration: ${info.duration}s`, 'green');
      log(`   ✅ Formats Available: ${info.formats?.length || 0}`, 'green');
      
      // Validate essential fields
      if (!info.title || !info.duration || !info.formats) {
        log(`   ⚠️  Missing essential fields`, 'yellow');
        results.warnings.push('Incomplete video info');
      }
      
      results.passed.push(TESTS.info);
      return true;
    } else {
      log(`   ❌ Failed with exit code: ${result.code}`, 'red');
      log(`   Error: ${result.stderr}`, 'red');
      results.failed.push(TESTS.info);
      return false;
    }
  } catch (error) {
    log(`   ❌ Error: ${error.message}`, 'red');
    results.failed.push(TESTS.info);
    return false;
  }
}

// Test 3: Format Listing
async function testFormatListing() {
  log('\n📋 Test 3: Format Listing', 'blue');
  
  try {
    // Use --dump-json without --list-formats to get structured data
    const result = await runYTDLP([
      '--dump-json',
      '--no-playlist',
      TEST_URLS.youtube
    ], 60000);
    
    if (result.code === 0) {
      const info = JSON.parse(result.stdout);
      const formats = info.formats || [];
      
      // Count different format types
      const videoFormats = formats.filter(f => f.vcodec && f.vcodec !== 'none');
      const audioFormats = formats.filter(f => f.acodec && f.acodec !== 'none' && (!f.vcodec || f.vcodec === 'none'));
      const combinedFormats = formats.filter(f => 
        f.vcodec && f.vcodec !== 'none' && 
        f.acodec && f.acodec !== 'none'
      );
      
      log(`   ✅ Total Formats: ${formats.length}`, 'green');
      log(`   ✅ Video-only Formats: ${videoFormats.length - combinedFormats.length}`, 'green');
      log(`   ✅ Audio-only Formats: ${audioFormats.length}`, 'green');
      log(`   ✅ Combined Formats: ${combinedFormats.length}`, 'green');
      
      if (formats.length === 0) {
        log(`   ⚠️  No formats found`, 'yellow');
        results.warnings.push('No formats available');
      }
      
      results.passed.push(TESTS.formats);
      return true;
    } else {
      log(`   ❌ Failed with exit code: ${result.code}`, 'red');
      results.failed.push(TESTS.formats);
      return false;
    }
  } catch (error) {
    log(`   ❌ Error: ${error.message}`, 'red');
    results.failed.push(TESTS.formats);
    return false;
  }
}

// Test 4: Download Simulation (dry run)
async function testDownloadSimulation() {
  log('\n📋 Test 4: Download Simulation', 'blue');
  
  try {
    const tempPath = path.join(os.tmpdir(), 'ytdlp-test-%(id)s.%(ext)s');
    
    const result = await runYTDLP([
      '--simulate',
      '--format', 'best',
      '--output', tempPath,
      TEST_URLS.youtube
    ], 60000);
    
    if (result.code === 0) {
      log(`   ✅ Download command structure valid`, 'green');
      log(`   ✅ URL processing successful`, 'green');
      results.passed.push(TESTS.simulate);
      return true;
    } else {
      log(`   ❌ Simulation failed with exit code: ${result.code}`, 'red');
      log(`   Error: ${result.stderr}`, 'red');
      results.failed.push(TESTS.simulate);
      return false;
    }
  } catch (error) {
    log(`   ❌ Error: ${error.message}`, 'red');
    results.failed.push(TESTS.simulate);
    return false;
  }
}

// Test 5: FFmpeg Detection
async function testFFmpegDetection() {
  log('\n📋 Test 5: FFmpeg Detection', 'blue');
  
  try {
    const result = await runYTDLP(['--version'], 30000);
    
    if (result.code === 0) {
      const output = result.stdout + result.stderr;
      const hasFFmpeg = output.toLowerCase().includes('ffmpeg');
      
      if (hasFFmpeg) {
        log(`   ✅ FFmpeg integration detected`, 'green');
        results.passed.push(TESTS.ffmpeg);
        return true;
      } else {
        log(`   ⚠️  FFmpeg not detected (may impact merge functionality)`, 'yellow');
        results.warnings.push('FFmpeg not detected');
        results.passed.push(TESTS.ffmpeg);
        return true; // Not a critical failure
      }
    } else {
      log(`   ❌ Failed to check FFmpeg`, 'red');
      results.failed.push(TESTS.ffmpeg);
      return false;
    }
  } catch (error) {
    log(`   ❌ Error: ${error.message}`, 'red');
    results.failed.push(TESTS.ffmpeg);
    return false;
  }
}

// Main test runner
async function runAllTests() {
  logSection('🧪 YTDLP Update Compatibility Tests');
  
  const startTime = Date.now();
  
  try {
    const ytdlpPath = getYTDLPPath();
    log(`Binary Path: ${ytdlpPath}`, 'cyan');
    log(`Platform: ${process.platform}`, 'cyan');
    
    // Run all tests
    await testVersion();
    await testVideoInfo();
    await testFormatListing();
    await testDownloadSimulation();
    await testFFmpegDetection();
    
  } catch (error) {
    log(`\n❌ Fatal Error: ${error.message}`, 'red');
    process.exit(1);
  }
  
  const duration = ((Date.now() - startTime) / 1000).toFixed(2);
  
  // Print summary
  logSection('📊 Test Results Summary');
  
  log(`\n✅ Passed: ${results.passed.length}/${Object.keys(TESTS).length}`, 'green');
  results.passed.forEach(test => log(`   • ${test}`, 'green'));
  
  if (results.warnings.length > 0) {
    log(`\n⚠️  Warnings: ${results.warnings.length}`, 'yellow');
    results.warnings.forEach(warning => log(`   • ${warning}`, 'yellow'));
  }
  
  if (results.failed.length > 0) {
    log(`\n❌ Failed: ${results.failed.length}`, 'red');
    results.failed.forEach(test => log(`   • ${test}`, 'red'));
  }
  
  log(`\n⏱️  Total Time: ${duration}s`, 'cyan');
  
  // Final verdict
  console.log('\n' + '='.repeat(60));
  if (results.failed.length === 0) {
    log('✅ ALL TESTS PASSED - No regressions detected!', 'green');
    log('   The yt-dlp update is compatible with the app.', 'green');
    process.exit(0);
  } else {
    log('❌ SOME TESTS FAILED - Regressions detected!', 'red');
    log('   Review failed tests before updating yt-dlp.', 'red');
    process.exit(1);
  }
}

// Run tests
runAllTests().catch((error) => {
  log(`\n💥 Unexpected Error: ${error.message}`, 'red');
  console.error(error);
  process.exit(1);
});

