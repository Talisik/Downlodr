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

// Cancel one download by its list id — mirrors the UI's stop handler.
// Active (downloading) items: kill the running controller, drop them, and let
// the queue advance. Paused/queued/to-download items: just remove.
//
// Shared by the `stop` and `stop_all` actions so bulk-stop cannot drift from
// single-stop (notably the paused-row rule below).
async function stopOne(id: string): Promise<Record<string, unknown>> {
  const store = useDownloadStore.getState();
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
  // A paused item's process was already killed when it was paused — nothing
  // left to stop, just drop it from the list.
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

// ─── Command handler (mutations) ────────────────────────────────────────────
export async function handleDownloadCommand(
  payload: unknown,
): Promise<unknown> {
  const p = (payload ?? {}) as Record<string, unknown>;
  const action = String(p.action ?? '');
  const store = useDownloadStore.getState();
  const id = p.id ? String(p.id) : '';

  switch (action) {
    case 'queue_download': {
      // Route a chat-initiated download through the SAME store action the UI
      // uses when a user pastes a URL (setDownload) — so it shows up with
      // title/thumbnail, persists, and is manageable (retry/delete/tag) exactly
      // like a URL the user pasted themselves.
      //
      // That means it lands in the *to download* list, NOT in progress:
      // setDownload only fetches metadata and parks the row at status
      // 'to download' unless it is given autoDownload + autoQueueFormatId
      // (the taskbar's one-click path). Nothing here starts yt-dlp. Say so in
      // the result — the chat used to report "download started", and users went
      // looking for progress that was never going to appear.
      const url = String(p.url ?? '');
      if (!url) return { error: 'url required' };
      const location = String(p.location ?? '');
      if (!location) return { error: 'location required' };
      const limitRate = String(p.limitRate ?? '');
      // Fire-and-forget: setDownload creates the store record synchronously,
      // then fetches metadata in the background. We must NOT await it — the
      // bridge command round-trip has an ~8s timeout, and metadata fetch
      // routinely exceeds that, which would (a) time the command out and
      // (b) trigger a DUPLICATE standalone download via the bridge's fallback.
      void store
        .setDownload(url, location, limitRate, {
          getTranscript: false,
          getThumbnail: false,
        })
        .catch((e) => console.error('[chat-bridge] setDownload failed:', e));
      return {
        ok: true,
        queued: true,
        message:
          'Added to the to-download list in Downlodr. It is NOT downloading yet — ' +
          "the user starts it from the app (or from the row's download button) " +
          'once the format is set. Tell the user it is queued, not started.',
      };
    }
    case 'download_video':
    case 'download_videos': {
      // The counterpart to 'queue_download': these actually run yt-dlp.
      // setDownload fetches metadata, resolves the requested quality against
      // the formats the video really has, then queues the row — addQueue
      // starts the worker, so the download begins without anyone touching the
      // app.
      //
      // One case for both: a single download is a one-item batch, and letting
      // them share this body is what stops the two drifting apart on extras or
      // on quality resolution.
      const items =
        action === 'download_videos'
          ? (Array.isArray(p.items) ? p.items : []).map((raw) => {
              const item = (raw ?? {}) as Record<string, unknown>;
              return {
                url: String(item.url ?? ''),
                location: String(item.location ?? ''),
              };
            })
          : [{ url: String(p.url ?? ''), location: String(p.location ?? '') }];

      if (items.length === 0) return { error: 'items required' };
      if (action === 'download_video') {
        if (!items[0].url) return { error: 'url required' };
        if (!items[0].location) return { error: 'location required' };
      }

      const limitRate = String(p.limitRate ?? '');
      const quality = p.quality ? String(p.quality) : undefined;
      // Off unless asked for — the extras cost extra requests and extra files,
      // and the confirmation card is where the user says yes to them.
      const getThumbnail = p.getThumbnail === true;
      const getTranscript = p.getTranscript === true;

      let started = 0;
      for (const item of items) {
        if (!item.url || !item.location) continue;
        // Fire-and-forget, per item: the bridge command round-trip times out at
        // ~8s and the metadata fetch routinely runs longer. Awaiting here would
        // time the command out AND trigger the bridge's standalone fallback,
        // downloading every video twice.
        void store
          .setDownload(item.url, item.location, limitRate, {
            getTranscript,
            getThumbnail,
            autoStart: true,
            autoQuality: quality,
          })
          .catch((e) =>
            console.error('[chat-bridge] download failed:', item.url, e),
          );
        started++;
      }

      return {
        ok: true,
        started,
        message:
          `Downloading ${started} video${started === 1 ? '' : 's'} now in Downlodr. ` +
          'Each fetches metadata first, then starts automatically and appears in ' +
          'the downloads list with live progress. Use list_downloads to check on them. ' +
          'A video that fails shows up as a failed row — it does not stop the others.',
      };
    }
    case 'stop':
      return stopOne(id);

    // ── pause / resume ──────────────────────────────────────────────────────
    // Explicit, never toggles: a repeated pause must not restart a download.
    // The store actions own the state rules and the error wording.
    case 'pause': {
      if (!id) return { error: 'id required.' };
      return store.pauseDownloadById(id);
    }
    case 'resume': {
      if (!id) return { error: 'id required.' };
      return store.resumeDownloadById(id);
    }
    case 'pause_all':
      return store.pauseAllDownloads();
    case 'resume_all':
      return store.resumeAllDownloads();
    case 'stop_all': {
      // Snapshot ids first — stopOne mutates the very lists we are reading.
      const s = useDownloadStore.getState() as unknown as Record<
        string,
        Record<string, unknown>[]
      >;
      const ids = [
        ...(s.downloading ?? []).map((d) => String(d.id)),
        ...(s.queuedDownloads ?? []).map((d) => String(d.id)),
      ];
      let count = 0;
      for (const each of ids) {
        const result = await stopOne(each);
        if ('ok' in result) count++;
      }
      return {
        ok: true,
        count,
        message: `Stopped ${count} download(s).`,
      };
    }
    case 'start_queued': {
      if (!id) return { error: 'id required.' };
      const limitRate = p.limitRate ? String(p.limitRate) : '';
      return store.startForDownload(id, limitRate);
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
  bridge.onCommand(handleDownloadCommand);
  _registered = true;
}
