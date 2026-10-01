import { existsSync } from 'fs';
import { mkdtemp, rm, writeFile } from 'fs/promises';
import os from 'os';
import path from 'path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  finalizeFinishedRecording,
  looksLikeMpegTs,
} from './liveRecordingRemux';

// MPEG-TS is a run of 188-byte packets, each starting with the 0x47 sync byte.
const tsHeader = (): Buffer => {
  const buf = Buffer.alloc(189);
  buf[0] = 0x47;
  buf[188] = 0x47;
  return buf;
};

// A real MP4 opens with a box whose type is `ftyp` at offset 4.
const mp4Header = (): Buffer =>
  Buffer.concat([
    Buffer.from([0x00, 0x00, 0x00, 0x20]),
    Buffer.from('ftypisom'),
    Buffer.alloc(177),
  ]);

describe('looksLikeMpegTs', () => {
  it('recognises an MPEG-TS stream', () => {
    expect(looksLikeMpegTs(tsHeader())).toBe(true);
  });

  it('leaves a real MP4 alone', () => {
    expect(looksLikeMpegTs(mp4Header())).toBe(false);
  });

  it('needs the second packet too, not just a lucky first byte', () => {
    const buf = tsHeader();
    buf[188] = 0x00;
    expect(looksLikeMpegTs(buf)).toBe(false);
  });

  it('rejects files too short to hold two packets', () => {
    expect(looksLikeMpegTs(Buffer.from([0x47]))).toBe(false);
  });
});

describe('finalizeFinishedRecording', () => {
  let dir: string;
  beforeEach(async () => {
    dir = await mkdtemp(path.join(os.tmpdir(), 'live-finish-'));
  });
  afterEach(async () => {
    await rm(dir, { recursive: true, force: true });
  });

  it('keeps a recording already at its final name', async () => {
    const out = path.join(dir, 'Live.mp4');
    await writeFile(out, 'data');
    expect(await finalizeFinishedRecording(out, null)).toBe(true);
    expect(existsSync(out)).toBe(true);
  });

  it("promotes yt-dlp's .part file when the interrupt skipped the rename", async () => {
    const out = path.join(dir, 'Live.mp4');
    await writeFile(`${out}.part`, 'data');
    expect(await finalizeFinishedRecording(out, null)).toBe(true);
    expect(existsSync(out)).toBe(true);
    expect(existsSync(`${out}.part`)).toBe(false);
  });

  it('reports nothing recorded when neither file exists', async () => {
    expect(
      await finalizeFinishedRecording(path.join(dir, 'Live.mp4'), null),
    ).toBe(false);
  });
});
