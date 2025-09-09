/**
 * Video Compatibility Validator
 * Validates downloaded video files for QuickTime compatibility
 * and provides automatic re-encoding if needed
 */

import { spawn } from 'child_process';
import * as path from 'path';
import * as fs from 'fs';

export interface VideoCodecInfo {
  videoCodec: string;
  audioCodec: string;
  container: string;
  isQuickTimeCompatible: boolean;
  filePath: string;
  duration?: number;
  resolution?: string;
}

export interface ValidationResult {
  isCompatible: boolean;
  codecInfo: VideoCodecInfo;
  issues: string[];
  canAutoFix: boolean;
  reencodeNeeded: boolean;
}

export interface ReencodeOptions {
  inputPath: string;
  outputPath?: string;
  quality?: 'high' | 'medium' | 'low';
  preserveOriginal?: boolean;
}

export class VideoCompatibilityValidator {
  private static ffmpegPath: string;

  static setFFmpegPath(path: string) {
    this.ffmpegPath = path;
  }

  /**
   * Analyze video file to determine codec compatibility
   */
  static async analyzeVideoFile(filePath: string): Promise<VideoCodecInfo> {
    return new Promise((resolve, reject) => {
      if (!fs.existsSync(filePath)) {
        reject(new Error(`File not found: ${filePath}`));
        return;
      }

      if (!this.ffmpegPath || !fs.existsSync(this.ffmpegPath)) {
        reject(new Error('FFmpeg binary not found'));
        return;
      }

      const ffprobe = spawn(this.ffmpegPath, [
        '-hide_banner',
        '-v',
        'quiet',
        '-print_format',
        'json',
        '-show_format',
        '-show_streams',
        filePath,
      ]);

      let output = '';
      let errorOutput = '';

      ffprobe.stdout.on('data', (data) => {
        output += data.toString();
      });

      ffprobe.stderr.on('data', (data) => {
        errorOutput += data.toString();
      });

      ffprobe.on('close', (code) => {
        if (code !== 0) {
          reject(new Error(`FFprobe failed: ${errorOutput}`));
          return;
        }

        try {
          const info = JSON.parse(output);
          const videoStream = info.streams?.find(
            (s: any) => s.codec_type === 'video',
          );
          const audioStream = info.streams?.find(
            (s: any) => s.codec_type === 'audio',
          );

          const codecInfo: VideoCodecInfo = {
            videoCodec: videoStream?.codec_name || 'unknown',
            audioCodec: audioStream?.codec_name || 'unknown',
            container: info.format?.format_name || 'unknown',
            filePath,
            duration: parseFloat(info.format?.duration || '0'),
            resolution: videoStream
              ? `${videoStream.width}x${videoStream.height}`
              : undefined,
            isQuickTimeCompatible: this.isQuickTimeCompatibleCodec(
              videoStream?.codec_name,
              audioStream?.codec_name,
              info.format?.format_name,
            ),
          };

          resolve(codecInfo);
        } catch (parseError) {
          reject(
            new Error(`Failed to parse FFprobe output: ${parseError.message}`),
          );
        }
      });

      ffprobe.on('error', (error) => {
        reject(new Error(`FFprobe process error: ${error.message}`));
      });
    });
  }

  /**
   * Validate if video is QuickTime compatible
   */
  static async validateVideoCompatibility(
    filePath: string,
  ): Promise<ValidationResult> {
    try {
      const codecInfo = await this.analyzeVideoFile(filePath);
      const issues: string[] = [];
      const canAutoFix = true;

      // Check video codec compatibility
      if (!this.isCompatibleVideoCodec(codecInfo.videoCodec)) {
        issues.push(
          `Video codec '${codecInfo.videoCodec}' is not QuickTime compatible`,
        );
      }

      // Check audio codec compatibility
      if (!this.isCompatibleAudioCodec(codecInfo.audioCodec)) {
        issues.push(
          `Audio codec '${codecInfo.audioCodec}' is not QuickTime compatible`,
        );
      }

      // Check container format
      if (!this.isCompatibleContainer(codecInfo.container)) {
        issues.push(
          `Container format '${codecInfo.container}' has limited QuickTime support`,
        );
      }

      const isCompatible = issues.length === 0;
      const reencodeNeeded = !isCompatible && canAutoFix;

      return {
        isCompatible,
        codecInfo,
        issues,
        canAutoFix,
        reencodeNeeded,
      };
    } catch (error) {
      return {
        isCompatible: false,
        codecInfo: {
          videoCodec: 'unknown',
          audioCodec: 'unknown',
          container: 'unknown',
          isQuickTimeCompatible: false,
          filePath,
        },
        issues: [`Analysis failed: ${error.message}`],
        canAutoFix: false,
        reencodeNeeded: false,
      };
    }
  }

  /**
   * Re-encode video to QuickTime-compatible format
   */
  static async reencodeForQuickTime(options: ReencodeOptions): Promise<{
    success: boolean;
    outputPath?: string;
    error?: string;
  }> {
    const { inputPath, preserveOriginal = true } = options;

    if (!fs.existsSync(inputPath)) {
      return { success: false, error: 'Input file not found' };
    }

    if (!this.ffmpegPath || !fs.existsSync(this.ffmpegPath)) {
      return { success: false, error: 'FFmpeg binary not found' };
    }

    // Generate output path
    const inputDir = path.dirname(inputPath);
    const inputExt = path.extname(inputPath);
    const inputName = path.basename(inputPath, inputExt);
    const outputPath =
      options.outputPath ||
      path.join(inputDir, `${inputName}_quicktime_compatible.mp4`);

    // Quality settings
    const qualitySettings = this.getQualitySettings(
      options.quality || 'medium',
    );

    const ffmpegArgs = [
      '-i',
      inputPath,
      '-c:v',
      'libx264',
      '-preset',
      qualitySettings.preset,
      '-crf',
      qualitySettings.crf.toString(),
      '-c:a',
      'aac',
      '-b:a',
      qualitySettings.audioBitrate,
      '-movflags',
      '+faststart', // Optimize for web/streaming
      '-pix_fmt',
      'yuv420p', // Ensure compatibility
      '-y', // Overwrite output file
      outputPath,
    ];

    return new Promise((resolve) => {
      console.log(
        `🔄 Re-encoding for QuickTime compatibility: ${path.basename(
          inputPath,
        )}`,
      );
      console.log(`📊 Quality: ${options.quality || 'medium'}`);
      console.log(`📁 Output: ${path.basename(outputPath)}`);

      const ffmpeg = spawn(this.ffmpegPath, ffmpegArgs);
      let errorOutput = '';

      ffmpeg.stderr.on('data', (data) => {
        errorOutput += data.toString();
        // Log progress if needed
        const progressMatch = data.toString().match(/time=(\d{2}:\d{2}:\d{2})/);
        if (progressMatch) {
          console.log(`⏱️  Re-encoding progress: ${progressMatch[1]}`);
        }
      });

      ffmpeg.on('close', (code) => {
        if (code === 0 && fs.existsSync(outputPath)) {
          console.log(`✅ Re-encoding completed: ${path.basename(outputPath)}`);

          // Optionally remove original file
          if (!preserveOriginal) {
            try {
              fs.unlinkSync(inputPath);
              console.log(
                `🗑️  Removed original file: ${path.basename(inputPath)}`,
              );
            } catch (removeError) {
              console.warn(
                `⚠️  Could not remove original file: ${removeError.message}`,
              );
            }
          }

          resolve({ success: true, outputPath });
        } else {
          console.error(`❌ Re-encoding failed with code ${code}`);
          console.error(`Error output: ${errorOutput}`);
          resolve({
            success: false,
            error: `FFmpeg process failed: ${errorOutput}`,
          });
        }
      });

      ffmpeg.on('error', (error) => {
        console.error(`❌ Re-encoding process error: ${error.message}`);
        resolve({ success: false, error: error.message });
      });
    });
  }

  /**
   * Auto-fix video compatibility issues
   */
  static async autoFixCompatibility(filePath: string): Promise<{
    success: boolean;
    outputPath?: string;
    wasFixed: boolean;
    error?: string;
  }> {
    try {
      // First, validate the current file
      const validation = await this.validateVideoCompatibility(filePath);

      if (validation.isCompatible) {
        return {
          success: true,
          outputPath: filePath,
          wasFixed: false,
        };
      }

      if (!validation.canAutoFix) {
        return {
          success: false,
          wasFixed: false,
          error: `Cannot auto-fix: ${validation.issues.join(', ')}`,
        };
      }

      // Re-encode the file
      const reencodeResult = await this.reencodeForQuickTime({
        inputPath: filePath,
        quality: 'medium',
        preserveOriginal: true,
      });

      if (reencodeResult.success && reencodeResult.outputPath) {
        // Validate the re-encoded file
        const newValidation = await this.validateVideoCompatibility(
          reencodeResult.outputPath,
        );

        return {
          success: true,
          outputPath: reencodeResult.outputPath,
          wasFixed: newValidation.isCompatible,
          error: newValidation.isCompatible
            ? undefined
            : 'Re-encoding did not fix all issues',
        };
      }

      return {
        success: false,
        wasFixed: false,
        error: reencodeResult.error,
      };
    } catch (error) {
      return {
        success: false,
        wasFixed: false,
        error: error.message,
      };
    }
  }

  // Private helper methods
  private static isQuickTimeCompatibleCodec(
    videoCodec?: string,
    audioCodec?: string,
    container?: string,
  ): boolean {
    const isVideoCompatible = this.isCompatibleVideoCodec(videoCodec);
    const isAudioCompatible = this.isCompatibleAudioCodec(audioCodec);
    const isContainerCompatible = this.isCompatibleContainer(container);

    return isVideoCompatible && isAudioCompatible && isContainerCompatible;
  }

  private static isCompatibleVideoCodec(codec?: string): boolean {
    if (!codec) return false;
    const compatibleCodecs = ['h264', 'avc', 'mpeg4', 'h263'];
    return compatibleCodecs.some((compatible) =>
      codec.toLowerCase().includes(compatible),
    );
  }

  private static isCompatibleAudioCodec(codec?: string): boolean {
    if (!codec) return false;
    const compatibleCodecs = ['aac', 'mp3', 'alac', 'pcm'];
    return compatibleCodecs.some((compatible) =>
      codec.toLowerCase().includes(compatible),
    );
  }

  private static isCompatibleContainer(container?: string): boolean {
    if (!container) return false;
    const compatibleContainers = ['mp4', 'mov', 'm4v', 'quicktime'];
    return compatibleContainers.some((compatible) =>
      container.toLowerCase().includes(compatible),
    );
  }

  private static getQualitySettings(quality: 'high' | 'medium' | 'low') {
    switch (quality) {
      case 'high':
        return { preset: 'slow', crf: 18, audioBitrate: '192k' };
      case 'low':
        return { preset: 'fast', crf: 28, audioBitrate: '96k' };
      case 'medium':
      default:
        return { preset: 'medium', crf: 23, audioBitrate: '128k' };
    }
  }
}
