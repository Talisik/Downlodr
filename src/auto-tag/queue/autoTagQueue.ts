// STUB — see src/auto-tag/README.md.
// Real tagging queue (tier1/tier2 classification, backfill scan) was never
// committed upstream. These are no-ops so the app builds and runs;
// auto-tagging does nothing until the real module is restored.

export function enqueueTier1(_downloadId: string): void {
  // no-op stub
}

export function enqueueTier2(_downloadId: string): void {
  // no-op stub
}

export function enqueueBackfill(): void {
  // no-op stub
}
