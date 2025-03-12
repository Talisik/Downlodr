import type { ForgeConfig } from '@electron-forge/shared-types';
import { VitePlugin } from '@electron-forge/plugin-vite';
import { FusesPlugin } from '@electron-forge/plugin-fuses';
import { FuseV1Options, FuseVersion } from '@electron/fuses';
import { MakerPKG } from '@electron-forge/maker-pkg';
import { MakerZIP } from '@electron-forge/maker-zip';
import MakerNSIS from '@felixrieseberg/electron-forge-maker-nsis';

const config: ForgeConfig = {
  packagerConfig: {
    asar: true,
    icon: './src/Assets/AppLogo/256x256',
    name: 'Downlodr',
    executableName: 'Downlodr',
  },
  rebuildConfig: {},
  makers: [
    // macOS PKG installer
    new MakerPKG({
      identity: null, // Set to null for development, add your Apple Developer ID for production
      /*signing: {
        identity: null, // Same as above
        "entitlements": null,
        "entitlements-inherit": null,
        "gatekeeper-assess": false,
      },*/
    }),

    // Windows NSIS installer
    new MakerNSIS({
      async getAppBuilderConfig() {
        return {
          nsis: {
            artifactName: '${productName}-${version}-${arch}.${ext}',
            oneClick: false,
            allowElevation: true,
            allowToChangeInstallationDirectory: true,
            createDesktopShortcut: true,
            createStartMenuShortcut: true,
            shortcutName: 'Downlodr',
            uninstallDisplayName: 'Downlodr',
            deleteAppDataOnUninstall: false,
          },
        };
      },
    }),

    // Cross-platform ZIP packages
    new MakerZIP({}, ['darwin', 'win32', 'linux']),
  ],
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
