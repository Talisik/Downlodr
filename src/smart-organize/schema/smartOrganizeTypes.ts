// ─── IPC Channel Names ────────────────────────────────────────────────────────

export const SO_CHANNELS = {
  START:    'smart-organize:start',
  CANCEL:   'smart-organize:cancel',
  PROGRESS: 'smart-organize:progress',
} as const;

// ─── IPC Input ────────────────────────────────────────────────────────────────

/**
 * Minimal slice of BaseDownload sent from renderer to main.
 * Only downloads with a transcriptLocation are eligible.
 */
export interface SmartOrganizeDownloadInput {
  id: string;
  name: string;             // video title → VideoInput.title
  transcriptLocation: string; // absolute path to SRT/VTT/txt file on disk
}

// ─── Progress ─────────────────────────────────────────────────────────────────

export type SmartOrganizeStage =
  | 'initializing'        // model loading / first-run ~45MB download
  | 'reading-transcripts' // reading + cleaning SRT files from disk
  | 'analyzing'           // per-video embedding (has current + total)
  | 'clustering'          // cross-video chunk clustering
  | 'tagging'             // category name generation
  | 'validating'          // tag validation per video
  | 'merging'             // merging similar categories
  | 'finalizing'          // series detection, dedup, subset removal
  | 'done';

/** Pushed from main → renderer via ipcRenderer.on during a running job. */
export interface SmartOrganizeProgress {
  stage: SmartOrganizeStage;
  message: string;   // human-readable string shown in the modal
  current?: number;  // only present during 'analyzing' stage
  total?: number;
}

// ─── Result ───────────────────────────────────────────────────────────────────

export interface SmartOrganizeCluster {
  cluster_id: string;
  video_ids: string[];     // download store IDs (BaseDownload.id)
  video_titles: string[];
  chunk_count: number;
  category_tag: string;
}

export interface SmartOrganizeResult {
  clusters: SmartOrganizeCluster[];
  metadata: {
    cluster_count: number;
    video_count: number;
    total_chunks: number;
    videos_processed: number;
  };
  category_contexts?: Record<string, string>;
}

/**
 * Shape returned by ipcMain.handle for SO_CHANNELS.START.
 * Always resolves — never rejects to the renderer.
 */
export type SmartOrganizeHandlerResult =
  | { ok: true; result: SmartOrganizeResult }
  | { ok: false; reason: 'cancelled' | 'error'; message: string };
