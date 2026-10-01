import fs from 'fs';
import os from 'os';
import path from 'path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { diagnoseMissingFile } from './fileDiagnostics';

describe('diagnoseMissingFile', () => {
  let dir: string;

  beforeEach(() => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), 'file-diag-'));
  });

  afterEach(() => {
    fs.rmSync(dir, { recursive: true, force: true });
  });

  it('reports a file that exists as having no access error', async () => {
    const file = path.join(dir, 'Some Video Title.mp4');
    fs.writeFileSync(file, '');

    const result = await diagnoseMissingFile(file);

    expect(result.accessError).toBeNull();
    expect(result.dirExists).toBe(true);
  });

  it('finds the file saved under a different extension', async () => {
    fs.writeFileSync(path.join(dir, 'Some Video Title.mp4.webm'), '');
    fs.writeFileSync(path.join(dir, 'Unrelated.mp4'), '');

    const result = await diagnoseMissingFile(
      path.join(dir, 'Some Video Title.mp4'),
    );

    expect(result.accessError).toBe('ENOENT');
    expect(result.dirExists).toBe(true);
    expect(result.dirEntryCount).toBe(2);
    expect(result.similarEntries).toEqual(['Some Video Title.mp4.webm']);
  });

  it('matches regardless of case', async () => {
    fs.writeFileSync(path.join(dir, 'SOME VIDEO TITLE.mkv'), '');

    const result = await diagnoseMissingFile(
      path.join(dir, 'Some Video Title.mp4'),
    );

    expect(result.similarEntries).toEqual(['SOME VIDEO TITLE.mkv']);
  });

  it('reports a missing folder', async () => {
    const result = await diagnoseMissingFile(
      path.join(dir, 'gone', 'Some Video Title.mp4'),
    );

    expect(result.accessError).toBe('ENOENT');
    expect(result.dirExists).toBe(false);
    expect(result.similarEntries).toEqual([]);
  });
});
