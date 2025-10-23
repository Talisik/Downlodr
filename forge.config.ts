import { MakerPKG } from '@electron-forge/maker-pkg';
import { MakerZIP } from '@electron-forge/maker-zip';
import { MakerDMG } from '@electron-forge/maker-dmg';
import { MakerDeb } from '@electron-forge/maker-deb';
import { MakerRpm } from '@electron-forge/maker-rpm';
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

// Helper function to get platform-specific output directory
const getOutputPath = (platform: string) => {
  switch (platform) {
    case 'linux':
      return 'out/make-linux';
    case 'darwin':
      return 'out/make';
    case 'win32':
      return 'out/make-windows';
    default:
      return 'out/make';
  }
};

// Helper function to get platform-compatible makers
const getPlatformMakers = () => {
  const makers = [];

  // Always include these cross-platform makers
  makers.push(
    // macOS makers (only when on macOS or building for macOS)
    ...(process.platform === 'darwin'
      ? [
          new MakerDMG({
            icon: './src/Assets/AppLogo/icon.icns',
            name: 'Downlodr',
            title: 'Install Downlodr',
            format: 'ULFO',
          }),
          new MakerPKG({
            identity:
              process.env.APPLE_INSTALLER_IDENTITY ||
              process.env.APPLE_IDENTITY ||
              null,
          }),
        ]
      : []),

    // Windows makers
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
            perMachine: false,
            include: './installer.nsh',
          },
        };
      },
    }),

    // Cross-platform ZIP packages
    new MakerZIP({}, ['darwin', 'win32', 'linux']),
  );

  // Linux-specific makers (only when on Linux for native builds)
  if (process.platform === 'linux') {
    makers.push(
      new MakerDeb({
        options: {
          maintainer: 'Downlodr Team',
          homepage: 'https://github.com/erickluna-dev/Downlodr',
          description:
            'A powerful desktop application for downloading videos and audio from various platforms',
          genericName: 'Video Downloader',
          categories: ['AudioVideo', 'Network'],
          icon: './src/Assets/AppLogo/icon.png',
          mimeType: ['x-scheme-handler/http', 'x-scheme-handler/https'],
        },
      }),
      new MakerRpm({
        options: {
          name: 'downlodr',
          productName: 'Downlodr',
          description:
            'A desktop application for downloading videos and audio from various platforms including YouTube, with format conversion capabilities.',
          homepage: 'https://github.com/erickluna-dev/Downlodr',
          license: 'MIT',
          categories: ['AudioVideo', 'Network'],
          icon: './src/Assets/AppLogo/icon.png',
        },
      }),
    );
  }

  return makers;
};

const config: ForgeConfig = {
  packagerConfig: {
    asar: true,
    icon: './src/Assets/AppLogo/icon', // Will use icon.icns on macOS, icon.ico on Windows
    name: 'Downlodr',
    executableName: 'Downlodr',
    extraResource: [
      './src/Assets/AppLogo',
      // Platform-specific binaries
      ...(process.platform === 'darwin' ? ['./yt-dlp_macos'] : []),
      ...(process.platform === 'linux' ? ['./yt-dlp_linux'] : []),
      ...(process.platform === 'win32' ? ['./yt-dlp.exe'] : []),
      // Enhanced FFmpeg bundling with architecture-specific binaries
      './binaries/ffmpeg-arm64', // Apple Silicon native
      './binaries/ffmpeg-x64', // Intel native
      ...(process.platform === 'linux' ? ['./binaries/ffmpeg-linux'] : []), // Linux x64
    ],
    // Explicit macOS app bundle configuration
    ...(process.platform === 'darwin'
      ? {
          osxUniversal: {
            x64ArchFiles: '*',
          },
          extendInfo: {
            CFBundleIconFile: 'icon.icns',
            CFBundleIconName: 'icon',
          },
        }
      : {}),
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
  makers: getPlatformMakers(),
  hooks: {
    postMake: async (forgeConfig, makeResults) => {
      const fs = await import('fs/promises');
      const path = await import('path');

      // Process each make result
      for (const makeResult of makeResults) {
        for (let i = 0; i < makeResult.artifacts.length; i++) {
          const artifact = makeResult.artifacts[i];

          if (artifact.endsWith('.zip')) {
            // Fix ZIP file naming to use correct platform suffix
            if (
              artifact.includes('-exp-macos.zip') &&
              !artifact.includes('-darwin-')
            ) {
              const artifactDir = path.dirname(artifact);
              const platform = makeResult.platform;

              // Create new filename with correct platform
              const newFilename = path
                .basename(artifact)
                .replace('-exp-macos.zip', `-exp-${platform}.zip`);
              const newPath = path.join(artifactDir, newFilename);

              try {
                await fs.rename(artifact, newPath);
                console.log(
                  `✅ Renamed ${path.basename(artifact)} to ${newFilename}`,
                );

                // Update the artifact path in the result
                makeResult.artifacts[i] = newPath;
              } catch (error) {
                console.warn(
                  `⚠️  Failed to rename ${artifact}:`,
                  error.message,
                );
              }
            }
          }
        }
      }

      return makeResults;
    },
    postPackage: async (forgeConfig, packageResult) => {
      for (const outputPath of packageResult.outputPaths) {
        try {
          // Generate README content for Linux installation
          const generateLinuxReadme = (platform: string) => {
            return `Downlodr - Video and Audio Downloader
========================================

Thank you for downloading Downlodr for ${platform}!

SYSTEM REQUIREMENTS
==================
- ${
              platform === 'linux'
                ? 'Ubuntu 18.04+ or equivalent Linux distribution'
                : 'Compatible operating system'
            }
- 64-bit architecture (x86_64)
- At least 2GB RAM
- 500MB free disk space

INSTALLATION INSTRUCTIONS
========================

Quick Installation (Recommended):
1. Extract this ZIP file to a folder of your choice (e.g., ~/Downloads/Downlodr)
   Example: unzip Downlodr-${platform}-x64-*.zip -d ~/Downloads/

2. Navigate to the extracted folder:
   cd ~/Downloads/Downlodr-${platform}-x64

3. Make the application executable:
   chmod +x Downlodr

4. Run Downlodr:
   ./Downlodr

Optional: System-wide Installation:
1. Move the extracted folder to /opt/:
   sudo mv ~/Downloads/Downlodr-${platform}-x64 /opt/downlodr

2. Create a symbolic link for global access:
   sudo ln -s /opt/downlodr/Downlodr /usr/local/bin/downlodr

3. Create a desktop entry (optional):
   Create file: ~/.local/share/applications/downlodr.desktop
   Content:
   [Desktop Entry]
   Name=Downlodr
   Exec=/opt/downlodr/Downlodr
   Icon=/opt/downlodr/resources/app.asar.unpacked/src/Assets/AppLogo/256x256.png
   Type=Application
   Categories=AudioVideo;Network;

TROUBLESHOOTING
==============

If you encounter permission errors:
- Ensure the executable has proper permissions: chmod +x Downlodr
- Run with sudo if installation requires administrator privileges

If the app doesn't start:
- Check that you have all required system libraries
- Try running from terminal to see error messages: ./Downlodr

If downloads fail:
- Ensure you have internet connectivity
- Check that the destination folder has write permissions
- Some video sites may require specific configurations

DEPENDENCIES
============
Downlodr includes all necessary dependencies:
- yt-dlp (YouTube downloader)
- FFmpeg (video/audio processing)
- All Node.js libraries

No additional software installation is required.

FEATURES
========
- Download videos and audio from 1800+ websites
- Multiple format support (MP4, MP3, WebM, etc.)
- Batch downloads and playlists
- Format conversion capabilities
- Plugin system for extended functionality

SUPPORT
=======
- Documentation: https://github.com/erickluna-dev/Downlodr
- Issues: https://github.com/erickluna-dev/Downlodr/issues
- License: MIT

Enjoy using Downlodr!
`;
          };

          // Create README.txt for Linux and Windows builds
          if (
            process.platform !== 'darwin' ||
            outputPath.includes('linux') ||
            outputPath.includes('win32')
          ) {
            const platform = outputPath.includes('linux')
              ? 'linux'
              : outputPath.includes('win32')
              ? 'win32'
              : 'linux';

            const readmeContent = generateLinuxReadme(platform);
            const readmePath = path.join(outputPath, 'README.txt');

            try {
              await fs.writeFile(readmePath, readmeContent, 'utf8');
              console.log(
                `📄 Created README.txt for ${platform} in ${outputPath}`,
              );
            } catch (readmeError) {
              console.warn(
                `⚠️  Failed to create README.txt:`,
                readmeError.message,
              );
            }
          }

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
