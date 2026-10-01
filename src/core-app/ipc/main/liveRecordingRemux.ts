/**
 * Turns a finished live recording into a real MP4.
 *
 * yt-dlp records live HLS streams through ffmpeg into an MPEG-TS container
 * (so a recording cut short is still playable), then normally remuxes it when
 * the stream ends. When the user stops a recording ("Finish recording"),
 * ffmpeg exits on the interrupt and yt-dlp's VideoRemuxer only checks the file
 * *extension* — it logs `Not remuxing ... already is in target format mp4` and
 * leaves an MPEG-TS stream sitting in a `.mp4` file. Media players cope, but
 * Chromium's <video> element cannot play MPEG-TS, so the in-app player errors
 * on every finished recording.
 *
 * This sniffs the actual container and, only when it is MPEG-TS, stream-copies
 * it into MP4 (no re-encode: fast and lossless), replacing the file in place.
 */
import { spawn } from 'child_process';
import { access, open, rename, rm } from 'fs/promises';
import path from 'path';

const TS_PACKET_SIZE = 188;
const TS_SYNC_BYTE = 0x47;

/**
 * True when `header` starts with two consecutive MPEG-TS packets. Checking the
 * second packet's sync byte too keeps a file that merely happens to start
 * with 0x47 from being treated as TS.
 */
export function looksLikeMpegTs(header: Buffer): boolean {
  return (
    header.length > TS_PACKET_SIZE &&
    header[0] === TS_SYNC_BYTE &&
    header[TS_PACKET_SIZE] === TS_SYNC_BYTE
  );
}

async function readHeader(filePath: string): Promise<Buffer | null> {
  let handle;
  try {
    handle = await open(filePath, 'r');
    const buf = Buffer.alloc(TS_PACKET_SIZE + 1);
    const { bytesRead } = await handle.read(buf, 0, buf.length, 0);
    return buf.subarray(0, bytesRead);
  } catch {
    return null;
  } finally {
    await handle?.close();
  }
}

function runFfmpeg(ffmpegPath: string, args: string[]): Promise<boolean> {
  return new Promise((resolve) => {
    const proc = spawn(ffmpegPath, args, { windowsHide: true });
    proc.once('error', () => resolve(false));
    proc.once('close', (code) => resolve(code === 0));
  });
}

/**
 * Remuxes `filePath` to MP4 if it is an MPEG-TS stream with a `.mp4` name.
 * Returns whether the file was rewritten. Never throws: on any failure the
 * original recording is left exactly as it was.
 */
export async function remuxMpegTsRecording(
  filePath: string,
  ffmpegPath: string | null,
): Promise<boolean> {
  if (!ffmpegPath || path.extname(filePath).toLowerCase() !== '.mp4') {
    return false;
  }
  const header = await readHeader(filePath);
  if (!header || !looksLikeMpegTs(header)) return false;

  const tempPath = `${filePath}.remux.mp4`;
  const ok = await runFfmpeg(ffmpegPath, [
    '-hide_banner',
    '-loglevel',
    'error',
    '-y',
    '-i',
    filePath,
    '-map',
    '0',
    '-c',
    'copy',
    // ADTS AAC (as carried in TS) needs its headers rewritten for MP4.
    '-bsf:a',
    'aac_adtstoasc',
    '-movflags',
    '+faststart',
    tempPath,
  ]);
  if (!ok) {
    await rm(tempPath, { force: true }).catch(() => undefined);
    console.error(`[liveRecordingRemux] ffmpeg remux failed for ${filePath}`);
    return false;
  }
  try {
    await rename(tempPath, filePath);
    return true;
  } catch (err) {
    console.error('[liveRecordingRemux] could not replace recording:', err);
    await rm(tempPath, { force: true }).catch(() => undefined);
    return false;
  }
}

const fileExists = (p: string): Promise<boolean> =>
  access(p).then(
    () => true,
    () => false,
  );

/**
 * Settles the file for a recording the user chose to finish. yt-dlp's exit
 * code can't be trusted here: it usually exits 0 after our Ctrl+C, but QA has
 * seen it exit 1 for the same action. What matters is whether anything was
 * recorded — promote a leftover `.part` in case the interrupt skipped yt-dlp's
 * rename, remux it to a real MP4, and report whether a recording exists.
 */
export async function finalizeFinishedRecording(
  filePath: string,
  ffmpegPath: string | null,
): Promise<boolean> {
  if (!(await fileExists(filePath))) {
    const partPath = `${filePath}.part`;
    if (!(await fileExists(partPath))) return false;
    try {
      await rename(partPath, filePath);
    } catch (err) {
      console.error('[liveRecordingRemux] could not promote .part file:', err);
      return false;
    }
  }
  await remuxMpegTsRecording(filePath, ffmpegPath);
  return true;
}
