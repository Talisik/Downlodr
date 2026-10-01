import { describe, expect, it } from 'vitest';
import { findCaptionlessDownloads } from './captionEligibility';

const finished = (id: string, extra: Record<string, unknown> = {}) => ({
  id,
  status: 'finished',
  transcriptLocation: '',
  autoCaptionLocation: '',
  ...extra,
});

const onDisk = new Set(['C:/dl/has-captions.srt']);
const fileExists = async (p: string) => onDisk.has(p);

describe('findCaptionlessDownloads', () => {
  it('includes a finished video with no caption path', async () => {
    const result = await findCaptionlessDownloads([finished('a')], fileExists);
    expect(result.map((d) => d.id)).toEqual(['a']);
  });

  it('includes a video whose recorded caption path has no file on disk', async () => {
    // Captions were requested at download time, so the record holds the
    // expected .srt path — but the file was never produced.
    const result = await findCaptionlessDownloads(
      [finished('b', { transcriptLocation: 'C:/dl/never-made.srt' })],
      fileExists,
    );
    expect(result.map((d) => d.id)).toEqual(['b']);
  });

  it('excludes a video whose captions exist on disk', async () => {
    const result = await findCaptionlessDownloads(
      [finished('c', { transcriptLocation: 'C:/dl/has-captions.srt' })],
      fileExists,
    );
    expect(result).toEqual([]);
  });

  it('falls back to autoCaptionLocation when transcriptLocation is unset', async () => {
    const result = await findCaptionlessDownloads(
      [
        finished('d', {
          transcriptLocation: undefined,
          autoCaptionLocation: 'C:/dl/has-captions.srt',
        }),
      ],
      fileExists,
    );
    expect(result).toEqual([]);
  });

  it.each(['queued', 'transcribing'])(
    'excludes a video already %s',
    async (transcriptionStatus) => {
      const result = await findCaptionlessDownloads(
        [finished('e', { transcriptionStatus })],
        fileExists,
      );
      expect(result).toEqual([]);
    },
  );

  it('excludes anything not finished', async () => {
    const result = await findCaptionlessDownloads(
      [finished('f', { status: 'failed' })],
      fileExists,
    );
    expect(result).toEqual([]);
  });

  it('treats a failed disk check as no captions', async () => {
    const result = await findCaptionlessDownloads(
      [finished('g', { transcriptLocation: 'C:/dl/x.srt' })],
      async () => {
        throw new Error('EPERM');
      },
    );
    expect(result.map((d) => d.id)).toEqual(['g']);
  });
});
