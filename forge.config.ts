import { FusesPlugin } from '@electron-forge/plugin-fuses';
import { VitePlugin } from '@electron-forge/plugin-vite';
import type { ForgeConfig } from '@electron-forge/shared-types';
import { FuseV1Options, FuseVersion } from '@electron/fuses';
import { MakerAppX } from '@electron-forge/maker-appx';
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
      './ffprobe.exe',
      // afda-backend and video-nemesis-toolkit, bundled as plain folders
      // outside the asar — copied into userData/downlodr-add-ons/<pack> on
      // first launch (see addonManager.ts's seedBuiltInPacks) so they load
      // exactly like a downloaded add-on does. Requiring node_modules from
      // inside an asar (even unpacked) breaks directory-listing-based
      // resolution for non-native deps; a plain disk folder doesn't have
      // that problem.
      './src/afda/backend/afda-backend__hidden',
      './src/skedulosa/backend/video-nemesis-toolkit__hidden',
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
      if (/^\/\.superpowers($|\/)/.test(filePath)) return true;
      if (/^\/\.worktrees($|\/)/.test(filePath)) return true;

      // Exclude forge output and Vite dev caches (but NOT .vite/build — that's the compiled app)
      if (/^\/out($|\/)/.test(filePath)) return true;
      if (/^\/\.vite\/deps($|\/)/.test(filePath)) return true;
      if (/^\/dist($|\/)/.test(filePath)) return true;

      // downlodr-mcp is a standalone CLI package developed alongside the app
      // (npm-linked separately per CLAUDE.md) — the packaged app never
      // requires it at runtime, it only talks to it over the local MCP
      // bridge HTTP/WS server. website/ is the separate Docusaurus docs
      // site. Neither belongs in the shipped binary.
      if (/^\/downlodr-mcp($|\/)/.test(filePath)) return true;
      if (/^\/website($|\/)/.test(filePath)) return true;

      // ffmpeg.exe, ffprobe.exe, and ggml-small.bin are shipped via
      // extraResource above; yt-dlp's binary is copied next to the exe by
      // the postPackage hook below. None of them are ever read from inside
      // the asar, so bundling them here would just duplicate the copies
      // that extraResource/postPackage already place on disk.
      if (/^\/(ffmpeg\.exe|ffprobe\.exe|ggml-small\.bin|yt-dlp\.exe|yt-dlp_macos|yt-dlp_linux)$/.test(filePath))
        return true;

      // .env holds only build-time Vite config (already inlined into the
      // compiled bundle by Vite) and has no reason to ship as a loose file;
      // .gitmodules/.gitignore/package-lock.json are pure dev metadata.
      if (/^\/(\.env|\.gitmodules|\.gitignore|package-lock\.json)$/.test(filePath))
        return true;

      // Exclude entire src/ tree — Vite compiled everything into .vite/build/.
      // afda-backend and video-nemesis-toolkit ship as extraResource (see
      // above) instead of living inside /src in the packaged app; smart-organize-backend
      // is still downloaded separately by the add-on manager.
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
    new MakerAppX({
      publisher: 'CN=EF31CD96-46EA-4C50-A4B3-5EF690CDB5A8',
      packageName: 'Talisik.Downlodr',
      packageDisplayName: 'Downlodr',
      packageDescription:
        'Downlodr is a powerful, user-friendly video downloading solution that supports over 1,800 platforms',
      assets: './appx-assets',
      makeVersionWinStoreCompatible: true,
      manifest: path.join(process.cwd(), 'appx-assets/AppXManifest.xml'),
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
    preMake: async () => {
      const pkg = JSON.parse(
        await fs.readFile(path.join(process.cwd(), 'package.json'), 'utf8'),
      );
      const semver = pkg.version.split('-')[0];
      const version = `${semver}.0`;
      const manifest = `<?xml version="1.0" encoding="utf-8"?>
<Package
   xmlns="http://schemas.microsoft.com/appx/manifest/foundation/windows10"
   xmlns:uap="http://schemas.microsoft.com/appx/manifest/uap/windows10"
   xmlns:rescap="http://schemas.microsoft.com/appx/manifest/foundation/windows10/restrictedcapabilities">
  <Identity Name="Talisik.Downlodr"
    ProcessorArchitecture="x64"
    Publisher="CN=EF31CD96-46EA-4C50-A4B3-5EF690CDB5A8"
    Version="${version}" />
  <Properties>
    <DisplayName>Downlodr</DisplayName>
    <PublisherDisplayName>Talisik</PublisherDisplayName>
    <Description>Downlodr is a powerful, user-friendly video downloading solution that supports over 1,800 platforms</Description>
    <Logo>Assets\\StoreLogo.png</Logo>
  </Properties>
  <Resources>
    <Resource Language="en-us" />
  </Resources>
  <Dependencies>
    <TargetDeviceFamily Name="Windows.Desktop" MinVersion="10.0.17763.0" MaxVersionTested="10.0.22621.0" />
  </Dependencies>
  <Capabilities>
    <rescap:Capability Name="runFullTrust"/>
  </Capabilities>
  <Applications>
    <Application Id="Downlodr" Executable="app\\Downlodr.exe" EntryPoint="Windows.FullTrustApplication">
      <uap:VisualElements
       BackgroundColor="#464646"
       DisplayName="Downlodr"
       Square150x150Logo="Assets\\Square150x150Logo.png"
       Square44x44Logo="Assets\\Square44x44Logo.png"
       Description="Downlodr is a powerful, user-friendly video downloading solution that supports over 1,800 platforms">
        <uap:DefaultTile Wide310x150Logo="Assets\\Wide310x150Logo.png" />
      </uap:VisualElements>
    </Application>
  </Applications>
</Package>`;
      await fs.writeFile(
        path.join(process.cwd(), 'appx-assets/AppXManifest.xml'),
        manifest,
        'utf8',
      );
      console.log(
        `✓ Generated AppXManifest.xml (v${version}, MinVersion 10.0.17763.0)`,
      );
    },

    postMake: async (forgeConfig, makeResults) => {
      for (const result of makeResults) {
        result.artifacts = await Promise.all(
          result.artifacts.map(async (artifact) => {
            if (artifact.endsWith('.appx')) {
              const msixPath = artifact.replace(/\.appx$/, '.msix');
              await fs.rename(artifact, msixPath);
              console.log(
                `✓ Renamed ${path.basename(artifact)} → ${path.basename(
                  msixPath,
                )}`,
              );
              return msixPath;
            }
            return artifact;
          }),
        );
      }
      return makeResults;
    },

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
