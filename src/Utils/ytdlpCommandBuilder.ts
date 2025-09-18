/**
 * Build proper yt-dlp command arguments for downloading and merging
 */

export interface YTDLPDownloadArgs {
  url: string;
  outputFilepath: string;
  videoFormat?: string;
  remuxVideo?: string;
  audioExt?: string;
  audioFormatId?: string;
  limitRate?: string;
}

/**
 * Build yt-dlp command arguments ensuring proper merge settings
 */
export function buildYTDLPArgs(args: YTDLPDownloadArgs): string[] {
  const cmdArgs: string[] = [];
  
  // Add URL
  cmdArgs.push(args.url);
  
  // Output file
  cmdArgs.push('-o', args.outputFilepath);
  
  // Format selection
  if (args.videoFormat && args.audioFormatId) {
    // Download best video and audio, then merge
    cmdArgs.push('-f', `${args.videoFormat}+${args.audioFormatId}/best`);
    
    // Ensure merge happens with the desired output format
    if (args.remuxVideo) {
      cmdArgs.push('--merge-output-format', args.remuxVideo);
    }
  } else if (args.videoFormat) {
    // Video only
    cmdArgs.push('-f', args.videoFormat);
  } else {
    // Default: best quality
    cmdArgs.push('-f', 'best');
  }
  
  // Rate limiting
  if (args.limitRate) {
    cmdArgs.push('--limit-rate', args.limitRate);
  }
  
  // Ensure FFmpeg is used for merging
  cmdArgs.push('--prefer-ffmpeg');
  
  // Keep intermediate files for debugging (optional)
  // cmdArgs.push('--keep-video');
  
  // Verbose output for debugging
  cmdArgs.push('--verbose');
  
  return cmdArgs;
}

/**
 * Get FFmpeg location for yt-dlp
 */
export function getFFmpegLocation(): string {
  // Use environment variable if set
  if (process.env.FFMPEG_PATH) {
    return process.env.FFMPEG_PATH;
  }
  
  // Fallback to common locations
  if (process.platform === 'darwin') {
    return '/opt/homebrew/bin/ffmpeg';
  }
  
  return 'ffmpeg';
}
