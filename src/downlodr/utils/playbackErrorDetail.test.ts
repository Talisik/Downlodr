import { describe, expect, it } from 'vitest';
import { playbackErrorDetail } from './playbackErrorDetail';

describe('playbackErrorDetail', () => {
  it('strips the Electron IPC wrapper and yt-dlp prefixes', () => {
    const raw = new Error(
      "Error invoking remote method 'ytdlp:downloadPreview': Error: ERROR: [youtube] dQw4w9WgXcQ: Requested format is not available. Use --list-formats for a list of available formats",
    );
    expect(playbackErrorDetail(raw)).toBe(
      'Requested format is not available. Use --list-formats for a list of available formats',
    );
  });

  it('keeps only the first line of multi-line output', () => {
    expect(
      playbackErrorDetail('ERROR: [generic] x: HTTP Error 403: Forbidden\nmore'),
    ).toBe('HTTP Error 403: Forbidden');
  });

  it('shortens very long messages', () => {
    const detail = playbackErrorDetail('x'.repeat(500));
    expect(detail!.length).toBeLessThanOrEqual(160);
    expect(detail!.endsWith('…')).toBe(true);
  });

  it('returns null when there is nothing useful to show', () => {
    expect(playbackErrorDetail(undefined)).toBeNull();
    expect(playbackErrorDetail('   ')).toBeNull();
  });
});
