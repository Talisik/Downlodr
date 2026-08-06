# auto-tag (STUB)

`src/auto-tag/` was referenced by 7 files merged in from `feat/live-stream`
(commit `4c7df8c`, "refactor: reorganize source into feature modules") but the
actual directory was never committed there — confirmed absent from every
branch on `origin`, git reflog/stash, and every repo in the `Talisik` GitHub
org. It isn't gitignored like the downloadable add-on backends
(`afda-backend__hidden`, `video-nemesis-toolkit__hidden`); it's a plain
oversight in that commit.

The files in this directory are **no-op stubs** that satisfy the type/call
contract every caller expects, so the app builds and runs. Auto-tagging does
nothing — `enqueueTier1`/`enqueueTier2`/`enqueueBackfill` are empty,
`mergeTierResult` passes tags through unchanged, `autoTagHandler` registers no
IPC channels.

Callers, for reference when restoring the real implementation:
- `src/downlodr/store/download/downloadStore.ts` — `enqueueBackfill`, `TagResult`
- `src/downlodr/store/download/actions/lifecycleActions.ts` — `enqueueTier1`, `enqueueTier2`
- `src/downlodr/store/download/actions/miscActions.ts` — `enqueueTier2`
- `src/downlodr/store/download/actions/tagsCategoriesActions.ts` — `mergeTierResult`, `TagResult`, `applyAutoTags`
- `src/core-app/ipc/main/registerHandlers.ts` — `autoTagHandler`
- `src/global.d.ts` declares `window.autoTagBridge.run(...)` (renderer IPC
  bridge), but nothing in the current tree calls it and no preload wiring for
  it exists either — that half of the feature is also missing, not just the
  main-process/store side stubbed here.

Delete this directory and drop in the real implementation once recovered.
