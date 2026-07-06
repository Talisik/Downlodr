# Merge Conflict Resolution: ytdlpHandler.ts

## Context

After the backend pushed `fix: kill orphaned yt-dlp processes on app quit` (commit `51e4d49`),
a local fix based on `docs/ytdlp-orphan-process-fix.md` was applied independently to
`src/core-app/ipc/main/ytdlpHandler.ts`. The two changes overlapped, leaving the file
with duplicate declarations and an unreachable second return block.

## Conflicts Found

### 1. Duplicate `activeControllerIds` declaration (lines 39–41)

Both versions declared the same `Set<string>`. The local version included an explanatory comment;
the backend's was bare.

**Resolution:** Kept the local version's comment, removed the duplicate.

### 2. Duplicate `activeControllerIds.add(controller.id)` call

Both versions added the same `.add()` call at download start, resulting in two consecutive calls.

**Resolution:** Removed the second copy.

### 3. Two `return () => { ... }` cleanup blocks

- **Backend's block** (first): cleaned up both `activeControllerIds` and `activeDirectUrlProcs`, but used silent `catch {}`.
- **Local block** (second): only cleaned up `activeControllerIds`, but had `console.error` logging in the catch.
- The second `return` was also unreachable code, and the duplicate `const` declaration would have caused a TypeScript compile error.

**Resolution:** Merged into a single return block that handles both Sets with `console.error` logging.

## What Each Side Contributed

| Item | Local fix | Backend fix | Kept |
|---|---|---|---|
| `activeControllerIds` comment | Yes | No | Yes |
| `activeDirectUrlProcs` Set | No | Yes | Yes |
| `getDirectUrl` proc tracking | No | Yes | Yes |
| Error logging in cleanup | Yes | No | Yes |
| Both Sets cleaned up on quit | No | Yes | Yes |

## Final Cleanup Function

```ts
return () => {
  for (const id of activeControllerIds) {
    try {
      YTDLP.getTerminalFromID(id)?.kill('SIGKILL');
    } catch (err) {
      console.error(`[ytdlp cleanup] failed to kill controller ${id}:`, err);
    }
  }
  activeControllerIds.clear();

  for (const proc of activeDirectUrlProcs) {
    try {
      proc.kill('SIGKILL');
    } catch (err) {
      console.error('[ytdlp cleanup] failed to kill direct-url proc:', err);
    }
  }
  activeDirectUrlProcs.clear();
};
```
