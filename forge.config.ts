import { MakerPKG } from '@electron-forge/maker-pkg';
import { MakerZIP } from '@electron-forge/maker-zip';
import { MakerDMG } from '@electron-forge/maker-dmg';
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
    icon: './src/Assets/AppLogo/icon', // Will use icon.icns on macOS, icon.ico on Windows
    name: 'Downlodr',
    executableName: 'Downlodr',
    extraResource: ['./src/Assets/AppLogo', './yt-dlp', './ffmpeg'],
    // macOS specific settings for code signing and notarization
    ...(process.platform === 'darwin' &&
      process.env.APPLE_IDENTITY && {
        osxSign: {
          identity: process.env.APPLE_IDENTITY,
          'hardened-runtime': true,
          'gatekeeper-assess': false,
          'signature-flags': ['runtime'],
        } as any, // Type assertion to bypass TypeScript restrictions
        // Temporarily disable notarization due to signing verification issues
        // TODO: Fix notarization signing process in future release
        // ...(process.env.APPLE_ID && {
        //   osxNotarize: {
        //     appleId: process.env.APPLE_ID,
        //     appleIdPassword: process.env.APPLE_APP_SPECIFIC_PASSWORD || '',
        //     teamId: process.env.APPLE_TEAM_ID || '',
        //   },
        // }),
      }),
  },
  rebuildConfig: {},
  makers: [
    // macOS DMG installer - preferred by most macOS users
    new MakerDMG({
      icon: './src/Assets/AppLogo/256x256.ico',
      name: 'Downlodr',
      title: 'Install Downlodr',
      format: 'ULFO',
    }),

    // macOS PKG installer - requires "Developer ID Installer" certificate (different from Application cert)
    // If you get signing errors, you need both certificates from Apple Developer Portal
    new MakerPKG({
      identity:
        process.env.APPLE_INSTALLER_IDENTITY ||
        process.env.APPLE_IDENTITY ||
        null,
    }),

    // macOS ZIP for distribution
    new MakerZIP({}, ['darwin']),

    // Windows NSIS installer
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
            deleteAppDataOnUninstall: false,
            warningsAsErrors: false,
            perMachine: false, // Changed to false - install per-user, not machine-wide
            include: './installer.nsh', // Keep this for admin privileges at runtime
          },
        };
      },
    }),

    // Cross-platform ZIP packages
    new MakerZIP({}, ['win32', 'linux']),
  ],
  hooks: {
    postPackage: async (forgeConfig, packageResult) => {
      for (const outputPath of packageResult.outputPaths) {
        try {
          // Copy the appropriate yt-dlp binary based on platform
          const binaryName =
            process.platform === 'win32' ? 'yt-dlp.exe' : 'yt-dlp';
          const binaryPath = path.join(outputPath, binaryName);

          await fs.copyFile(path.resolve(__dirname, binaryName), binaryPath);

          // Note: yt-dlp binary will be automatically signed by the main app signing process
          console.log(`✅ Copied ${binaryName} to ${binaryPath}`);
        } catch (error) {
          console.error(`Failed to process yt-dlp for ${outputPath}:`, error);
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
    // Disable Fuses plugin when code signing is enabled to avoid conflicts
    ...(!process.env.APPLE_IDENTITY
      ? [
          new FusesPlugin({
            version: FuseVersion.V1,
            [FuseV1Options.RunAsNode]: false,
            [FuseV1Options.EnableCookieEncryption]: true,
            [FuseV1Options.EnableNodeOptionsEnvironmentVariable]: false,
            [FuseV1Options.EnableNodeCliInspectArguments]: false,
            [FuseV1Options.EnableEmbeddedAsarIntegrityValidation]: true,
            [FuseV1Options.OnlyLoadAppFromAsar]: true,
          }),
        ]
      : []),
  ],
};

export default config;
