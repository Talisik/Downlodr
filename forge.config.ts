import { MakerPKG } from '@electron-forge/maker-pkg';
import { MakerZIP } from '@electron-forge/maker-zip';
import { FusesPlugin } from '@electron-forge/plugin-fuses';
import { VitePlugin } from '@electron-forge/plugin-vite';
import type { ForgeConfig } from '@electron-forge/shared-types';
import { FuseV1Options, FuseVersion } from '@electron/fuses';
import MakerNSIS from '@felixrieseberg/electron-forge-maker-nsis';
import { spawn } from 'child_process';
import fs from 'fs/promises';
import path from 'path';

// electron-forge loads this config from the project root, so process.cwd() is
// the project root in BOTH CommonJS and ES module scopes. We avoid projectRoot,
// which is undefined when this file is evaluated as an ES module on the runner
// (Node 24 reparses it as ESM), silently breaking signing/resource paths.
const projectRoot = process.cwd();

// Platform-conditional extra resources. A missing extraResource path fails
// packaging, so each platform lists only the binaries it actually ships.
// - darwin: bundled mac yt-dlp + static ffmpeg (arm64/x64) — all tracked in repo.
// - win32:  Windows binaries (ffmpeg/ffprobe/ggml) are fetched at build time.
const extraResource =
  process.platform === 'darwin'
    ? [
        './src/Assets/Logo',
        './yt-dlp_macos',
        './binaries/ffmpeg-arm64',
        './binaries/ffmpeg-x64',
      ]
    : process.platform === 'win32'
      ? ['./src/Assets/Logo', './ffmpeg.exe', './ggml-small.bin', './ffprobe.exe']
      : ['./src/Assets/Logo'];

// Helper: sign a bundled binary with hardened runtime + optional entitlements.
async function signBinaryWithEntitlements(
  binaryPath: string,
  binaryName: string,
  entitlementsPath?: string,
): Promise<void> {
  try {
    console.log(`   🔐 Signing ${binaryName} binary: ${binaryPath}`);
    if (entitlementsPath) {
      console.log(`   📋 Using entitlements: ${entitlementsPath}`);
    }

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

    const signProcess = spawn('codesign', codesignArgs);

    await new Promise((resolve, reject) => {
      let stdout = '';
      let stderr = '';

      signProcess.stdout.on('data', (data) => {
        stdout += data.toString();
      });

      signProcess.stderr.on('data', (data) => {
        stderr += data.toString();
      });

      signProcess.on('close', (code) => {
        if (code === 0) {
          console.log(`   ✅ Successfully signed ${binaryName} binary`);
          if (stdout) console.log(`   📝 Stdout: ${stdout}`);
          resolve(undefined);
        } else {
          console.error(
            `   ❌ Failed to sign ${binaryName} binary (exit code: ${code})`,
          );
          if (stderr) console.error(`   📝 Stderr: ${stderr}`);
          if (stdout) console.error(`   📝 Stdout: ${stdout}`);
          reject(
            new Error(`Code signing failed with exit code ${code}: ${stderr}`),
          );
        }
      });

      signProcess.on('error', (error) => {
        console.error(`   ❌ Error running codesign:`, error);
        reject(error);
      });
    });

    // Verify the signature
    const verifyProcess = spawn('codesign', [
      '--verify',
      '--deep',
      '--strict',
      binaryPath,
    ]);
    await new Promise((resolve) => {
      verifyProcess.on('close', (code) => {
        if (code === 0) {
          console.log(`   ✅ ${binaryName} binary signature verified`);
        } else {
          console.warn(
            `   ⚠️  ${binaryName} binary signature verification failed (exit code: ${code})`,
          );
        }
        resolve(undefined); // Don't fail the build, just warn
      });
    });
  } catch (signError) {
    console.warn(
      `   ⚠️  Failed to sign ${binaryName} binary (continuing anyway):`,
      signError.message,
    );
    // Don't fail the build, signing might not be critical for development
  }
}

const config: ForgeConfig = {
  packagerConfig: {
    prune: true,
    asar: {
      // better-sqlite3 is a native module — native .node binaries cannot be loaded
      // from inside an ASAR archive, so they must be unpacked to disk.
      unpack: '**/better-sqlite3/**',
    },
    // No extension → electron-packager picks downlodr_icon.icns (mac) / .ico (win).
    icon: './src/Assets/Logo/downlodr_icon',
    name: 'Downlodr',
    executableName: 'Downlodr',
    extraResource,
    // macOS code signing — applied on macOS when a signing identity is available.
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
    // Notarization is handled manually after binary signatures are fixed.
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
    // NOTE: macOS DMGs are produced by Homebrew create-dmg in
    // scripts/build-with-create-dmg*.sh (the CI release path), not by a forge
    // maker. We intentionally omit MakerDMG to keep the @electron-forge tree at
    // a single coherent 7.6.0 version (see "resolutions" in package.json).

    // macOS PKG installer — needs a "Developer ID Installer" certificate.
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
            installerIcon: './src/Assets/Logo/downlodr_icon.ico',
            uninstallerIcon: './src/Assets/Logo/downlodr_icon.ico',
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

    // Cross-platform ZIP packages
    new MakerZIP({}, ['win32', 'linux']),
  ],

  hooks: {
    prePackage: async () => {
      // Verify the bundled FFmpeg meets the 8.0+ requirement (Whisper support).
      // Non-fatal: core downloading works on older FFmpeg; only transcription needs 8+.
      const ffmpegPath =
        process.platform === 'darwin'
          ? path.resolve(projectRoot, 'binaries/ffmpeg-arm64')
          : path.resolve(projectRoot, 'ffmpeg.exe');

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
            console.warn(
              `⚠ FFmpeg ${version} is older than 8.0 — transcription (Whisper) may be limited.`,
            );
          } else {
            console.log(`✓ FFmpeg ${version} verified`);
          }
        }
      } catch (error) {
        console.warn('⚠ Could not verify FFmpeg version');
      }
    },

    postPackage: async (forgeConfig, packageResult) => {
      for (const outputPath of packageResult.outputPaths) {
        // ----- macOS: bundle + sign yt-dlp and FFmpeg binaries -----
        if (process.platform === 'darwin') {
          try {
            const binaryName = 'yt-dlp';
            const macBinaryName = 'yt-dlp_macos';

            const sourcePaths = [
              path.resolve(projectRoot, binaryName),
              path.resolve(projectRoot, macBinaryName),
            ];

            let sourceBinaryPath: string | null = null;
            for (const sourcePath of sourcePaths) {
              if (
                await fs
                  .access(sourcePath)
                  .then(() => true)
                  .catch(() => false)
              ) {
                sourceBinaryPath = sourcePath;
                console.log(`   Found source binary: ${sourcePath}`);
                break;
              }
            }

            if (sourceBinaryPath) {
              const resourcesPath = path.join(outputPath, 'Resources');
              const destinationPaths = [
                path.join(resourcesPath, 'yt-dlp'),
                path.join(resourcesPath, macBinaryName),
              ];

              for (const destPath of destinationPaths) {
                try {
                  await fs.copyFile(sourceBinaryPath, destPath);
                  await fs.chmod(destPath, 0o755);
                  console.log(`   ✅ Copied + chmod ${destPath}`);

                  if (
                    process.env.APPLE_IDENTITY &&
                    !process.env.SKIP_CODE_SIGNING
                  ) {
                    await signBinaryWithEntitlements(
                      destPath,
                      'yt-dlp',
                      path.join(projectRoot, 'yt-dlp-entitlements.plist'),
                    );
                  }
                } catch (copyError) {
                  console.warn(
                    `   ⚠️  Failed to copy to ${destPath}:`,
                    copyError.message,
                  );
                }
              }
            } else {
              console.warn(
                `⚠️  No yt-dlp binary found in project root. Checked:`,
                sourcePaths,
              );
            }
          } catch (error) {
            console.error(`❌ Failed to process yt-dlp for ${outputPath}:`, error);
          }

          // Sign FFmpeg binaries when signing is enabled.
          if (process.env.APPLE_IDENTITY && !process.env.SKIP_CODE_SIGNING) {
            const resourcesPath = path.join(outputPath, 'Resources');
            const ffmpegCandidates = [
              { name: 'ffmpeg-arm64', path: path.join(resourcesPath, 'ffmpeg-arm64') },
              { name: 'ffmpeg-x64', path: path.join(resourcesPath, 'ffmpeg-x64') },
              { name: 'ffmpeg', path: path.join(resourcesPath, 'ffmpeg') },
            ];

            for (const candidate of ffmpegCandidates) {
              if (
                await fs
                  .access(candidate.path)
                  .then(() => true)
                  .catch(() => false)
              ) {
                try {
                  await fs.chmod(candidate.path, 0o755);
                  await signBinaryWithEntitlements(candidate.path, candidate.name);
                } catch (ffmpegError) {
                  console.warn(
                    `   ⚠️  Failed to process ${candidate.name}: ${ffmpegError.message}`,
                  );
                }
              }
            }
          }
        }

        // ----- Windows: copy yt-dlp.exe next to the executable -----
        if (process.platform === 'win32') {
          try {
            await fs.copyFile(
              path.resolve(projectRoot, 'yt-dlp.exe'),
              path.join(outputPath, 'yt-dlp.exe'),
            );
            console.log(`✓ Copied yt-dlp.exe to ${outputPath}`);
          } catch (error) {
            console.error(`Failed to copy yt-dlp.exe for ${outputPath}:`, error);
          }
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

    // Fuses conflict with macOS code signing, so enable them only when NOT signing.
    ...(process.env.APPLE_IDENTITY
      ? []
      : [
          new FusesPlugin({
            version: FuseVersion.V1,
            [FuseV1Options.RunAsNode]: false,
            [FuseV1Options.EnableCookieEncryption]: true,
            [FuseV1Options.EnableNodeOptionsEnvironmentVariable]: false,
            [FuseV1Options.EnableNodeCliInspectArguments]: false,
            [FuseV1Options.EnableEmbeddedAsarIntegrityValidation]: true,
            [FuseV1Options.OnlyLoadAppFromAsar]: true,
          }),
        ]),
  ],
};

export default config;
