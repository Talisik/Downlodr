# Mac App Store Distribution — Requirements & Gaps

Current macOS distribution (`.github/workflows/macos-build.yml`, `forge.config.ts`,
`scripts/build-with-create-dmg*.sh`) produces a **Developer ID–signed, notarized
DMG** distributed outside the App Store. This document is a gap analysis for
what Mac App Store (MAS) submission would additionally require, based on the
actual current config — not a generic checklist.

## 1. Account & listing (administrative)

- MAS needs an **Apple Distribution** certificate + a Mac App Store
  provisioning profile — distinct from the `APPLE_IDENTITY`/
  `APPLE_INSTALLER_IDENTITY` (Developer ID) certs already configured for
  direct/notarized distribution.
- An App Store Connect app record: a real reverse-DNS bundle ID. Currently the
  packaged app's bundle ID is `com.electron.downlodr` — electron-packager's
  default, never overridden in `forge.config.ts` (`packagerConfig` has no
  `appBundleId`). Needs to be registered as something like
  `com.talisik.downlodr`.
- 1024×1024 icon, screenshots, description, age rating, privacy nutrition
  labels in App Store Connect.
- A **`PrivacyInfo.xcprivacy`** manifest (Apple requirement since 2024)
  declaring data collection and any "required reason" API usage — none
  exists in this repo.

## 2. App Sandbox — the real blocker

None of the three entitlements files (`entitlements.plist`,
`entitlements-production.plist`, `yt-dlp-entitlements.plist`) set
`com.apple.security.app-sandbox`. MAS **requires** sandboxing; the app is
currently built deliberately non-sandboxed. Turning it on means:

- `com.apple.security.cs.disable-library-validation: true` (currently set in
  all three files, needed today for Electron's native modules like
  `better-sqlite3`) is exactly the kind of entitlement App Review scrutinizes
  hardest under sandbox.
- **Spawning bundled binaries** — `yt-dlp_macos`, `ffmpeg-arm64`/`ffmpeg-x64`
  via `child_process.spawn()` (the core of `src/core-app/ipc/main/ytdlpHandler.ts`)
  — is heavily restricted under App Sandbox. Typically requires each spawned
  binary to be signed under the same team/entitlements, often routed through
  an XPC service rather than a raw `spawn()`. This is an architecture change,
  not a signing tweak.
- The local HTTP servers this app runs — `mcpBridgeServer` on
  `127.0.0.1:7185` (`src/core-app/ipc/main/mcpBridgeServer.ts`) and the
  browser-extension bridge on port `57000` (`src/main.ts`) — need
  `com.apple.security.network.server`, currently explicitly set to `false`
  in every entitlements file.

## 3. Self-updating code — likely a hard rejection point

- `runYtdlpCheckAndUpdate()` (`ytdlpHandler.ts`) downloads and executes a
  **new yt-dlp binary** at runtime.
- The app has its own general update checker
  (`core-app/hook/updateCheckerHook.ts` / `appInfoHandler.ts`,
  `autoDownloadUpdate`).

App Store Review Guideline **2.5.2** prohibits apps that download or execute
code that changes functionality outside the Store's own update mechanism.
Both of the above need to be disabled/gated for a MAS build.

## 4. Content-policy risk (not fixable by engineering)

Downlodr is a video/audio downloader for 1,800+ platforms including YouTube.
App Store Review Guideline **5.2.3** and related IP/copyright provisions have
a consistent history of rejecting this category of app — tools that download
content from platforms whose own ToS prohibit downloading — regardless of the
underlying tool's own legality. This should be confirmed with Apple (or
via precedent research) **before** investing in the sandboxing work above,
since a guideline-5.2.3 rejection isn't fixable by better entitlements.

## Summary punch list

- [ ] Confirm Apple Developer Program membership has MAS capability enabled
- [ ] Register a real bundle ID (`com.talisik.downlodr` or similar) in Apple Developer portal
- [ ] Obtain Apple Distribution cert + MAS provisioning profile
- [ ] Add `com.apple.security.app-sandbox` + MAS-appropriate entitlements (new plist, don't reuse `entitlements-production.plist`)
- [ ] Redesign yt-dlp/ffmpeg subprocess execution for sandbox compatibility
- [ ] Add `com.apple.security.network.server` if local servers stay in the MAS build (or strip them for that build target)
- [ ] Disable/gate `runYtdlpCheckAndUpdate()` and the general app self-updater for MAS builds
- [ ] Add `PrivacyInfo.xcprivacy`
- [ ] Add a MAS maker/packaging path (electron-forge has no built-in MAS maker; typically `@electron/osx-sign --type=distribution` + `productbuild`)
- [ ] App Store Connect listing: bundle ID, icon, screenshots, description, age rating, privacy labels
- [ ] **Verify Guideline 5.2.3 risk with Apple or via precedent before investing further**
