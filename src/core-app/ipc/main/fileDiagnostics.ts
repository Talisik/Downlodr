/**
 * Explains why a file the app expects isn't found. Diagnostic only — used by
 * the background file integrity check to log, for each download it flags as
 * missing, whether the path is really absent or just unreadable, and which
 * files actually sit in that folder under a similar name (e.g. a merge that
 * produced `title.mp4.webm` instead of the planned `title.mp4`).
 */

import fs from 'fs';
import path from 'path';

export interface MissingFileDiagnosis {
  checkedPath: string;
  /** fs error code from access(): ENOENT = absent, EPERM/EACCES = unreadable. */
  accessError: string | null;
  dirExists: boolean;
  /** Folder entries that share the expected name's stem (case-insensitive). */
  similarEntries: string[];
  /** Total entries in the folder, so an empty or wrong folder stands out. */
  dirEntryCount: number;
}

const MAX_SIMILAR_ENTRIES = 10;
// Long enough to be specific, short enough to survive a changed extension or
// a "[1]" uniqueness suffix.
const STEM_PREFIX_LENGTH = 20;

export async function diagnoseMissingFile(
  filePath: string,
): Promise<MissingFileDiagnosis> {
  const diagnosis: MissingFileDiagnosis = {
    checkedPath: filePath,
    accessError: null,
    dirExists: false,
    similarEntries: [],
    dirEntryCount: 0,
  };

  try {
    await fs.promises.access(filePath);
  } catch (err) {
    diagnosis.accessError = (err as NodeJS.ErrnoException).code ?? 'UNKNOWN';
  }

  const dir = path.dirname(filePath);
  let entries: string[];
  try {
    entries = await fs.promises.readdir(dir);
    diagnosis.dirExists = true;
  } catch {
    return diagnosis;
  }

  diagnosis.dirEntryCount = entries.length;
  const stem = path
    .basename(filePath)
    .replace(/\.[^.]*$/, '')
    .slice(0, STEM_PREFIX_LENGTH)
    .toLowerCase();
  diagnosis.similarEntries = entries
    .filter((name) => stem && name.toLowerCase().startsWith(stem))
    .slice(0, MAX_SIMILAR_ENTRIES);

  return diagnosis;
}
