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
      // better-sqlite3 is a native module — native .node binaries cannot be loaded
      // from inside an ASAR archive, so they must be unpacked to disk.
      unpack: '**/better-sqlite3/**',
    },
    icon: './src/assets/logo/downlodr_icon.png',
    name: 'Downlodr',
    executableName: 'Downlodr',
    extraResource: [
      './src/assets/logo',
      './ffmpeg.exe',
      './ggml-small.bin',
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

      // Exclude forge output and Vite dev caches (but NOT .vite/build — that's the compiled app)
      if (/^\/out($|\/)/.test(filePath)) return true;
      if (/^\/\.vite\/deps($|\/)/.test(filePath)) return true;
      if (/^\/dist($|\/)/.test(filePath)) return true;

      // Exclude entire src/ tree — Vite compiled everything into .vite/build/.
      // Backend add-ons (afda, skedulosa) are downloaded separately by the add-on manager.
      if (filePath === '/src' || filePath.startsWith('/src/')) return true;

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

      // Exclude all node_modules except better-sqlite3 and its two runtime deps.
      // Vite bundles every other import into .vite/build/main.js and the renderer
      // output, so nothing else in node_modules is required at runtime.
      // better-sqlite3 is a native module (.node binary) that cannot be bundled.
      //   bindings       — required by better-sqlite3/lib/database.js to load the .node file
      //   file-uri-to-path — required by bindings
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
      // Verify FFmpeg version
      const ffmpegPath = path.resolve(__dirname, 'ffmpeg.exe');
      try {
        const { execSync } = await import('child_process');
        const versionOutput = execSync(`"${ffmpegPath}" -version`, {
          encoding: 'utf-8',
        });
        const versionMatch = versionOutput.match(/ffmpeg version (\d+)\.(\d+)/);
        if (versionMatch) {
          const majorVersion = parseInt(versionMatch[1], 10);
          const version = `${versionMatch[1]}.${versionMatch[2]}`;
          if (majorVersion < 8) {
            throw new Error(
              `FFmpeg ${version} is too old. FFmpeg 8.0+ is required.`,
            );
          }
          console.log(`✓ FFmpeg ${version} verified`);
        }
      } catch (error) {
        console.warn('⚠ Could not verify FFmpeg version');
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
