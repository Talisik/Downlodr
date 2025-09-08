/**
 * Codec compatibility utilities for ensuring media player compatibility
 * Especially focused on QuickTime Player compatibility for MP4 files
 */

import { VideoFormat } from '@/schema/metadata';

export interface CodecCompatibilityInfo {
  isQuickTimeCompatible: boolean;
  preferredFormat: string;
  compatibilityReason: string;
  suggestedCodecs?: {
    video?: string;
    audio?: string;
  };
}

export class CodecCompatibilityService {
  /**
   * QuickTime-compatible video codecs
   */
  private static readonly QUICKTIME_VIDEO_CODECS = [
    'avc1', // H.264 (most compatible)
    'h264', // H.264 alternative naming
    'mp4v', // MPEG-4 Part 2
    'hvc1', // H.265/HEVC (newer versions)
    'hev1', // H.265/HEVC alternative
  ];

  /**
   * QuickTime-compatible audio codecs
   */
  private static readonly QUICKTIME_AUDIO_CODECS = [
    'mp4a', // AAC (most compatible)
    'aac',  // AAC alternative naming
    'mp3',  // MP3
    'alac', // Apple Lossless
    'lpcm', // Linear PCM
  ];

  /**
   * Incompatible codecs that cause playback issues
   */
  private static readonly INCOMPATIBLE_CODECS = [
    'vp8', 'vp9', 'vp10', // VP codecs
    'av01', 'av1',        // AV1 codec
    'opus',               // Opus audio
    'vorbis',            // Vorbis audio
    'theora',            // Theora video
  ];

  /**
   * Check if a video format is QuickTime compatible
   */
  static isQuickTimeCompatible(format: VideoFormat): CodecCompatibilityInfo {
    const vcodec = format.vcodec?.toLowerCase() || '';
    const acodec = format.acodec?.toLowerCase() || '';
    const ext = format.ext?.toLowerCase() || '';

    // Check for explicitly incompatible codecs
    const hasIncompatibleCodec = this.INCOMPATIBLE_CODECS.some(incompatible =>
      vcodec.includes(incompatible) || acodec.includes(incompatible)
    );

    if (hasIncompatibleCodec) {
      return {
        isQuickTimeCompatible: false,
        preferredFormat: 'mp4',
        compatibilityReason: 'Contains incompatible codec (VP8/VP9/AV1/Opus)',
        suggestedCodecs: {
          video: 'avc1',
          audio: 'mp4a'
        }
      };
    }

    // Check for QuickTime-compatible codecs
    const hasCompatibleVideo = vcodec === 'none' || 
      this.QUICKTIME_VIDEO_CODECS.some(compatible => vcodec.includes(compatible));
    
    const hasCompatibleAudio = acodec === 'none' || 
      this.QUICKTIME_AUDIO_CODECS.some(compatible => acodec.includes(compatible));

    // For MP4 container, both video and audio should be compatible
    if (ext === 'mp4') {
      const isFullyCompatible = hasCompatibleVideo && hasCompatibleAudio;
      
      return {
        isQuickTimeCompatible: isFullyCompatible,
        preferredFormat: 'mp4',
        compatibilityReason: isFullyCompatible 
          ? 'H.264/AAC in MP4 container - fully compatible'
          : `Incompatible ${!hasCompatibleVideo ? 'video' : 'audio'} codec in MP4`,
        suggestedCodecs: isFullyCompatible ? undefined : {
          video: hasCompatibleVideo ? undefined : 'avc1',
          audio: hasCompatibleAudio ? undefined : 'mp4a'
        }
      };
    }

    // For other containers, evaluate based on codec compatibility
    return {
      isQuickTimeCompatible: hasCompatibleVideo && hasCompatibleAudio,
      preferredFormat: 'mp4',
      compatibilityReason: ext === 'webm' || ext === 'mkv' 
        ? 'Container format may have limited QuickTime support'
        : 'Format compatibility depends on specific codecs',
      suggestedCodecs: {
        video: 'avc1',
        audio: 'mp4a'
      }
    };
  }

  /**
   * Find the best QuickTime-compatible format from available formats
   */
  static findBestQuickTimeFormat(formats: VideoFormat[]): VideoFormat | null {
    // Priority 1: MP4 with H.264 + AAC
    let bestFormat = formats.find(format => {
      const compatibility = this.isQuickTimeCompatible(format);
      return compatibility.isQuickTimeCompatible && 
             format.ext === 'mp4' &&
             format.vcodec?.includes('avc1') &&
             format.acodec?.includes('mp4a');
    });

    if (bestFormat) return bestFormat;

    // Priority 2: Any MP4 with compatible codecs
    bestFormat = formats.find(format => {
      const compatibility = this.isQuickTimeCompatible(format);
      return compatibility.isQuickTimeCompatible && format.ext === 'mp4';
    });

    if (bestFormat) return bestFormat;

    // Priority 3: Any format with compatible codecs
    bestFormat = formats.find(format => {
      const compatibility = this.isQuickTimeCompatible(format);
      return compatibility.isQuickTimeCompatible;
    });

    return bestFormat || null;
  }

  /**
   * Filter formats to only QuickTime-compatible ones
   */
  static filterQuickTimeCompatibleFormats(formats: VideoFormat[]): VideoFormat[] {
    return formats.filter(format => {
      const compatibility = this.isQuickTimeCompatible(format);
      return compatibility.isQuickTimeCompatible;
    });
  }

  /**
   * Get preferred format combination for QuickTime compatibility
   */
  static getPreferredQuickTimeFormatCombination(
    videoFormats: VideoFormat[],
    audioFormats: VideoFormat[]
  ): { video?: VideoFormat; audio?: VideoFormat; combined?: string } | null {
    // Find best H.264 video format
    const h264Formats = videoFormats.filter(format => 
      format.vcodec?.includes('avc1') || format.vcodec?.includes('h264')
    ).sort((a, b) => {
      // Prefer higher resolution
      const aHeight = a.height || 0;
      const bHeight = b.height || 0;
      return bHeight - aHeight;
    });

    // Find best AAC audio format
    const aacFormats = audioFormats.filter(format =>
      format.acodec?.includes('mp4a') || format.acodec?.includes('aac')
    ).sort((a, b) => {
      // Prefer higher bitrate
      const aBitrate = a.abr || a.tbr || 0;
      const bBitrate = b.abr || b.tbr || 0;
      return bBitrate - aBitrate;
    });

    const bestVideo = h264Formats[0];
    const bestAudio = aacFormats[0];

    if (bestVideo && bestAudio) {
      return {
        video: bestVideo,
        audio: bestAudio,
        combined: `${bestVideo.format_id}+${bestAudio.format_id}`
      };
    }

    return null;
  }

  /**
   * Validate if a format combination is QuickTime compatible
   */
  static validateFormatCombination(args: {
    videoFormat: string;
    remuxVideo: string;
    audioExt: string;
    audioFormatId: string;
  }): { isValid: boolean; issues: string[]; suggestions: string[] } {
    const issues: string[] = [];
    const suggestions: string[] = [];

    // Check container format
    if (args.remuxVideo !== 'mp4') {
      issues.push(`Container format '${args.remuxVideo}' may not be compatible with QuickTime`);
      suggestions.push('Use MP4 container for best compatibility');
    }

    // Check audio extension
    const compatibleAudioExts = ['m4a', 'aac', 'mp3'];
    if (!compatibleAudioExts.includes(args.audioExt)) {
      issues.push(`Audio format '${args.audioExt}' may not be compatible with QuickTime`);
      suggestions.push('Use AAC (m4a) or MP3 audio format');
    }

    return {
      isValid: issues.length === 0,
      issues,
      suggestions
    };
  }

  /**
   * Get format selection arguments optimized for QuickTime compatibility
   */
  static getOptimizedFormatArgs(
    availableFormats: VideoFormat[]
  ): { formatId: string; ext: string; audioExt: string; audioFormatId: string } | null {
    const videoFormats = availableFormats.filter(f => f.vcodec && f.vcodec !== 'none');
    const audioFormats = availableFormats.filter(f => f.acodec && f.acodec !== 'none');

    const optimized = this.getPreferredQuickTimeFormatCombination(videoFormats, audioFormats);
    
    if (optimized?.combined && optimized.video && optimized.audio) {
      return {
        formatId: optimized.combined,
        ext: 'mp4',
        audioExt: optimized.audio.audio_ext || 'm4a',
        audioFormatId: optimized.audio.format_id
      };
    }

    return null;
  }
}

/**
 * Legacy compatibility functions for existing code
 */
export function isQuickTimeCompatible(codec: string): boolean {
  const compatibleCodecs = [
    'avc1', 'h264', 'libx264', // H.264 video codecs
    'mp4a', 'aac', 'libmp3lame', // Audio codecs
    'mpeg4', 'h263' // Older video codecs
  ];
  
  return compatibleCodecs.some(compatible => 
    codec.toLowerCase().includes(compatible.toLowerCase())
  );
}

export function isQuickTimeCompatibleFormat(args: {
  videoFormat: string;
  remuxVideo: string;
  audioExt: string;
  audioFormatId: string;
}): boolean {
  const validation = CodecCompatibilityService.validateFormatCombination(args);
  return validation.isValid;
}
