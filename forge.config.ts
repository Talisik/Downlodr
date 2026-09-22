import { MakerPKG } from '@electron-forge/maker-pkg';
import { FusesPlugin } from '@electron-forge/plugin-fuses';
import { VitePlugin } from '@electron-forge/plugin-vite';
import type { ForgeConfig } from '@electron-forge/shared-types';
import { FuseV1Options, FuseVersion } from '@electron/fuses';
import MakerNSIS from '@felixrieseberg/electron-forge-maker-nsis';
import { spawn } from 'child_process';
import { constants as fsConstants, existsSync } from 'fs';
import fs from 'fs/promises';
import path from 'path';

// electron-forge loads this config from the project root, so process.cwd() is
// the project root in BOTH CommonJS and ES module scopes. We avoid __dirname,
// which is undefined when this file is evaluated as an ES module on the CI
// runner (newer Node reparses it as ESM), silently breaking signing/resource
// paths.
const projectRoot = process.cwd();

// Platform-conditional extra resources. A missing extraResource path fails
// packaging outright, so each platform lists only the binaries it ships.
// - darwin: committed mac yt-dlp + static ffmpeg (arm64/x64), all tracked in
//   git. ffprobe-arm64 is not tracked (no arm64 static build is published);
//   Apple Silicon falls back to the x64 ffprobe under Rosetta 2. The ffprobe
//   entries are existsSync-gated so packaging does not fail while one is
//   missing, and get picked up automatically once added to binaries/.
//   ggml-small.bin is fetched at build time by scripts/download-whisper-model.sh
//   (wired into both the local build scripts and macos-build.yml) and is listed
//   unconditionally — a missing Whisper model must fail packaging loudly rather
//   than silently ship a build where transcription is permanently broken.
//   ggml-silero-v5.1.2.bin (VAD) has no mac fetch step yet, so it is gated.
// - win32: the Windows binaries, all fetched at build time by scripts/binaries.mjs.
const darwinFfprobeResources = [
  './binaries/ffprobe-arm64',
  './binaries/ffprobe-x64',
].filter(existsSync);

const darwinVadResource = ['./ggml-silero-v5.1.2.bin'].filter(existsSync);

const extraResource =
  process.platform === 'darwin'
    ? [
        './src/assets/logo',
        './yt-dlp_macos',
        './binaries/ffmpeg-arm64',
        './binaries/ffmpeg-x64',
        ...darwinFfprobeResources,
        './ggml-small.bin',
        ...darwinVadResource,
      ]
    : [
        './src/assets/logo',
        './ffmpeg.exe',
        './ggml-small.bin',
        './ggml-silero-v5.1.2.bin',
        './ffprobe.exe',
      ];

// Helper: sign a bundled binary with hardened runtime + optional entitlements.
// Never fatal — a signing failure is reported and the build continues, matching
// the behaviour of scripts/fix-binary-signing.sh, which re-signs everything
// before notarization anyway.
async function signBinaryWithEntitlements(
  binaryPath: string,
  binaryName: string,
  entitlementsPath?: string,
): Promise<void> {
  try {
    console.log(`   🔐 Signing ${binaryName}: ${binaryPath}`);

    const codesignArgs = [
      '--sign',
      process.env.APPLE_IDENTITY!,
      '--force',
      '--options',
      'runtime',
      '--deep',
      '--strict',
    ];
    if (entitlementsPath) {
      codesignArgs.push('--entitlements', entitlementsPath);
    }
    codesignArgs.push(binaryPath);

    await new Promise((resolve, reject) => {
      const signProcess = spawn('codesign', codesignArgs);
      let stderr = '';
      signProcess.stderr.on('data', (data) => {
        stderr += data.toString();
      });
      signProcess.on('close', (code) => {
        if (code === 0) {
          console.log(`   ✅ Signed ${binaryName}`);
          resolve(undefined);
        } else {
          reject(
            new Error(`codesign failed with exit code ${code}: ${stderr}`),
          );
        }
      });
      signProcess.on('error', reject);
    });
  } catch (signError) {
    console.warn(
      `   ⚠️  Failed to sign ${binaryName} (continuing):`,
      (signError as Error).message,
    );
  }
}

const config: ForgeConfig = {
  packagerConfig: {
    prune: true,
    asar: {
      // better-sqlite3 is a native module — .node binaries cannot be loaded from
      // inside an ASAR archive, so it must be unpacked to disk. Smart Organize's
      // ONNX/sharp native deps are packaged in the add-on's own gitignored folder.
      // downlodr-mcp is unpacked too: ensureDownlodrCliOnPath() (chatHandler.ts)
      // shims a plain system `node` to run its bundled dist/index.js directly,
      // and a vanilla Node binary (unlike Electron's own asar-patched runtime)
      // cannot read a path living inside app.asar at all.
      unpack: '**/{better-sqlite3,downlodr-mcp}/**',
    },
    // No extension → electron-packager picks downlodr_icon.icns (mac) /
    // downlodr_icon.ico (win) from the same basename.
    icon: './src/assets/logo/downlodr_icon',
    name: 'Downlodr',
    executableName: 'Downlodr',
    extraResource,
    // macOS code signing — applied on macOS when a signing identity is
    // available. Notarization is NOT done here: scripts/fix-binary-signing.sh
    // re-signs every nested binary first, and the build scripts then submit the
    // finished DMG to notarytool.
    osxSign:
      process.env.APPLE_IDENTITY && !process.env.SKIP_CODE_SIGNING
        ? ({
            identity: process.env.APPLE_IDENTITY,
            'hardened-runtime': true,
            'gatekeeper-assess': false,
            entitlements: path.join(projectRoot, 'entitlements.plist'),
            'entitlements-inherit': path.join(projectRoot, 'entitlements.plist'),
            'signature-flags': 'library',
            'pre-embed-provisioning-profile': false,
          } as any)
        : undefined,
    osxNotarize: undefined,
    ignore: (filePath: string) => {
      if (!filePath) return false;

      // Restore electron-packager's default ignores (these are lost when using a function)
      if (
        /\/(\.git|\.hg|\.svn|CVS|\.bzr|\$RECYCLE\.BIN|\.DS_Store)(\/|$)/.test(
          filePath,
        )
      )
        return true;
      if (/\/node_modules\/\.bin(\/|$)/.test(filePath)) return true;

      // Exclude local dev-tooling config — also avoids a packaging race when the
      // build is launched from a tool that rewrites these files mid-package.
      if (/^\/\.claude($|\/)/.test(filePath)) return true;

      // Exclude nested git worktrees (.worktrees/<branch>/…). Each one is a full
      // second checkout with its own node_modules living inside the project root,
      // so packager crawls it into the asar — bloating the build and crashing on
      // ENOENT when a file there changes mid-copy.
      if (/^\/\.worktrees($|\/)/.test(filePath)) return true;

      // Exclude forge output and Vite dev caches (but NOT .vite/build — that's the compiled app)
      if (/^\/out($|\/)/.test(filePath)) return true;
      if (/^\/\.vite\/deps($|\/)/.test(filePath)) return true;
      if (/^\/dist($|\/)/.test(filePath)) return true;

      // Exclude entire src/ tree — Vite compiled everything into .vite/build/.
      // Backend add-ons (afda, skedulosa) are downloaded separately by the add-on manager.
      // Exceptions: src/chat/docs and src/chat/claude-skills are plain files read
      // at runtime via fs (task docs + the Agent Skills bundle the embedded chat
      // installs into .claude/skills/) — Vite never touches them, so excluding
      // them here silently strips the embedded AI chat of both its docs and its
      // skills in every packaged build.
      //
      // The two parent dirs must be un-ignored explicitly: packager feeds this
      // function to fs-extra's copy `filter`, which does NOT recurse into a
      // directory it excluded — returning true for '/src' prunes the whole
      // subtree and the exception below never gets tested at all.
      if (filePath === '/src' || filePath === '/src/chat') return false;
      if (/^\/src\/chat\/(docs|claude-skills)(\/|$)/.test(filePath)) {
        return false;
      }
      if (filePath.startsWith('/src/')) return true;

      // Exclude dev/test artifacts that land in the project root
      if (/\.(mp4|mkv|avi|mov|webm|mp3|wav|flac)$/i.test(filePath)) return true;
      // Only exclude image files sitting directly at the root (e.g. /Exclude.png).
      // Subdirectory images (e.g. /.vite/renderer/assets/*.gif) are Vite-bundled
      // assets that must be included in the package.
      if (
        /\.(png|jpg|jpeg|gif|bmp)$/i.test(filePath) &&
        /^\/[^/]+$/.test(filePath)
      )
        return true;
      if (/^\/yarn\.lock$/.test(filePath)) return true;
      if (/^\/lint-output\.txt$/.test(filePath)) return true;
      if (/^\/task-plan($|\/)/.test(filePath)) return true;
      if (/^\/docs($|\/)/.test(filePath)) return true;
      if (/\.(md|txt)$/.test(filePath) && !/^\/src\//.test(filePath))
        return true;

      // Root-level runtime binaries. ffmpeg/ffprobe/ggml-small ship via
      // extraResource and yt-dlp.exe via the postPackage hook, so all of them
      // already land in resources/ (or beside the exe), which is where
      // getBundledBinaryPath() resolves them from via process.resourcesPath.
      // Nothing here excluded them before, so packager ALSO swept them into
      // app.asar — duplicating ~900MB into every build. yt-dlp_macos is never
      // used on win32 at all.
      //
      // The trailing catch-all is anchored to the root (/^\/[^/]+$/) on
      // purpose: better-sqlite3's .node binary lives deep inside node_modules
      // and must keep shipping. Do not widen this to all paths.
      if (/^\/(ffmpeg|ffprobe)\.exe$/.test(filePath)) return true;
      if (/^\/yt-dlp(\.exe|_macos)$/.test(filePath)) return true;
      // binaries/ holds the extensionless mac ffmpeg/ffprobe static builds
      // (~200MB). They ship via extraResource, so without this they would ALSO
      // be swept into app.asar — the same duplication the .exe rules above fix.
      // The root-anchored catch-all below cannot match them (they sit one level
      // down and have no extension).
      if (/^\/binaries($|\/)/.test(filePath)) return true;
      if (
        /\.(bin|exe|dll|node|pdb)$/i.test(filePath) &&
        /^\/[^/]+$/.test(filePath)
      )
        return true;

      // Agent/dev scratch dirs and root dev config — none of it is read at
      // runtime. .superpowers alone was 14.6MB of stored review diffs.
      if (/^\/\.superpowers($|\/)/.test(filePath)) return true;
      if (/^\/(website|extensions|patches)($|\/)/.test(filePath)) return true;
      if (/^\/\.env/.test(filePath)) return true;
      if (/^\/err\.log$/.test(filePath)) return true;
      if (
        /^\/(forge\.config|forge\.env\.d|vite\..*|tsconfig|declaration\.d)\./.test(
          filePath,
        )
      )
        return true;
      if (
        /^\/(\.eslintrc\.json|\.prettierrc|\.gitmodules|package-lock\.json|components\.json)$/.test(
          filePath,
        )
      )
        return true;

      // Exclude all node_modules except the packages below. Vite bundles every
      // other import into .vite/build/main.js and the renderer output, so nothing
      // else in node_modules is required at runtime.
      // better-sqlite3, bindings, file-uri-to-path: better-sqlite3 is a native
      // module (.node binary) that cannot be bundled; bindings and file-uri-to-path
      // are its loader dependencies.
      if (filePath.startsWith('/node_modules/')) {
        const keep = [
          '/node_modules/better-sqlite3',
          '/node_modules/bindings',
          '/node_modules/file-uri-to-path',
        ];

        for (const pkg of keep) {
          if (filePath === pkg || filePath.startsWith(pkg + '/')) return false;
        }
        return true;
      }

      return false;
    },
  },

  rebuildConfig: {},

  makers: [
    // NOTE: macOS DMGs are produced by Homebrew create-dmg in
    // scripts/build-with-create-dmg*.sh (the CI release path), not by a forge
    // maker. MakerDMG is intentionally omitted to keep the @electron-forge tree
    // at a single coherent 7.6.0 version (see "resolutions" in package.json).

    // macOS PKG installer — needs a "Developer ID Installer" certificate.
    new MakerPKG({
      identity:
        process.env.APPLE_INSTALLER_IDENTITY ||
        process.env.APPLE_IDENTITY ||
        null,
    }),

    new MakerNSIS({
      async getAppBuilderConfig() {
        return {
          nsis: {
            artifactName: '${productName}-${version}-${arch}.${ext}',
            oneClick: false,
            allowElevation: true,
            installerIcon: './src/assets/logo/downlodr_icon.ico',
            uninstallerIcon: './src/assets/logo/downlodr_icon.ico',
            allowToChangeInstallationDirectory: true,
            createDesktopShortcut: true,
            createStartMenuShortcut: true,
            shortcutName: 'Downlodr',
            uninstallDisplayName: 'Downlodr',
            deleteAppDataOnUninstall: true,
            warningsAsErrors: false,
            perMachine: false,
            include: './installer.nsh',
          },
        };
      },
    }),
  ],

  hooks: {
    prePackage: async () => {
      // Rebuild downlodr-mcp's dependency-free bundle so packaging always
      // ships a fresh dist/index.js — ensureDownlodrCliOnPath() (chatHandler.ts)
      // shims a plain `node` straight at this file with none of its
      // node_modules present, so a stale/unbundled dist here (e.g. a dev
      // forgot to rebuild after touching downlodr-mcp/src) would silently
      // ship a broken CLI in every packaged build, same as the bug this
      // whole flow was fixed for.
      const downlodrMcpDir = path.resolve(projectRoot, 'downlodr-mcp');
      try {
        const { execSync } = await import('child_process');
        execSync('npm run build', { cwd: downlodrMcpDir, stdio: 'inherit' });
        console.log('✓ downlodr-mcp bundle rebuilt');
      } catch (error) {
        throw new Error(
          `downlodr-mcp build failed — packaging would ship a stale/broken CLI: ${error}`,
        );
      }

      // Verify FFmpeg version.
      //
      // The minimum is 8.0.1, not 8.0: the whisper filter in 8.0.0 strips one
      // byte from the start of every cue. Whisper prefixes each segment with an
      // ASCII space, so Latin-script output looks fine and the bug is invisible
      // in English testing — but CJK segments carry no leading space, so every
      // cue loses the first byte of a multi-byte character. That shipped once
      // already because this check only compared the major version.
      //
      // On darwin the check runs against the committed static build for the
      // host arch. Neither committed mac binary is configured with
      // --enable-whisper today, so the whisper assertion below is a warning
      // there rather than a hard failure — making it fatal would block every
      // macOS build outright. See the warning text for what that costs.
      const isDarwin = process.platform === 'darwin';
      const ffmpegPath = isDarwin
        ? path.resolve(
            projectRoot,
            process.arch === 'arm64'
              ? 'binaries/ffmpeg-arm64'
              : 'binaries/ffmpeg-x64',
          )
        : path.resolve(projectRoot, 'ffmpeg.exe');
      let versionOutput: string | undefined;
      try {
        const { execSync } = await import('child_process');
        versionOutput = execSync(`"${ffmpegPath}" -version`, {
          encoding: 'utf-8',
        });
      } catch {
        // Only an inability to *run* ffmpeg is tolerated with a warning;
        // an actual version failure below must fail the build.
        console.warn('⚠ Could not verify FFmpeg version');
      }

      if (versionOutput) {
        const versionMatch = versionOutput.match(
          /ffmpeg version (\d+)\.(\d+)(?:\.(\d+))?/,
        );
        if (!versionMatch) {
          throw new Error('Could not parse the bundled FFmpeg version.');
        }
        const [major, minor, patch] = [
          parseInt(versionMatch[1], 10),
          parseInt(versionMatch[2], 10),
          parseInt(versionMatch[3] ?? '0', 10),
        ];
        const version = `${major}.${minor}.${patch}`;
        const tooOld = major < 8 || (major === 8 && minor === 0 && patch < 1);
        if (tooOld) {
          const message = `FFmpeg ${version} is too old — 8.0.1+ is required (8.0.0 corrupts the first character of every transcript cue).`;
          if (isDarwin) {
            // The committed mac statics are older than the Windows floor
            // (binaries/ffmpeg-arm64 is 6.0.0), and the whisper filter does not
            // exist at all before 7.1. Downloading, merging and converting all
            // work on 6.x, so this is a transcription-only defect and blocking
            // every macOS build over it would be worse than shipping it. The
            // mac build line has always shipped this way.
            console.warn(
              `⚠ ${message} Shipping anyway — transcription will not work in this macOS build.`,
            );
          } else {
            throw new Error(message);
          }
        }
        if (!/enable-whisper/.test(versionOutput)) {
          const message = `The bundled FFmpeg ${version} was built without --enable-whisper, so transcription cannot work.`;
          if (isDarwin) {
            console.warn(
              `⚠ ${message} Shipping anyway — transcription will fail at runtime on macOS ("No such filter: 'whisper'"). Replace binaries/ffmpeg-${process.arch === 'arm64' ? 'arm64' : 'x64'} with a whisper-enabled static build to fix.`,
            );
          } else {
            throw new Error(message);
          }
        } else {
          console.log(`✓ FFmpeg ${version} (whisper enabled) verified`);
        }
      }
    },

    postPackage: async (forgeConfig, packageResult) => {
      // electron-packager's outputPath is the directory CONTAINING the .app
      // bundle (e.g. out/Downlodr-darwin-arm64), not the bundle itself — the
      // real Resources dir is <outputPath>/<Name>.app/Contents/Resources.
      // Joining 'Resources' straight onto outputPath silently no-ops every
      // copy below, which is how packaged macOS builds once shipped with no
      // yt-dlp in Resources at all.
      async function resolveMacResourcesPath(
        outputPath: string,
      ): Promise<string | null> {
        const entries = await fs.readdir(outputPath).catch(() => []);
        const appDir = entries.find((entry) => entry.endsWith('.app'));
        if (!appDir) return null;
        return path.join(outputPath, appDir, 'Contents', 'Resources');
      }

      const signingEnabled = Boolean(
        process.env.APPLE_IDENTITY && !process.env.SKIP_CODE_SIGNING,
      );

      for (const outputPath of packageResult.outputPaths) {
        // ----- macOS: bundle + sign yt-dlp and the FFmpeg binaries -----
        if (process.platform === 'darwin') {
          // Every failure below is fatal. An app shipped without yt-dlp in
          // Contents/Resources cannot fetch metadata or download anything,
          // and the runtime cannot recover it — the only signal used to be a
          // warning buried in the build log, so broken DMGs shipped silently.
          const resourcesPath = await resolveMacResourcesPath(outputPath);
          if (!resourcesPath) {
            throw new Error(
              `Could not locate an .app bundle under ${outputPath} — no mac binaries were bundled.`,
            );
          }

          const sourceBinaryPath = path.resolve(projectRoot, 'yt-dlp_macos');
          if (!existsSync(sourceBinaryPath)) {
            throw new Error(
              `yt-dlp_macos not found at ${sourceBinaryPath} — the packaged app would have no downloader.`,
            );
          }

          // Shipped under both names: ytdlpHandler.ts resolves the
          // platform-suffixed 'yt-dlp_macos', while older call sites and
          // external tooling still look for a bare 'yt-dlp'.
          for (const name of ['yt-dlp', 'yt-dlp_macos']) {
            const destPath = path.join(resourcesPath, name);
            await fs.copyFile(sourceBinaryPath, destPath);
            await fs.chmod(destPath, 0o755);
            console.log(`✓ Copied + chmod ${destPath}`);
            if (signingEnabled) {
              await signBinaryWithEntitlements(
                destPath,
                'yt-dlp',
                path.join(projectRoot, 'yt-dlp-entitlements.plist'),
              );
            }
          }

          // The app spawns this in place under the hardened runtime, so a
          // missing or non-executable file here is a shipped-broken build.
          await fs.access(
            path.join(resourcesPath, 'yt-dlp_macos'),
            fsConstants.X_OK,
          );

          // Sign the bundled FFmpeg/ffprobe static builds. They arrive via
          // extraResource, so they are unsigned until this runs.
          if (signingEnabled) {
            for (const name of [
              'ffmpeg-arm64',
              'ffmpeg-x64',
              'ffprobe-arm64',
              'ffprobe-x64',
            ]) {
              const candidate = path.join(resourcesPath, name);
              if (!existsSync(candidate)) continue;
              try {
                await fs.chmod(candidate, 0o755);
                await signBinaryWithEntitlements(candidate, name);
              } catch (ffmpegError) {
                console.warn(
                  `   ⚠️  Failed to process ${name}:`,
                  (ffmpegError as Error).message,
                );
              }
            }
          }

          continue;
        }

        // ----- Windows: copy yt-dlp.exe next to the executable -----
        // Fatal for the same reason as the darwin branch above: this is the
        // only copy of yt-dlp the installer ships, and ytdlpHandler.ts
        // resolves it relative to the executable.
        try {
          await fs.copyFile(
            path.resolve(projectRoot, 'yt-dlp.exe'),
            path.join(outputPath, 'yt-dlp.exe'),
          );
          console.log(`✓ Copied yt-dlp.exe to ${outputPath}`);
        } catch (error) {
          console.error(`Failed to copy yt-dlp.exe for ${outputPath}:`, error);
          throw error;
        }
      }
    },
  },

  plugins: [
    new VitePlugin({
      build: [
        {
          entry: 'src/main.ts',
          config: 'vite.main.config.ts',
          target: 'main',
        },
        {
          entry: 'src/core-app/ipc/main/afda-worker/entry.ts',
          config: 'vite.afda-worker.config.ts',
          target: 'main',
        },
        {
          entry: 'src/preload.ts',
          config: 'vite.preload.config.ts',
          target: 'preload',
        },
        // NOTE: there was a fifth entry here for 'src/preloadChat.ts'. That
        // file does not exist — src/chat/ was removed from this branch and
        // nothing references preloadChat — so the build for it transformed 0
        // modules and printed "x Build failed in 16ms" on every run, without
        // failing packaging. Removing it silences a false alarm that would
        // otherwise mask a genuinely broken entry.
      ],
      renderer: [
        {
          name: 'main_window',
          config: 'vite.renderer.config.ts',
        },
      ],
    }),

    new FusesPlugin({
      version: FuseVersion.V1,
      [FuseV1Options.RunAsNode]: false,
      [FuseV1Options.EnableCookieEncryption]: true,
      [FuseV1Options.EnableNodeOptionsEnvironmentVariable]: false,
      [FuseV1Options.EnableNodeCliInspectArguments]: false,
      [FuseV1Options.EnableEmbeddedAsarIntegrityValidation]: true,
      [FuseV1Options.OnlyLoadAppFromAsar]: true,
    }),
  ],
};

export default config;
