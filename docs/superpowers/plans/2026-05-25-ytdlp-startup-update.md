# yt-dlp Startup Auto-Update + AboutModal Version Display Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Silently check and update yt-dlp once on app startup, and display the current yt-dlp version in the AboutModal.

**Architecture:** Extract the existing `ytdlp:checkAndUpdate` IPC handler body into an exported `runYtdlpCheckAndUpdate()` function so it can be called directly from the main process at startup (no IPC round-trip). A 5-second deferred call in `registerHandlers.ts` triggers it fire-and-forget after the window paints. The AboutModal fetches the yt-dlp version locally via `getCurrentVersion()` when it opens.

**Tech Stack:** Electron (main process), TypeScript, React, `yt-dlp-helper` npm package, existing `githubHandler.ts` rate-limiting utilities.

---

## File Map

| File | Change |
|---|---|
| `src/core-app/ipc/main/ytdlpHandler.ts` | Extract `runYtdlpCheckAndUpdate()` as exported function; IPC handler delegates to it |
| `src/core-app/ipc/main/registerHandlers.ts` | Import `runYtdlpCheckAndUpdate`; add deferred startup call after `ytdlpHandler` is registered |
| `src/downlodr/components/modal/custom/AboutModal.tsx` | Add `ytdlpVersion` state, fetch via `getCurrentVersion()`, display below app version |

---

## Task 1: Extract `runYtdlpCheckAndUpdate()` in ytdlpHandler.ts

**Files:**
- Modify: `src/core-app/ipc/main/ytdlpHandler.ts`

- [ ] **Step 1: Add the exported function above the IPC handler**

Open `src/core-app/ipc/main/ytdlpHandler.ts`. Find the `// Check and update YT-DLP` comment at line ~150. Directly above it, insert this exported function:

```ts
export async function runYtdlpCheckAndUpdate(): Promise<void> {
  try {
    const currentVersion = await YTDLP.getYTDLPVersion();

    let latestVersion = getCachedVersion();

    if (!latestVersion) {
      if (!canMakeGitHubApiCall()) {
        return;
      }
      markGitHubApiCall();
      const latestResponse = await YTDLP.getLatestYTDLPVersionFromGitHub();
      if (!latestResponse.ok || !latestResponse.version) {
        return;
      }
      latestVersion = latestResponse.version;
      setCachedVersion(latestVersion);
    }

    if (!currentVersion) {
      await YTDLP.downloadYTDLP();
      return;
    }

    if (latestVersion && currentVersion !== latestVersion) {
      await YTDLP.downloadYTDLP({ version: latestVersion, forceDownload: true });
    }
  } catch (error) {
    console.error('[ytdlp startup] check-and-update failed:', error);
  }
}
```

Note: this function returns `void` — it is fire-and-forget. Errors are caught and logged. Rate-limit blocks silently return early.

- [ ] **Step 2: Replace the IPC handler body with a delegation call**

Replace the existing `ipcMain.handle('ytdlp:checkAndUpdate', ...)` block (lines ~151–236) with:

```ts
  ipcMain.handle('ytdlp:checkAndUpdate', async () => {
    try {
      const currentVersion = await YTDLP.getYTDLPVersion();

      let latestVersion = getCachedVersion();

      if (!latestVersion) {
        if (!canMakeGitHubApiCall()) {
          const remainingTime = getGitHubApiCooldownRemainingSeconds();
          return {
            success: false,
            error: `Rate limited. Please wait ${remainingTime} seconds before checking again.`,
            action: 'error',
          };
        }
        markGitHubApiCall();
        const latestResponse = await YTDLP.getLatestYTDLPVersionFromGitHub();
        if (!latestResponse.ok || !latestResponse.version) {
          if (latestResponse.message && latestResponse.message.includes('403')) {
            throw new Error('GitHub API rate limit exceeded. Please wait an hour before trying again.');
          }
          throw new Error(latestResponse.message || 'Failed to get latest version');
        }
        latestVersion = latestResponse.version;
        setCachedVersion(latestVersion);
      }

      if (!currentVersion) {
        await YTDLP.downloadYTDLP();
        return {
          success: true,
          action: 'downloaded',
          message: 'YT-DLP was not found and has been downloaded.',
          currentVersion: null,
          latestVersion,
        };
      }

      if (latestVersion && currentVersion !== latestVersion) {
        await YTDLP.downloadYTDLP({ version: latestVersion, forceDownload: true });
        return {
          success: true,
          action: 'updated',
          message: `YT-DLP updated from ${currentVersion} to ${latestVersion}`,
          currentVersion,
          latestVersion,
        };
      } else {
        return {
          success: true,
          action: 'up-to-date',
          message: 'YT-DLP is already up to date',
          currentVersion,
          latestVersion,
        };
      }
    } catch (error) {
      console.error('Error managing YT-DLP version:', error);
      return {
        success: false,
        error: error.message,
        action: 'error',
        message: `Error managing YT-DLP version: ${error.message}`,
      };
    }
  });
```

The IPC handler keeps its original return shape (needed by any future UI callers). `runYtdlpCheckAndUpdate` is a separate function for the startup path.

- [ ] **Step 3: Verify TypeScript compiles**

```bash
npm run lint
```

Expected: no new errors on `ytdlpHandler.ts`.

- [ ] **Step 4: Commit**

```bash
git add src/core-app/ipc/main/ytdlpHandler.ts
git commit -m "refactor: extract runYtdlpCheckAndUpdate for direct main-process use"
```

---

## Task 2: Add deferred startup trigger in registerHandlers.ts

**Files:**
- Modify: `src/core-app/ipc/main/registerHandlers.ts`

- [ ] **Step 1: Add the import**

At the top of `src/core-app/ipc/main/registerHandlers.ts`, add to the existing `ytdlpHandler` import line:

```ts
import { ytdlpHandler, runYtdlpCheckAndUpdate } from './ytdlpHandler';
```

- [ ] **Step 2: Add the deferred startup call**

In `registerMainIpcHandlers`, after `collect(ytdlpHandler(mainWindow))`, add:

```ts
  setTimeout(() => {
    runYtdlpCheckAndUpdate().catch(() => {});
  }, 5000);
```

The full relevant section will look like:

```ts
  collect(videoHandler(mainWindow));
  collect(ytdlpHandler(mainWindow));

  setTimeout(() => {
    runYtdlpCheckAndUpdate().catch(() => {});
  }, 5000);

  handlersRegistered = true;
```

- [ ] **Step 3: Verify TypeScript compiles**

```bash
npm run lint
```

Expected: no errors on `registerHandlers.ts`.

- [ ] **Step 4: Commit**

```bash
git add src/core-app/ipc/main/registerHandlers.ts
git commit -m "feat: trigger yt-dlp check-and-update silently 5s after app startup"
```

---

## Task 3: Display yt-dlp version in AboutModal

**Files:**
- Modify: `src/downlodr/components/modal/custom/AboutModal.tsx`

- [ ] **Step 1: Add ytdlpVersion state**

In `AboutModal.tsx`, add a second piece of state below the existing `appVersion` state:

```ts
  const [appVersion, setAppVersion] = useState('1.0.0');
  const [ytdlpVersion, setYtdlpVersion] = useState<string | null>(null);
```

- [ ] **Step 2: Fetch yt-dlp version in the existing useEffect**

Inside the existing `getVersion` async function (within `useEffect`), add the yt-dlp fetch after the app version fetch. The full updated `useEffect` block:

```ts
  useEffect(() => {
    const getVersion = async () => {
      if (window.updateAPI) {
        try {
          const currentVersion = await window.updateAPI.getCurrentVersion();
          if (currentVersion) {
            setAppVersion(currentVersion);
          }
        } catch (error) {
          console.error('Error getting version:', error);
        }
      }

      if (window.ytdlp) {
        try {
          const result = await window.ytdlp.getCurrentVersion();
          if (result?.success && result.version) {
            setYtdlpVersion(result.version);
          }
        } catch {
          // silently omit if unavailable
        }
      }
    };

    getVersion();
  }, []);
```

- [ ] **Step 3: Render the yt-dlp version line**

In the JSX, find the existing app version line:

```tsx
            <h1 className="font-bold text-[15px] text-[#BCBCBC]">
              {t('modals.about.version', { version: appVersion })}
            </h1>
```

Add the yt-dlp line directly below it:

```tsx
            <h1 className="font-bold text-[15px] text-[#BCBCBC]">
              {t('modals.about.version', { version: appVersion })}
            </h1>
            {ytdlpVersion && (
              <h1 className="text-[13px] text-[#BCBCBC]">
                yt-dlp {ytdlpVersion}
              </h1>
            )}
```

The `ytdlpVersion &&` guard means the line is completely absent if the fetch failed — no empty text, no fallback string.

- [ ] **Step 4: Verify TypeScript compiles**

```bash
npm run lint
```

Expected: no errors on `AboutModal.tsx`.

- [ ] **Step 5: Commit**

```bash
git add src/downlodr/components/modal/custom/AboutModal.tsx
git commit -m "feat: show yt-dlp version in About modal"
```

---

## Task 4: Manual verification

- [ ] **Step 1: Start the app**

```bash
npm start
```

- [ ] **Step 2: Verify startup update runs**

Watch the terminal output for approximately 5 seconds after the window appears. Expected console output (one of):

```
# If already up to date — no output (silent)
# If updated:
[ytdlp startup] check-and-update failed: ...   ← only on error
```

No output at all on success (the `runYtdlpCheckAndUpdate` function only logs on error).

- [ ] **Step 3: Verify AboutModal shows yt-dlp version**

Open the app → click Help or the about menu → open the About modal. Expected: below the app version line (e.g. "Version 1.2.3"), a second line reading `yt-dlp 2025.xx.xx` (the actual installed version). If yt-dlp is not installed, the line is absent.

- [ ] **Step 4: Verify rate limiting protects against repeated launches**

Close and relaunch the app within 5 minutes. The startup check should silently return early (rate limit not expired). No GitHub API call is made. Verify by checking that the main process console does not show any network activity for the check.
