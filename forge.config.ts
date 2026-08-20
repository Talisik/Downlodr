import { FusesPlugin } from '@electron-forge/plugin-fuses';
import { VitePlugin } from '@electron-forge/plugin-vite';
import type { ForgeConfig } from '@electron-forge/shared-types';
import { FuseV1Options, FuseVersion } from '@electron/fuses';
import MakerNSIS from '@felixrieseberg/electron-forge-maker-nsis';
import fs from 'fs/promises';
import path from 'path';

const config: ForgeConfig = {
  packagerConfig: {
    prune: true,
    asar: {
      // better-sqlite3 is a native module — .node binaries cannot be loaded from
      // inside an ASAR archive, so it must be unpacked to disk. Smart Organize's
      // ONNX/sharp native deps are packaged in the add-on's own gitignored folder.
      unpack: '**/better-sqlite3/**',
    },
    icon: './src/assets/logo/downlodr_icon.png',
    name: 'Downlodr',
    executableName: 'Downlodr',
    extraResource: [
      './src/assets/logo',
      './ffmpeg.exe',
      './ggml-small.bin',
      './ggml-silero-v5.1.2.bin',
      './ffprobe.exe',
    ],
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
      if (filePath === '/src') return true;
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
      // Verify FFmpeg version.
      //
      // The minimum is 8.0.1, not 8.0: the whisper filter in 8.0.0 strips one
      // byte from the start of every cue. Whisper prefixes each segment with an
      // ASCII space, so Latin-script output looks fine and the bug is invisible
      // in English testing — but CJK segments carry no leading space, so every
      // cue loses the first byte of a multi-byte character. That shipped once
      // already because this check only compared the major version.
      const ffmpegPath = path.resolve(__dirname, 'ffmpeg.exe');
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
          throw new Error(
            `FFmpeg ${version} is too old — 8.0.1+ is required (8.0.0 corrupts the first character of every transcript cue).`,
          );
        }
        if (!/enable-whisper/.test(versionOutput)) {
          throw new Error(
            `The bundled FFmpeg ${version} was built without --enable-whisper, so transcription cannot work.`,
          );
        }
        console.log(`✓ FFmpeg ${version} (whisper enabled) verified`);
      }
    },

    postPackage: async (forgeConfig, packageResult) => {
      for (const outputPath of packageResult.outputPaths) {
        // Copy yt-dlp.exe next to the executable
        try {
          await fs.copyFile(
            path.resolve(__dirname, 'yt-dlp.exe'),
            path.join(outputPath, 'yt-dlp.exe'),
          );
          console.log(`✓ Copied yt-dlp.exe to ${outputPath}`);
        } catch (error) {
          console.error(`Failed to copy yt-dlp.exe for ${outputPath}:`, error);
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
