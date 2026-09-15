export type GatedActionKind = 'destructive' | 'file-write' | 'addon-required';

export interface ActionReview {
  title: string;
  chip?: string;
  approveLabel?: string;
  fields: Array<{ label: string; value: string }>;
  items?: Array<{ label: string; url: string }>;
  toggles?: Array<{
    key: 'getThumbnail' | 'getTranscript';
    label: string;
    default: boolean;
  }>;
}

export interface GatedAction {
  command: string;
  kind: GatedActionKind;
  detail?: string;
  review?: ActionReview;
  pack?: string;
  requestId?: string;
}

export interface ApprovalAnswer {
  approved: boolean;
  patch?: Record<string, unknown>;
}

export type ActionApprover = (
  action: GatedAction,
  signal: AbortSignal,
) => Promise<ApprovalAnswer>;

let _actionApprover: ActionApprover | null = null;

export function currentActionApprover(): ActionApprover | null {
  return _actionApprover;
}

export function registerActionApprover(fn: ActionApprover | null): void {
  _actionApprover = fn;
}

export function approveAllGatedActions(): void {
  _actionApprover = async () => ({ approved: true });
}

let _isAddonDownloading: ((pack: string) => boolean) | null = null;

export function registerAddonDownloadChecker(
  fn: ((pack: string) => boolean) | null,
): void {
  _isAddonDownloading = fn;
}

export function currentAddonDownloadChecker(): ((pack: string) => boolean) | null {
  return _isAddonDownloading;
}

export const APPROVAL_TIMEOUT_MS = 45_000;

export const GATED_DOWNLOAD_ACTIONS: Record<string, [string, GatedActionKind]> =
  {
    clear_failed: ['clear_failed_downloads', 'destructive'],
    clear_queue: ['clear_queue', 'destructive'],
    delete: ['delete_download', 'destructive'],
    delete_category: ['delete_download_category', 'destructive'],
    delete_tag: ['delete_download_tag', 'destructive'],
    remove_category: ['remove_download_category', 'destructive'],
    remove_favorite: ['remove_download_favorite', 'destructive'],
    remove_from_queue: ['remove_from_queue', 'destructive'],
    remove_tag: ['remove_download_tag', 'destructive'],
    rename: ['rename_download', 'destructive'],
    rename_category: ['rename_download_category', 'destructive'],
    rename_tag: ['rename_download_tag', 'destructive'],
    resume_all: ['resume_all_downloads', 'file-write'],
    retry: ['retry_download', 'file-write'],
    start_queued: ['start_queued_download', 'file-write'],
    stop: ['stop_download', 'destructive'],
    stop_all: ['stop_all_downloads', 'destructive'],
  };

export interface GatedRoute {
  pattern: RegExp;
  command: string;
  kind: GatedActionKind;
  review?: (body: Record<string, unknown>) => ActionReview;
}

export const GATED_ROUTES: GatedRoute[] = [
  {
    pattern: /^\/downloads\/queue$/,
    command: 'queue_download',
    kind: 'file-write',
    review: reviewForDownloadQueue,
  },
  {
    pattern: /^\/downloads\/download-now$/,
    command: 'download_video',
    kind: 'file-write',
    review: reviewForDownloadNow,
  },
  {
    pattern: /^\/downloads\/stop$/,
    command: 'stop_download_controller',
    kind: 'destructive',
  },
  {
    pattern: /^\/subscriptions\/scraper\/stop$/,
    command: 'stop_scraper',
    kind: 'destructive',
  },
  {
    pattern: /^\/subscriptions\/download-worker\/start$/,
    command: 'start_download_worker',
    kind: 'file-write',
  },
  {
    pattern: /^\/subscriptions\/download-worker\/stop$/,
    command: 'stop_download_worker',
    kind: 'destructive',
  },
  {
    pattern: /^\/subscriptions\/download-tasks\/clear-pending$/,
    command: 'clear_pending_download_tasks',
    kind: 'destructive',
  },
  {
    pattern: /^\/subscriptions\/channels\/[^/]+\/slots\/replace$/,
    command: 'replace_channel_slots',
    kind: 'destructive',
  },
  {
    pattern: /^\/afda\/articles\/export$/,
    command: 'export_articles',
    kind: 'file-write',
  },
  {
    pattern: /^\/afda\/auth\/clear$/,
    command: 'clear_website_auth',
    kind: 'destructive',
  },
  {
    pattern: /^\/afda\/mapper\/batch\/cancel$/,
    command: 'cancel_mapper_batch',
    kind: 'destructive',
  },
  {
    pattern: /^\/afda\/sections\/delete$/,
    command: 'delete_sections',
    kind: 'destructive',
  },
  {
    pattern: /^\/afda\/websites\/reset-initial-scrape$/,
    command: 'reset_initial_scrape',
    kind: 'destructive',
  },
];

export const DELETE_ROUTE_NAMES: Array<[RegExp, string]> = [
  [/^\/subscriptions\/channels\/[^/]+\/delete$/, 'delete_subscription'],
  [/^\/subscriptions\/schedules\/[^/]+\/delete$/, 'delete_schedule'],
  [/^\/subscriptions\/download-tasks\/[^/]+\/delete$/, 'delete_download_task'],
  [/^\/afda\/websites\/[^/]+\/delete$/, 'delete_website'],
  [/^\/afda\/manual-articles\/[^/]+\/delete$/, 'delete_manual_article'],
  [/^\/afda\/social\/sources\/[^/]+\/delete$/, 'delete_social_source'],
];

export function describeTarget(
  body: Record<string, unknown>,
): string | undefined {
  const keys = [
    'id',
    'name',
    'newName',
    'channelId',
    'websiteId',
    'taskId',
    'scheduleId',
    'url',
  ];
  const parts = keys
    .filter((k) => body[k] !== undefined && body[k] !== null && body[k] !== '')
    .map((k) => `${k}=${String(body[k]).slice(0, 80)}`);
  return parts.length ? parts.join(' ') : undefined;
}

function splitPath(full: string): { folder: string; filename: string } {
  const slash = Math.max(full.lastIndexOf('/'), full.lastIndexOf('\\'));
  return slash >= 0
    ? { folder: full.slice(0, slash), filename: full.slice(slash + 1) }
    : { folder: '', filename: full };
}

export const MAX_BATCH_ITEMS = 6;

export interface DownloadItem {
  url: string;
  outputFilepath: string;
}

export function normalizeDownloadItems(
  body: Record<string, unknown>,
): DownloadItem[] {
  const list = Array.isArray(body.items)
    ? body.items
        .filter(
          (i): i is Record<string, unknown> => !!i && typeof i === 'object',
        )
        .map((i) => ({
          url: String(i.url ?? ''),
          outputFilepath: String(i.outputFilepath ?? ''),
        }))
        .filter((i) => i.url !== '')
    : (() => {
        const url = String(body.url ?? '');
        return url ? [{ url, outputFilepath: String(body.outputFilepath ?? '') }] : [];
      })();

  const seen = new Set<string>();
  return list.filter((i) => !seen.has(i.url) && seen.add(i.url));
}

const PATCHABLE_KEYS = new Set(['getThumbnail', 'getTranscript', 'items']);

export function applyApprovalPatch(
  body: Record<string, unknown>,
  patch: Record<string, unknown> | undefined,
): string[] {
  const rejected: string[] = [];
  if (!patch) return rejected;

  const proposed = normalizeDownloadItems(body);

  for (const [key, value] of Object.entries(patch)) {
    if (!PATCHABLE_KEYS.has(key)) {
      rejected.push(key);
      continue;
    }

    if (key === 'getThumbnail' || key === 'getTranscript') {
      if (typeof value === 'boolean') body[key] = value;
      else rejected.push(key);
      continue;
    }

    const next = Array.isArray(value) ? value : null;
    if (!next || next.length === 0) {
      rejected.push(key);
      continue;
    }
    const keep = new Set(
      next
        .filter((i): i is Record<string, unknown> => !!i && typeof i === 'object')
        .map((i) => String(i.url ?? '')),
    );
    const allowed = new Set(proposed.map((i) => i.url));
    if (keep.size !== next.length || [...keep].some((u) => !allowed.has(u))) {
      rejected.push(key);
      continue;
    }
    body.items = proposed.filter((i) => keep.has(i.url));
  }

  return rejected;
}

export function reviewForDownloadQueue(
  body: Record<string, unknown>,
): ActionReview {
  const { folder, filename } = splitPath(String(body.outputFilepath ?? ''));
  return {
    title: 'Confirm download',
    chip: 'Adds to your list',
    approveLabel: 'Yes, add it',
    fields: [
      { label: 'Video', value: filename },
      { label: 'Save to', value: folder },
      { label: 'Format', value: String(body.videoFormat ?? '') },
      { label: 'Source', value: String(body.url ?? '') },
    ].filter((f) => f.value),
  };
}

export function reviewForDownloadNow(
  body: Record<string, unknown>,
): ActionReview {
  const items = normalizeDownloadItems(body);
  const multi = items.length > 1;
  const first = items[0] ?? { url: '', outputFilepath: '' };
  const { folder, filename } = splitPath(first.outputFilepath);

  const chunk = body.chunk as { index?: unknown; total?: unknown } | undefined;
  const total = Number(chunk?.total ?? 0);
  const index = Number(chunk?.index ?? 0);
  const suffix = total > 1 && index > 0 ? ` (${index} of ${total})` : '';

  const dropped = Number(body.duplicatesRemoved ?? 0);

  const fields = [
    multi
      ? { label: 'Videos', value: `${items.length} videos` }
      : { label: 'Video', value: filename },
    { label: 'Save to', value: folder },
    { label: 'Quality', value: String(body.quality ?? 'Best available') },
    ...(multi ? [] : [{ label: 'Source', value: first.url }]),
    ...(dropped > 0
      ? [
          {
            label: 'Note',
            value: `${dropped} duplicate link${dropped === 1 ? '' : 's'} removed`,
          },
        ]
      : []),
  ].filter((f) => f.value);

  return {
    title: `Confirm download${suffix}`,
    chip: 'Starts downloading now',
    approveLabel: multi ? `Yes, download ${items.length}` : 'Yes, download it',
    fields,
    ...(multi
      ? {
          items: items.map((i) => ({
            label: splitPath(i.outputFilepath).filename || i.url,
            url: i.url,
          })),
        }
      : {}),
    toggles: [
      {
        key: 'getThumbnail',
        label: 'Save thumbnail',
        default: body.getThumbnail === true,
      },
      {
        key: 'getTranscript',
        label: 'Save transcript',
        default: body.getTranscript === true,
      },
    ],
  };
}

export function resolveGatedAction(
  method: string,
  pathname: string,
  body: Record<string, unknown>,
): GatedAction | null {
  if (method !== 'POST') return null;

  if (pathname === '/downloads/command') {
    const entry = GATED_DOWNLOAD_ACTIONS[String(body.action ?? '')];
    if (!entry) return null;
    return { command: entry[0], kind: entry[1], detail: describeTarget(body) };
  }

  const route = GATED_ROUTES.find((r) => r.pattern.test(pathname));
  if (route) {
    return {
      command: route.command,
      kind: route.kind,
      detail: describeTarget(body),
      ...(route.review ? { review: route.review(body) } : {}),
    };
  }

  if (/\/delete$/.test(pathname)) {
    const named = DELETE_ROUTE_NAMES.find(([p]) => p.test(pathname));
    return {
      command: named ? named[1] : `POST ${pathname}`,
      kind: 'destructive',
      detail: describeTarget(body),
    };
  }

  return null;
}
