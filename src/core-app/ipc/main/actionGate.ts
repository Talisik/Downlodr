/**
 * Action gate — which bridge calls need the user's say-so.
 *
 * Split out of mcpBridgeServer.ts so the route table and the approver registry
 * can be unit-tested without standing up an HTTP server: everything here is
 * either a pure lookup or a small piece of module state. The bridge keeps the
 * request-shaped half (reading the body, timing the wait out, noticing a
 * caller that hung up) in requestApproval().
 */

// ─── Destructive / file-writing action gate ───────────────────────────────────
//
// Every bridge client — the embedded chat's in-process agent, the `downlodr`
// CLI the Claude Code path shells out to, an external MCP client — arrives
// here. That makes this the one place a confirmation can cover all of them:
// gating inside a single chat backend leaves the others wide open.
//
// The gate runs before routing, so a denied request never reaches the service
// layer and cannot leave a half-finished operation behind.
//
// Deny-by-default in the cases that matter: no approver registered, no answer
// in time, or a caller that hangs up all resolve to "not approved".

export type GatedActionKind = 'destructive' | 'file-write' | 'addon-required';

/**
 * A richer prompt for actions where the user isn't really being asked "may
 * I?" so much as "is this right?" — a download is the case that matters:
 * the agent has just picked a title, a folder and a format on the user's
 * behalf, and those are the things worth checking before it commits them.
 *
 * When present, the confirmation card renders these fields as a review panel
 * instead of the bare command line.
 */
export interface ActionReview {
  /** Card heading, e.g. 'Confirm download'. */
  title: string;
  /** Replaces the kind's default risk chip. */
  chip?: string;
  /** Replaces the default 'Yes, run it' button copy. */
  approveLabel?: string;
  /** Label/value rows, in display order. Empty values are dropped. */
  fields: Array<{ label: string; value: string }>;
  /**
   * The videos in a batch, rendered as a numbered list the user can remove
   * rows from. Absent for a single-item action — one video is already named
   * in `fields`, and a one-row list with a remove button is just clutter.
   */
  items?: Array<{ label: string; url: string }>;
  /**
   * Batch-level choices the card collects rather than merely displays. The
   * answers come back as an approval patch; `key` is the request-body field
   * each one sets, and only the allowlisted keys are honoured.
   */
  toggles?: Array<{
    key: 'getThumbnail' | 'getTranscript';
    label: string;
    default: boolean;
  }>;
}

export interface GatedAction {
  /** Command name as the docs and the CLI spell it. */
  command: string;
  kind: GatedActionKind;
  /** Compact description of the target, e.g. the id being deleted. */
  detail?: string;
  /** Structured details to show instead of just the command name. */
  review?: ActionReview;
  /**
   * Set only for kind 'addon-required': the pack the user is being offered.
   * The approver needs it to start the right download.
   */
  pack?: string;
  /**
   * Id for this one question, minted by the bridge's requestApproval.
   *
   * The approver must show its card under this id: if the wait later detaches,
   * the same id is both the registry key for the parked request and the token
   * the card sends back to run it. Absent when the question did not come
   * through the bridge (the legacy in-chat skill runner asks directly).
   */
  requestId?: string;
}

/**
 * What the user answered.
 *
 * `patch` exists because some cards ask more than "may I?". A download card
 * collects the batch's thumbnail/transcript choices and any rows the user
 * removed, and those answers have to reach the request itself — the gate
 * applies them to the body before routing. Absent for every card that only
 * asks permission, which is all of them except downloads.
 */
export interface ApprovalAnswer {
  approved: boolean;
  patch?: Record<string, unknown>;
}

/**
 * Asks the user to approve one action. Resolves an ApprovalAnswer; `approved`
 * allows it. Registered by whoever owns a UI that can ask (chatHandler); left
 * unset in headless mode, where there is nobody to ask.
 *
 * `signal` aborts when the answer stops mattering — the wait timed out, or the
 * caller hung up. Approvers must listen to it and tear down their prompt:
 * otherwise a stale prompt keeps owning the "one outstanding question" slot
 * and blocks every later confirmation.
 */
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

/**
 * Headless and other no-UI hosts call this to state, explicitly, that they
 * accept every gated action. Kept separate from registerActionApprover so
 * "nobody wired an approver" and "this host approves everything" can never be
 * confused for one another.
 */
export function approveAllGatedActions(): void {
  // No patch: headless has no card, so nothing was edited and the extras stay
  // at whatever the caller asked for.
  _actionApprover = async () => ({ approved: true });
}

/**
 * Ground truth for "did an add-on download actually start" — used by the
 * bridge's addon-required 403 to pick its copy, instead of trusting the
 * approver's own true/false. For kind 'addon-required', "approved" means
 * only "the user asked to download"; chatHandler's approver starts the real
 * download as a side effect of answering true, but headless's
 * approveAllGatedActions() is a blanket `async () => true` shared by every
 * gated kind — wired so destructive/file-write actions run with nobody there
 * to ask, not so an add-on download gets kicked off too. Trusting its `true`
 * here would report a download in flight that was never started.
 *
 * The real answer lives in addonManager.isAddonDownloading, which imports
 * `electron` and so can't be called from mcpBridgeServer (also used
 * headless). chatHandler registers it here when it wires the approver;
 * nobody registers anything in headless, and the unregistered default
 * (false) is exactly right there, since nothing in that process can ever
 * start a pack download.
 */
let _isAddonDownloading: ((pack: string) => boolean) | null = null;

export function registerAddonDownloadChecker(
  fn: ((pack: string) => boolean) | null,
): void {
  _isAddonDownloading = fn;
}

export function currentAddonDownloadChecker(): ((pack: string) => boolean) | null {
  return _isAddonDownloading;
}

// How long to hold the call open waiting for the user.
//
// This is no longer how long the user gets: running out of it detaches the card
// rather than killing it (see detachedApproval.ts), so the card stays answerable
// for as long as the app is open and the only thing the clock decides is when
// the agent stops waiting. That makes a long wait pure cost — the chat sat there
// looking hung — so it is deliberately short now. It still has to stay inside
// the 300s MCP tool-call timeout and Node's 300s default server.requestTimeout,
// which cap how long the gate can hold a request open at all.
export const APPROVAL_TIMEOUT_MS = 45_000;

// POST /downloads/command multiplexes the whole core-download surface behind
// an `action` field, so this route is gated on the action rather than the path.
// Anything absent from this map (add_tag, add_favorite, move_queue, open_file,
// open_folder) is additive or read-only and runs unprompted.
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
  /** Builds the review panel for this route, when a bare command won't do. */
  review?: (body: Record<string, unknown>) => ActionReview;
}

// POST-only: nothing here mutates on GET.
export const GATED_ROUTES: GatedRoute[] = [
  // Core downloads
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
  // Skedulosa
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
  // AFDA
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

// Named deletes, so the prompt can say "delete_subscription" rather than
// echoing a URL. The catch-all below still gates any /delete route that isn't
// listed here — a new delete endpoint is gated the day it is added, and the
// worst case is a prompt that names the path instead of the command.
export const DELETE_ROUTE_NAMES: Array<[RegExp, string]> = [
  [/^\/subscriptions\/channels\/[^/]+\/delete$/, 'delete_subscription'],
  [/^\/subscriptions\/schedules\/[^/]+\/delete$/, 'delete_schedule'],
  [/^\/subscriptions\/download-tasks\/[^/]+\/delete$/, 'delete_download_task'],
  [/^\/afda\/websites\/[^/]+\/delete$/, 'delete_website'],
  [/^\/afda\/manual-articles\/[^/]+\/delete$/, 'delete_manual_article'],
  [/^\/afda\/social\/sources\/[^/]+\/delete$/, 'delete_social_source'],
];

// Short, readable rendering of the request target for the prompt: an id or a
// name if the body carries one, otherwise nothing. Never dumps a whole body —
// the user is reading this in a chat bubble.
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

/** Split a full output path into its folder and filename halves. */
function splitPath(full: string): { folder: string; filename: string } {
  const slash = Math.max(full.lastIndexOf('/'), full.lastIndexOf('\\'));
  return slash >= 0
    ? { folder: full.slice(0, slash), filename: full.slice(slash + 1) }
    : { folder: '', filename: full };
}

/**
 * Most videos one confirmation card may cover.
 *
 * Enforced here rather than only in the agent's prompt: a doc is guidance, and
 * an agent that ignores it would otherwise raise a card listing thirty videos
 * that no user can meaningfully check. Longer runs are chunked by the agent
 * into sequential cards.
 */
export const MAX_BATCH_ITEMS = 6;

/** One video in a download request. */
export interface DownloadItem {
  url: string;
  outputFilepath: string;
}

/**
 * Read either body shape as a list of videos.
 *
 * `/downloads/download-now` accepts a batch (`items[]`) and the original
 * single body (`url` + `outputFilepath`). Normalizing at the edge means the
 * review builder, the patch validator and the route handler all reason about
 * exactly one shape, instead of each re-deriving "is this a batch?".
 *
 * `items` wins over a stray top-level `url`: a caller that sends both meant
 * the list.
 *
 * Duplicate urls collapse to the first occurrence. Url is the identity the
 * card's rows, the patch validator and React's list keys all use, so a
 * repeated link would otherwise render two rows that remove together and
 * produce a patch that fails its own subset check. Deduping at the single
 * normalization point every consumer shares fixes all three at once.
 */
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

/**
 * Fields a confirmation card is allowed to change.
 *
 * This is the security boundary of the whole answering-card design. Until
 * now the gate could only allow or refuse a request; it can now rewrite one,
 * and the renderer is what tells it how. So the rewrite is bounded to the
 * three fields the card actually collects.
 *
 * `outputFilepath`, `url` and `quality` are deliberately absent: they are
 * agent-chosen and user-*reviewed*, never user-edited. A patchable
 * outputFilepath would let a bug — or a compromised renderer — redirect an
 * approved write anywhere on disk, which is the exact class of thing this
 * gate exists to prevent.
 */
const PATCHABLE_KEYS = new Set(['getThumbnail', 'getTranscript', 'items']);

/**
 * Merge a card's answers into the request body, in place. Returns the keys it
 * refused, for the caller to log — a rejected key is a bug or an attack, and
 * either way silence is the wrong response.
 *
 * `body` is the object `parseBody` cached for this request, so mutating it
 * here is what makes the answers visible to the route handler further down.
 */
export function applyApprovalPatch(
  body: Record<string, unknown>,
  patch: Record<string, unknown> | undefined,
): string[] {
  const rejected: string[] = [];
  if (!patch) return rejected;

  // Snapshot before any mutation: the items check validates against what the
  // agent proposed, not against a half-applied patch.
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

    // key === 'items': a subset, by url, of what was proposed. Removing rows
    // is the supported edit; adding or altering one is not, and a patch that
    // tries is dropped whole rather than partially honoured.
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
    // Rebuild from the proposed entries, so the outputFilepath the agent chose
    // is the one that survives — never one the patch supplied.
    body.items = proposed.filter((i) => keep.has(i.url));
  }

  return rejected;
}

/**
 * The download review. Everything here was chosen by the agent, not the user:
 * the filename came from the video's title, the folder from
 * get_download_folder, the format from whatever quality it inferred. Showing
 * all four is the point — it is the user's one chance to catch a wrong pick
 * before it is queued.
 */
export function reviewForDownloadQueue(
  body: Record<string, unknown>,
): ActionReview {
  const { folder, filename } = splitPath(String(body.outputFilepath ?? ''));
  return {
    title: 'Confirm download',
    // queue_download only queues — the file is written later, once the user
    // starts the row in the app. The chip must not promise otherwise.
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

/**
 * The download-now review, for one video or for a batch.
 *
 * Same promise as before for a single video: the filename, folder and quality
 * were all chosen by the agent, and this card is the user's one chance to
 * catch a wrong pick. A batch trades the filename for a count plus a
 * removable list — six repetitions of the same folder tell the user nothing,
 * while six titles tell them whether the right six links were picked up.
 *
 * The chip must keep saying this one writes immediately; `reviewForDownloadQueue`
 * is the one that only adds to a list.
 */
export function reviewForDownloadNow(
  body: Record<string, unknown>,
): ActionReview {
  const items = normalizeDownloadItems(body);
  const multi = items.length > 1;
  const first = items[0] ?? { url: '', outputFilepath: '' };
  const { folder, filename } = splitPath(first.outputFilepath);

  // Only label the chunk when there is more than one — "(1 of 1)" invites the
  // user to wait for a second card that is never coming.
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
            // Before metadata lands the filename can be empty; the URL is a
            // worse label than a title but a far better one than a blank row.
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

/**
 * Does this request need confirming? Pure: the caller supplies the already
 * parsed body, so this is the piece the tests drive directly.
 *
 * Returns null for anything that runs unprompted — every GET, and the POSTs
 * that only add or read.
 */
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
