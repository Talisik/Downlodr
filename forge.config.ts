import { FusesPlugin } from '@electron-forge/plugin-fuses';
import { VitePlugin } from '@electron-forge/plugin-vite';
import type { ForgeConfig } from '@electron-forge/shared-types';
import { FuseV1Options, FuseVersion } from '@electron/fuses';
import MakerNSIS from '@felixrieseberg/electron-forge-maker-nsis';
import fs from 'fs/promises';
import path from 'path';
const config: ForgeConfig = {
  packagerConfig: {
    asar: true,
    icon: './src/assets/logo/downlodr_icon.png',
    name: 'Downlodr',
    executableName: 'Downlodr',
    extraResource: [
      './src/assets/logo',
      './ffmpeg.exe',
      './ggml-base.bin',
      './ffprobe.exe',
    ],
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

        // Copy better-sqlite3 and its runtime deps into app.asar.unpacked.
        // The src/ directory is not bundled into the ASAR, so asar.unpack globs
        // won't match these — we must copy them explicitly.
        // better-sqlite3 requires 'bindings' at runtime, which requires 'file-uri-to-path'.
        const toolkitNodeModules = path.resolve(
          __dirname,
          'src/skedulosa/backend/video-nemesis-toolkit/node_modules',
        );
        const unpackedNodeModules = path.join(
          outputPath,
          'resources/app.asar.unpacked/src/skedulosa/backend/video-nemesis-toolkit/node_modules',
        );
        for (const pkg of ['better-sqlite3', 'bindings', 'file-uri-to-path']) {
          try {
            await fs.mkdir(unpackedNodeModules, { recursive: true });
            await fs.cp(
              path.join(toolkitNodeModules, pkg),
              path.join(unpackedNodeModules, pkg),
              { recursive: true },
            );
            console.log(`✓ Copied ${pkg} to app.asar.unpacked`);
          } catch (error) {
            console.error(`Failed to copy ${pkg}:`, error);
          }
        }
      }
    },
    prePackage: async () => {
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
