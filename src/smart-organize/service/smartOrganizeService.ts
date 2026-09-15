import { app } from 'electron';
import path from 'path';
import { pathToFileURL } from 'url';
import type { SmartOrganizeDownloadInput, SmartOrganizeHandlerResult, SmartOrganizeProgress, SmartOrganizeStage } from '../schema/smartOrganizeTypes.js';
import { toVideoInputs } from './videoTransformer.js';

// ─── Internal → UI message mapping ───────────────────────────────────────────

/**
 * Translate raw pipeline stage strings (from organizer.ts log() calls)
 * into human-readable SmartOrganizeProgress events for the modal.
 */
/**
 * @xenova/transformers ships as an ES Module, so it can't be loaded with
 * require() from this CJS main-process bundle. require.resolve() only
 * resolves the path (no code execution), which we then load via a runtime
 * dynamic import() — safe for ESM and doesn't trigger Rollup's static
 * import analysis since the specifier is a computed file:// URL, not a
 * literal.
 */
async function loadTransformersEnv(nodeModulesDir: string) {
  const entry = require.resolve('@xenova/transformers', { paths: [nodeModulesDir] });
  const mod = await import(/* @vite-ignore */ pathToFileURL(entry).href);
  return mod.env;
}

function toProgress(
  raw: string,
  current?: number,
  total?: number,
): SmartOrganizeProgress {
  const r = raw.toLowerCase();

  if (r.includes('extracting representative') || r.includes('analyzing:')) {
    const title = raw.includes('Analyzing:')
      ? raw.replace('[SmartOrganize] Analyzing:', '').trim()
      : undefined;
    return {
      stage: 'analyzing',
      message: title ? `Analyzing: ${title}` : 'Analyzing videos...',
      current,
      total,
    };
  }
  if (r.includes('cross-video chunk clustering')) {
    return { stage: 'clustering', message: 'Finding topic patterns across your videos...' };
  }
  if (r.includes('extracting category tags')) {
    return { stage: 'tagging', message: 'Generating category names...' };
  }
  if (r.includes('validating tags')) {
    return { stage: 'validating', message: 'Matching videos to categories...' };
  }
  if (r.includes('merging similar')) {
    return { stage: 'merging', message: 'Refining and merging categories...' };
  }
  if (
    r.includes('cross-assigning') ||
    r.includes('subset semantic') ||
    r.includes('series') ||
    r.includes('uncategorized') ||
    r.includes('deduplicating')
  ) {
    return { stage: 'finalizing', message: 'Finalizing categories...' };
  }

  // Model load messages from embeddings.ts
  if (r.includes('model loaded')) {
    return { stage: 'initializing', message: 'AI model ready' };
  }
  if (r.includes('loading model')) {
    return { stage: 'initializing', message: 'Loading AI model...' };
  }

  // Fallback — pass through without crashing
  return { stage: 'finalizing', message: 'Processing...' };
}

// ─── Service ──────────────────────────────────────────────────────────────────

/** Tracks whether a job is currently running to prevent concurrent runs. */
let _running = false;

/**
 * Run the Smart Organize pipeline.
 *
 * - Sets env.localModelPath before the first pipeline() call so the
 *   ONNX model is cached in the user's app data folder, not ~/.cache.
 * - Dynamically imports the organizer on first call (lazy load).
 * - Translates pipeline progress into SmartOrganizeProgress events via onProgress.
 * - Returns SmartOrganizeHandlerResult — always resolves, never rejects.
 */
export async function runSmartOrganize(
  downloads: SmartOrganizeDownloadInput[],
  signal: AbortSignal,
  onProgress: (progress: SmartOrganizeProgress) => void,
  addonPath?: string,
): Promise<SmartOrganizeHandlerResult> {
  if (_running) {
    return { ok: false, reason: 'error', message: 'A Smart Organize job is already running.' };
  }

  _running = true;

  try {
    // Emit initializing stage immediately so the modal transitions out of idle
    onProgress({ stage: 'initializing', message: 'Loading AI model...' });

    // Resolve the model path and the pipeline module from the same location:
    // the downloaded add-on's own folder when addonPath is set (production,
    // pack ready), or the Vite-bundled dev copy otherwise (dev only — this
    // handler is never registered in a packaged build without addonPath, see
    // registerHandlers.ts).
    let setModelProgressReporter: (cb: (msg: string) => void) => void;
    let smartOrganize: typeof import('../backend/smart-organize-backend__hidden/index.js').smartOrganize;

    if (addonPath) {
      const env = await loadTransformersEnv(path.join(addonPath, 'node_modules'));
      env.localModelPath = path.join(addonPath, 'resources', 'models');
      env.allowRemoteModels = false;

      const indexUrl = pathToFileURL(path.join(addonPath, 'dist', 'index.js')).href;
      const mod = await import(/* @vite-ignore */ indexUrl);
      setModelProgressReporter = mod.setModelProgressReporter;
      smartOrganize = mod.smartOrganize;
    } else if (process.env.NODE_ENV !== 'production') {
      const devNodeModules = path.join(
        app.getAppPath(),
        'src',
        'smart-organize',
        'backend',
        'smart-organize-backend__hidden',
        'node_modules',
      );
      const env = await loadTransformersEnv(devNodeModules);
      env.localModelPath = path.join(
        app.getAppPath(),
        'src',
        'smart-organize',
        'backend',
        'smart-organize-backend__hidden',
        'resources',
        'models',
      );
      env.allowRemoteModels = false;

      // Runtime-computed path (not a literal specifier) so Rollup can't
      // statically inline this module into main.js's eager load graph —
      // a literal relative import() here gets hoisted and evaluated at
      // app startup instead of only when Smart Organize actually runs,
      // crashing on launch if the add-on's own node_modules isn't installed.
      const devIndexUrl = pathToFileURL(
        path.join(
          app.getAppPath(),
          'src',
          'smart-organize',
          'backend',
          'smart-organize-backend__hidden',
          'index.js',
        ),
      ).href;
      const mod = await import(/* @vite-ignore */ devIndexUrl);
      setModelProgressReporter = mod.setModelProgressReporter;
      smartOrganize = mod.smartOrganize;
    } else {
      return {
        ok: false,
        reason: 'error',
        message: 'Smart Organize add-on is not installed.',
      };
    }

    setModelProgressReporter((msg) => onProgress(toProgress(msg)));

    // ── Read + clean transcripts ──────────────────────────────────────────
    onProgress({ stage: 'reading-transcripts', message: 'Reading transcripts...' });
    console.log(
      '[SmartOrganize] Raw downloads received from renderer:',
      downloads.map((d) => ({
        id: d.id,
        name: d.name,
        transcriptLocation: d.transcriptLocation,
      })),
    );
    const videoInputs = toVideoInputs(downloads);
    console.log(
      '[SmartOrganize] Video inputs handed to pipeline:',
      videoInputs.map((v) => ({
        id: v.id,
        title: v.title,
        hasTranscription: !!v.transcription,
        transcriptionLength: v.transcription?.length ?? 0,
        transcriptionPreview: v.transcription?.slice(0, 120) ?? null,
      })),
    );

    if (videoInputs.length === 0) {
      return { ok: false, reason: 'error', message: 'No eligible videos found.' };
    }

    // ── Run the pipeline ──────────────────────────────────────────────────
    const result = await smartOrganize(
      videoInputs,
      {
        includeDescription: false,
        tagValidationThreshold: 0.5,
        tagMergeThreshold: 0.65,
        assignUncategorized: true,
        emitCategoryContexts: true,
        onProgress: (stage, current, total) => {
          if (signal.aborted) return;
          onProgress(toProgress(stage, current, total));
        },
      },
      signal,
    );

    onProgress({ stage: 'done', message: 'Done' });
    return { ok: true, result };

  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);

    if (message === 'cancelled' || signal.aborted) {
      return { ok: false, reason: 'cancelled', message: 'Cancelled' };
    }

    console.error('[SmartOrganize] Pipeline error:', err);
    return { ok: false, reason: 'error', message };

  } finally {
    _running = false;
  }
}

/** Whether a job is currently in progress. */
export function isRunning(): boolean {
  return _running;
}
