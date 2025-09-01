/**
 * Custom playlist helper to fix the chunking issue with yt-dlp-helper
 *
 * The issue: yt-dlp-helper's getPlaylistInfo function tries to parse each chunk
 * of output as JSON, but large playlists output JSON that spans multiple chunks,
 * causing parse failures.
 *
 * This implementation accumulates all chunks before attempting to parse.
 */

import { spawn } from 'child_process';
import * as fs from 'fs';

interface PlaylistInfo {
  ok: boolean;
  data?: any;
  error?: string;
}

interface GetPlaylistInfoOptions {
  url: string;
  ytdlpPath: string;
  ffmpegPath?: string;
}

/**
 * Custom implementation of getPlaylistInfo that properly handles chunked JSON output
 */
export async function getPlaylistInfo(
  options: GetPlaylistInfoOptions,
): Promise<PlaylistInfo> {
  const { url, ytdlpPath, ffmpegPath } = options;

  console.log('🔄 Custom playlist fetcher - URL:', url);
  console.log('🔄 Using yt-dlp binary:', ytdlpPath);

  // Validate inputs
  if (!url || typeof url !== 'string') {
    return {
      ok: false,
      error: 'Invalid URL provided',
    };
  }

  if (!fs.existsSync(ytdlpPath)) {
    return {
      ok: false,
      error: `yt-dlp binary not found at: ${ytdlpPath}`,
    };
  }

  // Build command arguments
  const args = ['--flat-playlist', '-J', url];

  if (ffmpegPath && fs.existsSync(ffmpegPath)) {
    args.unshift('--ffmpeg-location', ffmpegPath);
  }

  console.log('🔄 Executing command:', ytdlpPath, args.join(' '));

  return new Promise((resolve) => {
    const child = spawn(ytdlpPath, args, {
      stdio: ['pipe', 'pipe', 'pipe'],
    });

    let stdout = '';
    let stderr = '';
    let chunkCount = 0;

    child.stdout.on('data', (data) => {
      chunkCount++;
      const chunk = data.toString();
      stdout += chunk;
      console.log(`📦 Received chunk ${chunkCount}: ${chunk.length} chars`);
    });

    child.stderr.on('data', (data) => {
      stderr += data.toString();
    });

    child.on('close', (code, signal) => {
      console.log(`🏁 Process finished - Code: ${code}, Signal: ${signal}`);
      console.log(
        `📊 Total data received: ${stdout.length} chars in ${chunkCount} chunks`,
      );

      if (stderr) {
        console.log('⚠️ stderr output:', stderr.substring(0, 500));
      }

      if (code !== 0) {
        console.error(`❌ yt-dlp exited with code ${code}`);
        return resolve({
          ok: false,
          error: `yt-dlp process failed with exit code ${code}. stderr: ${stderr}`,
        });
      }

      if (!stdout.trim()) {
        console.error('❌ No output received from yt-dlp');
        return resolve({
          ok: false,
          error: 'No output received from yt-dlp',
        });
      }

      // Try to parse the accumulated JSON
      try {
        console.log('🔍 Attempting to parse JSON...');
        const data = JSON.parse(stdout);

        console.log('✅ Successfully parsed JSON!');
        console.log(
          `📊 Playlist info: Title="${data.title || 'No title'}", Entries=${
            data.entries?.length || 0
          }`,
        );

        resolve({
          ok: true,
          data,
        });
      } catch (parseError) {
        console.error('❌ Failed to parse JSON:', parseError);
        console.error('First 200 chars of output:', stdout.substring(0, 200));
        console.error(
          'Last 200 chars of output:',
          stdout.substring(stdout.length - 200),
        );

        resolve({
          ok: false,
          error: `Failed to parse playlist JSON: ${parseError.message}`,
        });
      }
    });

    child.on('error', (error) => {
      console.error('❌ Process error:', error);
      resolve({
        ok: false,
        error: `Failed to start yt-dlp process: ${error.message}`,
      });
    });

    // Set timeout to prevent hanging
    const timeout = setTimeout(() => {
      console.error('❌ Process timeout - killing child process');
      child.kill('SIGTERM');
      resolve({
        ok: false,
        error: 'Process timeout - operation took too long',
      });
    }, 60000); // 60 second timeout

    child.on('close', () => {
      clearTimeout(timeout);
    });
  });
}

/**
 * Test function to verify the custom implementation works
 */
export async function testCustomPlaylistInfo() {
  console.log('=== Testing Custom Playlist Info Implementation ===');

  const testUrl =
    'https://youtube.com/playlist?list=PLFt_AvWsXl0eBW2EiBtl_sxmDtSgZBxB3';
  const ytdlpPath = './yt-dlp_macos';
  const ffmpegPath = '/opt/homebrew/bin/ffmpeg';

  const result = await getPlaylistInfo({
    url: testUrl,
    ytdlpPath,
    ffmpegPath,
  });

  console.log('=== Test Result ===');
  console.log('Success:', result.ok);
  if (result.ok && result.data) {
    console.log('Title:', result.data.title);
    console.log('Entry count:', result.data.entries?.length || 0);
    console.log(
      'First 3 entries:',
      result.data.entries?.slice(0, 3).map((e: any) => ({
        id: e.id,
        title: e.title,
      })),
    );
  } else {
    console.log('Error:', result.error);
  }

  return result;
}
