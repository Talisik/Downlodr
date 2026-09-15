/**
 * Helpers for the per-download folder the controller creates when a download
 * is started with `isCreateFolder`.
 *
 * That folder exists only to hold one download, so when the download is
 * removed before it finished the folder is pure garbage — it still holds
 * yt-dlp's `.part` files and nothing will ever complete it. Removing it is
 * only safe if we're sure `location` really is the folder the controller
 * made and not a directory shared with other downloads, which is what
 * `isPerDownloadFolder` checks.
 *
 * The path is the only evidence worth trusting here: `isCreateFolder` says
 * whether *this attempt* should create a folder, not whether the download has
 * one. A retry re-adds the record with `isCreateFolder: false` precisely
 * because the first attempt already made the folder and `location` points at
 * it (see CategoryTagPage's retry handler) — so the flag reads false on the
 * downloads most likely to have left `.part` files behind.
 */

/** Mirrors the sanitizer used in controller.ts when the folder is created. */
export function sanitizeFolderName(name: string): string {
  return name.replace(/[\\/:*?"<>.|]/g, '_');
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * True when `location`'s last path segment is the folder the controller would
 * have created for a download named `name` — either `<sanitized name>` or the
 * `<sanitized name> (n)` variant it falls back to on a collision.
 *
 * This is the only check standing between a caller and a folder delete, so it
 * is deliberately strict: it rejects the main download directory, and it
 * rejects shared plugin output folders (a FormatConverter/ directory holding
 * every conversion of one video is named after the plugin, not the download).
 * It also covers the case where `ensureDirectoryExists` failed at start time
 * and `location` was left pointing at the parent download directory.
 */
export function isPerDownloadFolder(location: string, name: string): boolean {
  const base = location.split(/[\\/]/).filter(Boolean).pop() ?? '';
  const sanitized = sanitizeFolderName(name ?? '');
  if (!base || !sanitized) return false;
  if (base === sanitized) return true;
  return new RegExp(`^${escapeRegExp(sanitized)} \\(\\d+\\)$`).test(base);
}

interface FolderOwningDownload {
  name?: string;
  location?: string;
}

/**
 * Trashes the download's own folder if it has one. Returns whether the folder
 * was actually removed, so callers can fall back to deleting just the file.
 *
 * Note this does not consult `isCreateFolder` — see the module header. The
 * shape of `location` decides, because that is what actually reflects where
 * the download landed.
 */
export async function deletePerDownloadFolder(
  download: FolderOwningDownload | null | undefined,
): Promise<boolean> {
  if (!download?.location || !download.name) return false;
  if (!isPerDownloadFolder(download.location, download.name)) return false;

  try {
    const exists = await window.downlodrFunctions.fileExists(download.location);
    if (!exists) return false;
    return await window.downlodrFunctions.deleteFolder(download.location);
  } catch {
    return false;
  }
}
