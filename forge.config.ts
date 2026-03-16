import { MakerPKG } from '@electron-forge/maker-pkg';
import { MakerZIP } from '@electron-forge/maker-zip';
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
    icon: './src/Assets/AppLogo/256x256',
    name: 'Downlodr',
    executableName: 'Downlodr',
    extraResource: ['./src/Assets/AppLogo', './ffmpeg.exe', './ggml-base.bin'],
  },

  rebuildConfig: {},

  makers: [
    new MakerPKG({
      identity: null,
    }),

    new MakerNSIS({
      async getAppBuilderConfig() {
        return {
          nsis: {
            artifactName: '${productName}-${version}-${arch}.${ext}',
            oneClick: false,
            allowElevation: true,
            installerIcon: './src/Assets/AppLogo/256x256.ico',
            uninstallerIcon: './src/Assets/AppLogo/256x256.ico',
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

    new MakerZIP({}, ['darwin', 'win32', 'linux']),
  ],

  hooks: {
    postPackage: async (forgeConfig, packageResult) => {
      for (const outputPath of packageResult.outputPaths) {
        try {
          await fs.copyFile(
            path.resolve(__dirname, 'yt-dlp.exe'),
            path.join(outputPath, 'yt-dlp.exe'),
          );
        } catch (error) {
          console.error(`Failed to copy yt-dlp.exe for ${outputPath}:`, error);
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
