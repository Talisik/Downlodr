/**
 * Wires the core download store to the chat bridge round-trip.
 *
 * The AI chat runs in the main process and cannot read this Zustand store, so
 * the main process sends `downloads:query` / `downloads:command` events (via the
 * downloadQueryBridge preload). Here in the renderer we answer them by reading
 * useDownloadStore.getState() and invoking its actions.
 *
 * Call registerDownloadChatBridge() once during renderer startup.
 */
import useDownloadStore from './downloadStore';

// A serializable, chat-friendly view of one download (no live controllers).
interface DownloadDTO {
  id: string;
  name: string;
  status: string;
  progress: number;
  size: number;
  location: string;
  ext: string;
  videoUrl: string;
  tags: string[];
  category: string[];
  favorited: boolean;
}

function toDTO(d: Record<string, unknown>): DownloadDTO {
  return {
    id: String(d.id ?? ''),
    name: String(d.name ?? ''),
    status: String(d.status ?? ''),
    progress: Number(d.progress ?? 0),
    size: Number(d.size ?? 0),
    location: String(d.location ?? ''),
    ext: String(d.ext ?? ''),
    videoUrl: String(d.videoUrl ?? ''),
    tags: Array.isArray(d.tags) ? (d.tags as string[]) : [],
    category: Array.isArray(d.category) ? (d.category as string[]) : [],
    favorited: !!d.favorited,
  };
}

// Flatten every download list into one array, tagging each with its bucket.
function allDownloads(): Array<DownloadDTO & { bucket: string }> {
  const s = useDownloadStore.getState() as unknown as Record<string, unknown[]>;
  const buckets: Array<[string, string]> = [
    ['downloading', 'downloading'],
    ['queuedDownloads', 'queued'],
    ['forDownloads', 'to download'],
    ['finishedDownloads', 'finished'],
    ['failedDownloads', 'failed'],
    ['historyDownloads', 'history'],
  ];
  const out: Array<DownloadDTO & { bucket: string }> = [];
  for (const [key, bucket] of buckets) {
    const arr = Array.isArray(s[key]) ? s[key] : [];
    for (const item of arr as Record<string, unknown>[]) {
      out.push({ ...toDTO(item), bucket });
    }
  }
  return out;
}

function findById(id: string): (DownloadDTO & { bucket: string }) | undefined {
  return allDownloads().find((d) => d.id === id);
}

// ─── Query handler (reads) ──────────────────────────────────────────────────
async function handleQuery(payload: unknown): Promise<unknown> {
  const p = (payload ?? {}) as Record<string, unknown>;
  const op = String(p.op ?? 'list');

  switch (op) {
    case 'list': {
      let rows = allDownloads();
      const status = p.status ? String(p.status).toLowerCase() : '';
      const search = p.search ? String(p.search).toLowerCase() : '';
      const tag = p.tag ? String(p.tag).toLowerCase() : '';
      const category = p.category ? String(p.category).toLowerCase() : '';
      if (status)
        rows = rows.filter(
          (d) => d.status.toLowerCase() === status || d.bucket === status,
        );
      if (search)
        rows = rows.filter((d) => d.name.toLowerCase().includes(search));
      if (tag)
        rows = rows.filter((d) => d.tags.some((t) => t.toLowerCase() === tag));
      if (category)
        rows = rows.filter((d) =>
          d.category.some((c) => c.toLowerCase() === category),
        );
      return { downloads: rows, total: rows.length };
    }
    case 'get': {
      const d = findById(String(p.id ?? ''));
      return d ?? { error: 'Download not found.' };
    }
    case 'log': {
      const s = useDownloadStore.getState() as unknown as Record<
        string,
        Record<string, unknown>[]
      >;
      const id = String(p.id ?? '');
      for (const key of [
        'downloading',
        'finishedDownloads',
        'failedDownloads',
        'historyDownloads',
      ]) {
        const item = (s[key] ?? []).find((x) => String(x.id) === id);
        if (item)
          return {
            id,
            log: String(item.log ?? item.consoleLog ?? '(no log available)'),
          };
      }
      return { error: 'Download not found.' };
    }
    case 'tags': {
      const s = useDownloadStore.getState() as unknown as Record<
        string,
        unknown
      >;
      return { tags: Array.isArray(s.availableTags) ? s.availableTags : [] };
    }
    case 'categories': {
      const s = useDownloadStore.getState() as unknown as Record<
        string,
        unknown
      >;
      return {
        categories: Array.isArray(s.availableCategories)
          ? s.availableCategories
          : [],
      };
    }
    case 'favorites': {
      const favs = allDownloads().filter((d) => d.favorited);
      return { favorites: favs };
    }
    default:
      return { error: `Unknown query op: ${op}` };
  }
}

// ─── Command handler (mutations) ────────────────────────────────────────────
async function handleCommand(payload: unknown): Promise<unknown> {
  const p = (payload ?? {}) as Record<string, unknown>;
  const action = String(p.action ?? '');
  const store = useDownloadStore.getState();
  const id = p.id ? String(p.id) : '';

  switch (action) {
    case 'start_download': {
      // Route a chat-initiated download through the SAME store action the UI
      // uses when a user pastes a URL (setDownload). The store fetches metadata,
      // queues it, and its controller runs the download — so it shows up in the
      // downloads list with title/thumbnail/live progress, persists, and is
      // manageable (retry/delete/tag) exactly like a UI-started download.
      const url = String(p.url ?? '');
      if (!url) return { error: 'url required' };
      const location = String(p.location ?? '');
      if (!location) return { error: 'location required' };
      const limitRate = String(p.limitRate ?? '');
      // Fire-and-forget: setDownload creates the store record synchronously,
      // then fetches metadata + downloads in the background. We must NOT await
      // it — the bridge command round-trip has an ~8s timeout, and metadata
      // fetch routinely exceeds that, which would (a) time the command out and
      // (b) trigger a DUPLICATE standalone download via the bridge's fallback.
      // Returning immediately lets the renderer-store download proceed alone.
      void store
        .setDownload(url, location, limitRate, {
          getTranscript: false,
          getThumbnail: false,
        })
        .catch((e) =>
          console.error('[chat-bridge] setDownload failed:', e),
        );
      return {
        ok: true,
        message:
          'Download started in Downlodr — it will appear in your downloads list with live progress.',
      };
    }
    case 'stop': {
      // Cancel a download by its list id — mirrors the UI's stop handler.
      // Active (downloading) items: kill the running controller, drop them, and
      // let the queue advance. Paused/queued/to-download items: just remove.
      const d = findById(id);
      if (!d) return { error: 'Download not found.' };
      if (['finished', 'failed', 'history'].includes(d.bucket)) {
        return {
          error: `Cannot stop a ${d.bucket} download. Use delete to remove it.`,
        };
      }
      const s = useDownloadStore.getState() as unknown as Record<
        string,
        Record<string, unknown>[]
      >;
      if (d.bucket === 'queued') {
        store.removeFromQueue(id);
        return { ok: true, message: 'Removed from the download queue.' };
      }
      if (d.bucket === 'to download') {
        store.removeFromForDownloads(id);
        store.processQueue();
        return { ok: true, message: 'Removed from the to-download list.' };
      }
      // bucket === 'downloading' (status may be 'downloading' or 'paused')
      const record = (s.downloading ?? []).find((x) => String(x.id) === id);
      const controllerId =
        record && typeof record.controllerId === 'string'
          ? record.controllerId
          : undefined;
      // A paused item's process was already killed when it was paused —
      // nothing left to stop, just drop it from the list.
      if (record?.status !== 'paused') {
        if (!controllerId || controllerId === '---') {
          return {
            error:
              'Download is still initializing and cannot be stopped yet. Try again in a moment.',
          };
        }
        const killed = await window.ytdlp?.killController?.(controllerId);
        if (!killed) {
          return {
            error:
              'Failed to stop the download — it may have already finished. Check its status.',
          };
        }
      }
      store.deleteDownloading(id);
      store.processQueue();
      return { ok: true, message: 'Download stopped.' };
    }
    case 'remove_from_queue':
      store.removeFromQueue(id);
      return { ok: true };
    case 'clear_queue':
      store.clearQueue();
      return { ok: true };
    case 'move_queue': {
      const direction = String(p.direction ?? '');
      if (direction !== 'up' && direction !== 'down') {
        return { error: "direction must be 'up' or 'down'." };
      }
      store.moveQueueItem(id, direction);
      return { ok: true };
    }
    case 'clear_failed':
      store.clearFailedDownloads();
      return { ok: true };
    case 'rename':
      store.renameDownload(id, String(p.newName ?? ''));
      return { ok: true };
    case 'delete':
      store.deleteDownload(id);
      return { ok: true };
    case 'retry': {
      const d = findById(id);
      if (!d) return { error: 'Download not found.' };
      await store.retryDownload({
        id: d.id,
        videoUrl: d.videoUrl,
        name: d.name,
        downloadName: d.name,
        location: d.location,
        ext: d.ext,
        // caption/thumbnail paths are optional in practice; pass empty defaults
        captionLocation: '',
        thumbnailLocation: '',
      } as never);
      return { ok: true };
    }
    case 'add_tag':
      store.addTag(id, String(p.tag ?? ''));
      return { ok: true };
    case 'remove_tag':
      store.removeTag(id, String(p.tag ?? ''));
      return { ok: true };
    case 'rename_tag':
      store.renameTag(String(p.oldName ?? ''), String(p.newName ?? ''));
      return { ok: true };
    case 'delete_tag':
      store.deleteTag(String(p.tag ?? ''));
      return { ok: true };
    case 'add_category':
      store.addCategory(id, String(p.category ?? ''));
      return { ok: true };
    case 'remove_category':
      store.removeCategory(id, String(p.category ?? ''));
      return { ok: true };
    case 'rename_category':
      store.renameCategory(String(p.oldName ?? ''), String(p.newName ?? ''));
      return { ok: true };
    case 'delete_category':
      store.deleteCategory(String(p.category ?? ''));
      return { ok: true };
    case 'add_favorite': {
      const d = findById(id);
      if (!d) return { error: 'Download not found.' };
      store.setFavorited(id, true);
      return { ok: true };
    }
    case 'remove_favorite':
      store.setFavorited(id, false);
      return { ok: true };
    case 'open_file': {
      const d = findById(id);
      if (!d) return { error: 'Download not found.' };
      const full = d.location.endsWith(d.name)
        ? d.location
        : `${d.location}/${d.name}.${d.ext}`;
      window.downlodrFunctions?.openVideo?.(full);
      return { ok: true };
    }
    case 'open_folder': {
      const d = findById(id);
      if (!d) return { error: 'Download not found.' };
      await window.downlodrFunctions?.openFolder?.(d.location, null);
      return { ok: true };
    }
    default:
      return { error: `Unknown command action: ${action}` };
  }
}

let _registered = false;

export function registerDownloadChatBridge(): void {
  if (_registered) return;
  const bridge = (
    window as unknown as {
      downloadQueryBridge?: {
        onQuery: (h: (p: unknown) => Promise<unknown> | unknown) => void;
        onCommand: (h: (p: unknown) => Promise<unknown> | unknown) => void;
      };
    }
  ).downloadQueryBridge;
  if (!bridge) return; // preload not present (e.g. chat window) — nothing to wire
  bridge.onQuery(handleQuery);
  bridge.onCommand(handleCommand);
  _registered = true;
}
