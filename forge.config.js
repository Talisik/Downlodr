const { FusesPlugin } = require('@electron-forge/plugin-fuses');
const { VitePlugin } = require('@electron-forge/plugin-vite');
const { FuseV1Options, FuseVersion } = require('@electron/fuses');

module.exports = {
  packagerConfig: {
    asar: true,
    icon: './src/Assets/AppLogo/256x256',
    name: 'Downlodr',
    executableName: 'downlodr',
    extraResource: [
      './src/Assets/AppLogo',
      './src/Assets/Logo',
      './INSTALL_LINUX.md'
    ],
  },
  rebuildConfig: {},
  makers: [
    {
      name: '@electron-forge/maker-zip',
      platforms: ['darwin', 'win32', 'linux']
    },
    {
      name: '@electron-forge/maker-deb',
      platforms: ['linux'],
      config: {
        options: {
          maintainer: 'Downlodr Project Team <downlodr@email.com>',
          homepage: 'https://github.com/Talisik/Downlodr',
          description: 'Downlodr is a powerful, user-friendly video downloading solution that supports over 1,800 platforms',
          productDescription: 'A versatile video downloader with built-in yt-dlp and ffmpeg support',
          section: 'net',
          priority: 'optional',
          icon: './src/Assets/AppLogo/systemTrayIcon.png',
          categories: [
            'AudioVideo',
            'Video',
            'Network'
          ],
          mimeType: [
            'x-scheme-handler/https',
            'x-scheme-handler/http'
          ]
        }
      }
    },
    {
      name: '@electron-forge/maker-rpm',
      platforms: ['linux'],
      config: {
        options: {
          homepage: 'https://github.com/Talisik/Downlodr',
          description: 'Downlodr is a powerful, user-friendly video downloading solution that supports over 1,800 platforms',
          productDescription: 'A versatile video downloader with built-in yt-dlp and ffmpeg support',
          license: 'MIT',
          group: 'Applications/Internet',
          icon: './src/Assets/AppLogo/systemTrayIcon.png',
          categories: [
            'AudioVideo',
            'Video',
            'Network'
          ]
        }
      }
    }
  ],
  hooks: {
    postPackage: async (forgeConfig, packageResult) => {
      const fs = require('fs/promises');
      const path = require('path');
      
      for (const outputPath of packageResult.outputPaths) {
        try {
          const isLinux = outputPath.includes('linux');
          const isWindows = outputPath.includes('win32');
          
          if (isLinux) {
            // Copy Linux binaries
            const binDir = path.join(outputPath, 'resources', 'bin');
            await fs.mkdir(binDir, { recursive: true });
            
            try {
              // Copy yt-dlp Linux binary
              const ytdlpSource = path.resolve(process.cwd(), 'binaries', 'linux', 'yt-dlp');
              const ytdlpTarget = path.join(binDir, 'yt-dlp');
              await fs.copyFile(ytdlpSource, ytdlpTarget);
              await fs.chmod(ytdlpTarget, '755');
              
              // Copy ffmpeg Linux binary
              const ffmpegSource = path.resolve(process.cwd(), 'binaries', 'linux', 'ffmpeg');
              const ffmpegTarget = path.join(binDir, 'ffmpeg');
              await fs.copyFile(ffmpegSource, ffmpegTarget);
              await fs.chmod(ffmpegTarget, '755');
              
              // Copy ffprobe Linux binary
              const ffprobeSource = path.resolve(process.cwd(), 'binaries', 'linux', 'ffprobe');
              const ffprobeTarget = path.join(binDir, 'ffprobe');
              await fs.copyFile(ffprobeSource, ffprobeTarget);
              await fs.chmod(ffprobeTarget, '755');
              
              console.log(`✅ Copied Linux binaries to ${outputPath}`);
            } catch (error) {
              console.log(`⚠️  Linux binaries not found, skipping copy: ${error.message}`);
            }
          } else if (isWindows) {
            try {
              // Copy Windows yt-dlp binary (existing functionality)
              await fs.copyFile(
                path.resolve(process.cwd(), 'yt-dlp.exe'),
                path.join(outputPath, 'yt-dlp.exe'),
              );
              console.log(`✅ Copied Windows yt-dlp to ${outputPath}`);
            } catch (error) {
              console.log(`⚠️  Windows yt-dlp not found, skipping copy: ${error.message}`);
            }
          }
        } catch (error) {
          console.error(`❌ Failed to copy binaries for ${outputPath}:`, error);
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