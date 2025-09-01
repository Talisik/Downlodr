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
import { spawn } from 'child_process';

// Declare __dirname for TypeScript in CommonJS mode
declare const __dirname: string;

// Helper function to sign binaries with proper entitlements
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
    asar: true,
    icon: './src/Assets/AppLogo/icon', // Will use icon.icns on macOS, icon.ico on Windows
    name: 'Downlodr',
    executableName: 'Downlodr',
    extraResource: [
      './src/Assets/AppLogo',
      './yt-dlp',
      './yt-dlp_macos',
      // Enhanced FFmpeg bundling with architecture-specific binaries
      './binaries/ffmpeg-arm64', // Apple Silicon native
      './binaries/ffmpeg-x64', // Intel native
      './ffmpeg', // Current default binary
    ],
    // Simplified macOS code signing - always applied on macOS when certificate is available
    osxSign:
      process.env.APPLE_IDENTITY && !process.env.SKIP_CODE_SIGNING
        ? ({
            identity: process.env.APPLE_IDENTITY,
            'hardened-runtime': true,
            'gatekeeper-assess': false,
            entitlements: path.join(__dirname, 'entitlements.plist'),
            'entitlements-inherit': path.join(__dirname, 'entitlements.plist'),
            'signature-flags': 'library',
            'pre-embed-provisioning-profile': false,
          } as any)
        : undefined,
    // Disable automatic notarization - we'll handle it manually after binary fixes
    // Note: We need to fix binary signatures before notarization
    osxNotarize: undefined,
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
          // Skip signing for non-macOS platforms
          if (process.platform !== 'darwin') {
            console.log(
              `📦 Skipping code signing for platform: ${process.platform}`,
            );
            continue;
          }

          // Binary names for macOS
          const binaryName = 'yt-dlp';
          const macBinaryName = 'yt-dlp_macos';

          console.log(`📦 Processing yt-dlp binary for ${outputPath}`);
          console.log(`   Platform: ${process.platform}`);
          console.log(`   Binary name: ${binaryName}`);

          // Define potential source paths for the binary
          const sourcePaths = [
            path.resolve(__dirname, binaryName),
            path.resolve(__dirname, macBinaryName),
          ];

          // Find the first existing source binary
          let sourceBinaryPath = null;
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

          if (!sourceBinaryPath) {
            console.warn(
              `⚠️  No yt-dlp binary found in project root. Checked paths:`,
              sourcePaths,
            );
            continue;
          }

          // Define destination paths in the packaged app
          const resourcesPath = path.join(outputPath, 'Resources');
          const destinationPaths = [
            path.join(resourcesPath, 'yt-dlp'),
            path.join(resourcesPath, macBinaryName),
          ];

          // Copy binary to both destination names to ensure compatibility
          for (const destPath of destinationPaths) {
            try {
              await fs.copyFile(sourceBinaryPath, destPath);

              // Make the binary executable on macOS
              await fs.chmod(destPath, 0o755);
              console.log(`   ✅ Made ${destPath} executable`);

              console.log(`   ✅ Copied to ${destPath}`);

              // Sign the yt-dlp binary on macOS if we have a signing identity
              if (
                process.platform === 'darwin' &&
                process.env.APPLE_IDENTITY &&
                !process.env.SKIP_CODE_SIGNING
              ) {
                await signBinaryWithEntitlements(
                  destPath,
                  'yt-dlp',
                  path.join(__dirname, 'yt-dlp-entitlements.plist'),
                );
              }
            } catch (copyError) {
              console.warn(
                `   ⚠️  Failed to copy to ${destPath}:`,
                copyError.message,
              );
            }
          }

          // Also copy to the main output directory as fallback
          const fallbackPath = path.join(outputPath, binaryName);
          try {
            await fs.copyFile(sourceBinaryPath, fallbackPath);
            await fs.chmod(fallbackPath, 0o755);
            console.log(`   ✅ Copied fallback to ${fallbackPath}`);
          } catch (fallbackError) {
            console.warn(
              `   ⚠️  Failed to create fallback binary:`,
              fallbackError.message,
            );
          }
        } catch (error) {
          console.error(
            `❌ Failed to process yt-dlp for ${outputPath}:`,
            error,
          );
        }

        // Also process and sign FFmpeg binaries if we're on macOS with signing enabled
        if (
          process.platform === 'darwin' &&
          process.env.APPLE_IDENTITY &&
          !process.env.SKIP_CODE_SIGNING
        ) {
          console.log(`🔧 Processing FFmpeg binaries for ${outputPath}`);

          const resourcesPath = path.join(outputPath, 'Resources');
          const ffmpegCandidates = [
            {
              name: 'ffmpeg-arm64',
              path: path.join(resourcesPath, 'ffmpeg-arm64'),
            },
            {
              name: 'ffmpeg-x64',
              path: path.join(resourcesPath, 'ffmpeg-x64'),
            },
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
                console.log(
                  `   📦 Processing ${candidate.name} at ${candidate.path}`,
                );

                // Make sure it's executable
                await fs.chmod(candidate.path, 0o755);
                console.log(`   ✅ Made ${candidate.name} executable`);

                // Sign the FFmpeg binary (no special entitlements needed)
                await signBinaryWithEntitlements(
                  candidate.path,
                  candidate.name,
                );
              } catch (ffmpegError) {
                console.warn(
                  `   ⚠️  Failed to process ${candidate.name}: ${ffmpegError.message}`,
                );
              }
            } else {
              console.log(
                `   ❌ ${candidate.name} not found at ${candidate.path}`,
              );
            }
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
    // Only enable Fuses plugin when NOT code signing to avoid conflicts
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
