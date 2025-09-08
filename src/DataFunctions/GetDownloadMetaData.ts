/* eslint-disable @typescript-eslint/no-unused-vars */
/**
 * A custom React function
 * This function provides methods to process video formats from various platforms and create audio options
 * (YouTube, Dailymotion, Vimeo, etc.)
 * for audio-only formats. It includes methods to handle different format processing and return structured format options.
 */

import {
  FormatInfo,
  FormatOption,
  ProcessedFormats,
  VideoFormat,
  VideoInfo,
} from '@/schema/metadata';
import { CodecCompatibilityService } from '@/Utils/codecCompatibility';

// TypeScript interfaces for video format data

export class VideoFormatService {
  private static createAudioOptions(
    audioOnlyFormat: VideoFormat | null,
  ): FormatOption[] {
    if (!audioOnlyFormat) return [];

    const audioOptions = [];

    // Only add the original format if it's not mp4
    if (audioOnlyFormat.audio_ext && audioOnlyFormat.audio_ext !== 'mp4') {
      audioOptions.push({
        value: `audio-${audioOnlyFormat.format_id}-${audioOnlyFormat.audio_ext}`,
        label: `Audio Only (${audioOnlyFormat.audio_ext}) - ${
          audioOnlyFormat.format_note || audioOnlyFormat.ext
        }`,
        formatId: audioOnlyFormat.format_id,
        fileExtension: audioOnlyFormat.audio_ext,
      });
    }

    // Always add mp3 option
    audioOptions.push({
      value: `audio-${audioOnlyFormat.format_id}-mp3`,
      label: `Audio Only (mp3) - ${
        audioOnlyFormat.format_note || audioOnlyFormat.ext
      }`,
      formatId: audioOnlyFormat.format_id,
      fileExtension: 'mp3',
    });

    return audioOptions;
  }

  private static processYoutubeFormats(
    formatsArray: VideoFormat[],
    default_format: string,
    default_ext: string,
  ): ProcessedFormats {
    const formatMap = new Map<string, FormatInfo>();
    const seenCombinations = new Set<string>();
    const compatibilityScores = new Map<string, number>();

    // Separate video and audio formats for better QuickTime optimization
    const videoFormats = formatsArray.filter(
      (f) => f.vcodec && f.vcodec !== 'none',
    );
    const audioFormats = formatsArray.filter(
      (f) => f.acodec && f.acodec !== 'none',
    );

    formatsArray.forEach((format: VideoFormat) => {
      const resolution = format.resolution;
      const formatId = format.format_id;
      let video_ext = format.video_ext;
      const url = format.url;
      const format_note = format.format_note;

      if (
        !resolution ||
        !video_ext ||
        !(video_ext != 'none') ||
        !url ||
        !url.startsWith('https://rr')
      )
        return;

      // Enhanced format processing for QuickTime compatibility
      const compatibility =
        CodecCompatibilityService.isQuickTimeCompatible(format);

      // Prefer MP4 container for QuickTime compatibility
      if (video_ext === 'webm' && compatibility.isQuickTimeCompatible) {
        video_ext = 'mp4'; // Use MP4 instead of MKV for better compatibility
      } else if (video_ext === 'webm') {
        video_ext = 'mkv'; // Fallback to MKV for incompatible codecs
      }

      const combinationKey = `${video_ext}-${format_note}`;

      // Calculate compatibility score for prioritization (AGGRESSIVE H.264 preference)
      let score = 0;
      if (compatibility.isQuickTimeCompatible) score += 1000; // Much higher weight
      if (video_ext === 'mp4') score += 500;
      if (format.vcodec?.includes('avc1') || format.vcodec?.includes('h264'))
        score += 800; // Heavily favor H.264
      if (format.acodec?.includes('mp4a') || format.acodec?.includes('aac'))
        score += 400; // Heavily favor AAC

      // SEVERELY penalize VP9, VP8, AV1 codecs
      if (
        format.vcodec?.includes('vp9') ||
        format.vcodec?.includes('vp8') ||
        format.vcodec?.includes('av01')
      ) {
        score -= 2000; // Heavy penalty for incompatible codecs
      }

      // Bonus for higher quality H.264 formats
      if (
        (format.vcodec?.includes('avc1') || format.vcodec?.includes('h264')) &&
        format.height &&
        format.height >= 720
      ) {
        score += 200;
      }

      if (!seenCombinations.has(combinationKey)) {
        seenCombinations.add(combinationKey);
        formatMap.set(formatId, { formatId, video_ext, format_note });
        compatibilityScores.set(formatId, score);
      }
    });

    // Find the best audio-only format with QuickTime compatibility preference
    const audioOnlyFormat = this.findBestAudioFormat(formatsArray);

    // Try to get optimized format combination for QuickTime
    const optimizedCombination =
      CodecCompatibilityService.getPreferredQuickTimeFormatCombination(
        videoFormats,
        audioFormats,
      );

    const defaultOptions = {
      value: `${default_ext}-${default_format}`,
      label: `${default_ext} - Default Format`,
      formatId: default_format,
      fileExtension: default_ext,
    };

    const audioOptions = this.createAudioOptions(audioOnlyFormat);

    // Sort format options by compatibility score (highest first)
    const formatOptions = Array.from(formatMap.entries())
      .sort(([idA], [idB]) => {
        const scoreA = compatibilityScores.get(idA) || 0;
        const scoreB = compatibilityScores.get(idB) || 0;
        return scoreB - scoreA; // Descending order
      })
      .flatMap(([formatId, formatInfo]: [string, FormatInfo]) => {
        // Use optimized audio format if available, otherwise fallback to default
        const audioFormatId =
          optimizedCombination?.audio?.format_id || audioOptions[0]?.formatId;

        return [
          {
            value: `${formatInfo.video_ext}-${formatId}`,
            label: `${formatInfo.video_ext} - ${formatInfo.format_note}`,
            formatId: `${audioFormatId}+${formatInfo.formatId}`,
            fileExtension: formatInfo.video_ext,
          },
        ];
      });

    // Determine the best default format (prioritize QuickTime-compatible MP4)
    const bestFormat =
      formatOptions.find((option) => option.fileExtension === 'mp4') ||
      formatOptions[0];

    return {
      formatOptions: [...formatOptions, defaultOptions],
      audioOptions,
      defaultFormatId: bestFormat?.formatId || '',
      defaultExt: bestFormat?.fileExtension || 'mp4',
    };
  }

  private static findBestAudioFormat(
    formatsArray: VideoFormat[],
  ): VideoFormat | null {
    // Filter audio-only formats
    const audioOnlyFormats = formatsArray.filter(
      (format: VideoFormat) =>
        format.vcodec === 'none' && format.acodec && format.acodec !== 'none',
    );

    if (audioOnlyFormats.length === 0) {
      // Fallback to legacy pattern matching
      const priorityPatterns = [
        /audio only.*original.*default.*medium/i,
        /audio only.*default.*original.*medium/i,
        /audio only.*default.*medium/i,
        /audio only.*medium.*default/i,
        /audio only.*medium/i,
        /audio only.*default.*high/i,
        /audio only.*high/i,
        /audio only/i,
      ];

      for (const pattern of priorityPatterns) {
        const match = formatsArray.find(
          (format: VideoFormat) =>
            format.vcodec === 'none' &&
            format.format &&
            pattern.test(format.format),
        );
        if (match) return match;
      }
      return null;
    }

    // Score and sort audio formats with QuickTime compatibility preference
    const scoredFormats = audioOnlyFormats.map((format) => {
      let score = 0;

      // QuickTime compatibility boost
      const compatibility =
        CodecCompatibilityService.isQuickTimeCompatible(format);
      if (compatibility.isQuickTimeCompatible) score += 1000;

      // Codec preference (AAC > MP3 > others)
      if (format.acodec?.includes('mp4a') || format.acodec?.includes('aac'))
        score += 500;
      else if (format.acodec?.includes('mp3')) score += 300;

      // Quality preference based on bitrate
      const bitrate = format.abr || format.tbr || 0;
      score += bitrate;

      // Format note preference
      const formatNote = format.format_note?.toLowerCase() || '';
      if (formatNote.includes('default')) score += 100;
      if (formatNote.includes('medium')) score += 80;
      if (formatNote.includes('high')) score += 60;

      // Container preference
      if (format.ext === 'm4a') score += 200;
      else if (format.ext === 'mp3') score += 150;

      return { format, score };
    });

    // Sort by score (highest first) and return the best
    scoredFormats.sort((a, b) => b.score - a.score);

    return scoredFormats[0]?.format || null;
  }

  private static processDailymotionFormats(
    formatsArray: VideoFormat[],
  ): ProcessedFormats {
    const formatMap = new Map<string, FormatInfo>();
    const seenCombinations = new Set<string>();

    formatsArray.forEach((format: VideoFormat) => {
      const resolution = format.resolution;
      const formatId = format.format_id;
      const video_ext = format.ext;
      const url = format.url;
      const format_note = format.format || resolution || formatId;

      if (!video_ext || !url) return;

      const combinationKey = `${video_ext}-${resolution}`;

      if (!seenCombinations.has(combinationKey)) {
        seenCombinations.add(combinationKey);
        formatMap.set(formatId, {
          formatId,
          video_ext,
          format_note,
          resolution,
        });
      }
    });

    const audioOptions = [
      {
        value: 'audio-0-mp3',
        label: 'Audio Only (mp3)',
        formatId: '0',
        fileExtension: 'mp3',
      },
    ];

    const formatOptions = Array.from(formatMap.entries())
      .flatMap(([_, formatInfo]: [string, FormatInfo]) => [
        {
          value: `mkv-${formatInfo.resolution}`,
          label: `mkv - ${formatInfo.resolution}`,
          formatId: formatInfo.formatId,
          fileExtension: 'mkv',
        },
        {
          value: `${formatInfo.video_ext}-${formatInfo.resolution}`,
          label: `${formatInfo.video_ext} - ${formatInfo.resolution}`,
          formatId: formatInfo.formatId,
          fileExtension: formatInfo.video_ext,
        },
      ])
      .reverse();

    return {
      formatOptions,
      audioOptions,
      defaultFormatId: formatOptions[0]?.formatId || '',
      defaultExt: formatOptions[0]?.fileExtension || 'mp4',
    };
  }

  private static processVimeoFormats(
    formatsArray: VideoFormat[],
  ): ProcessedFormats {
    const formatMap = new Map<string, FormatInfo>();
    const seenCombinations = new Set<string>();

    const audioOnlyFormat = formatsArray.find(
      (format: VideoFormat) =>
        format.resolution === 'audio only' ||
        format.vcodec === 'none' ||
        (format.format && format.format.toLowerCase().includes('audio only')),
    );

    const audioFormatId = audioOnlyFormat ? audioOnlyFormat.format_id : '0';

    formatsArray.forEach((format: VideoFormat) => {
      const resolution = format.resolution || format.format_id;
      const formatId = format.format_id;
      const video_ext = format.ext;
      const url = format.url;
      const format_note = format.format_note || resolution || formatId;

      if (!video_ext || !url || format_note.includes('DASH')) return;

      const combinationKey = `${video_ext}-${resolution}`;

      if (!seenCombinations.has(combinationKey)) {
        seenCombinations.add(combinationKey);
        formatMap.set(formatId, { formatId, video_ext, format, resolution });
      }
    });

    const audioOptions = [
      {
        value: 'audio-0-mp3',
        label: 'Audio Only (mp3)',
        formatId: '0',
        fileExtension: 'mp3',
      },
    ];

    const formatOptions = Array.from(formatMap.entries())
      .flatMap(([_, formatInfo]: [string, FormatInfo]) => [
        {
          value: `${formatInfo.video_ext}-${formatInfo.resolution}`,
          label: `${formatInfo.video_ext} - ${formatInfo.resolution}`,
          formatId: `${audioFormatId}+${formatInfo.formatId}`,
          fileExtension: formatInfo.video_ext,
        },
      ])
      .reverse();

    return {
      formatOptions,
      audioOptions,
      defaultFormatId: formatOptions[0]?.formatId || '',
      defaultExt: formatOptions[0]?.fileExtension || 'mp4',
    };
  }

  private static processBilibiliFormats(
    formatsArray: VideoFormat[],
  ): ProcessedFormats {
    const formatMap = new Map<string, FormatInfo>();
    const seenCombinations = new Set<string>();

    // Find the best audio-only format (prefer highest quality)
    const audioOnlyFormats = formatsArray.filter(
      (format: VideoFormat) =>
        format.vcodec === 'none' && format.resolution === 'audio only',
    );

    // Sort by bitrate descending and pick the best one
    const bestAudioFormat = audioOnlyFormats.sort(
      (a, b) => (b.tbr || 0) - (a.tbr || 0),
    )[0];
    const audioFormatId = bestAudioFormat ? bestAudioFormat.format_id : '2';

    // Process video formats
    formatsArray.forEach((format: VideoFormat) => {
      const resolution = format.resolution;
      const formatId = format.format_id;
      const video_ext = format.ext;
      const url = format.url;
      const format_note = format.format_note || resolution || formatId;
      const vcodec = format.vcodec;

      // Skip audio-only formats and invalid formats
      if (
        !video_ext ||
        !url ||
        vcodec === 'none' ||
        !resolution ||
        resolution === 'audio only'
      )
        return;

      const combinationKey = `${video_ext}-${format_note}`;

      if (!seenCombinations.has(combinationKey)) {
        seenCombinations.add(combinationKey);
        formatMap.set(formatId, {
          formatId,
          video_ext,
          format_note,
          resolution,
          vcodec,
        });
      }
    });

    // Create audio options from the best audio format
    const audioOptions = this.createAudioOptions(bestAudioFormat);

    // Create format options, prioritizing quality
    const qualityOrder = ['720P', '480P', '360P', '240P', '144P'];

    const formatOptions = Array.from(formatMap.entries())
      .map(([_, formatInfo]: [string, FormatInfo]) => ({
        value: `${formatInfo.video_ext}-${formatInfo.resolution}`,
        label: `${formatInfo.video_ext} - ${formatInfo.format_note}`,
        formatId: `${audioFormatId}+${formatInfo.formatId}`,
        fileExtension: formatInfo.video_ext,
        qualityIndex: qualityOrder.indexOf(formatInfo.format_note),
      }))
      .sort((a, b) => {
        // Sort by quality order (lower index = higher quality)
        const aIndex = a.qualityIndex === -1 ? 999 : a.qualityIndex;
        const bIndex = b.qualityIndex === -1 ? 999 : b.qualityIndex;
        return aIndex - bIndex;
      })
      .map(({ qualityIndex, ...rest }) => rest); // Remove the temporary qualityIndex property

    return {
      formatOptions,
      audioOptions,
      defaultFormatId: formatOptions[0]?.formatId || '',
      defaultExt: formatOptions[0]?.fileExtension || 'mp4',
    };
  }

  private static processDefaultFormats(
    formatsArray: VideoFormat[],
  ): ProcessedFormats {
    const formatMap = new Map<string, FormatInfo>();
    const seenCombinations = new Set<string>();

    formatsArray.forEach((format: VideoFormat) => {
      const resolution = format.resolution || format.format_id;
      const formatId = format.format_id;
      const video_ext = format.ext;
      const url = format.url;
      const format_note = format.format_note || resolution || formatId;

      if (!video_ext || !url || format_note.includes('DASH')) return;

      const combinationKey = `${video_ext}-${resolution}`;

      if (!seenCombinations.has(combinationKey)) {
        seenCombinations.add(combinationKey);
        formatMap.set(formatId, { formatId, video_ext, format, resolution });
      }
    });

    const audioOptions = [
      {
        value: 'audio-0-mp3',
        label: 'Audio Only (mp3)',
        formatId: '0',
        fileExtension: 'mp3',
      },
    ];

    const formatOptions = Array.from(formatMap.entries())
      .flatMap(([_, formatInfo]: [string, FormatInfo]) => [
        {
          value: `mkv-${formatInfo.resolution}`,
          label: `mkv - ${formatInfo.resolution}`,
          formatId: formatInfo.formatId,
          fileExtension: 'mkv',
        },
        {
          value: `${formatInfo.video_ext}-${formatInfo.resolution}`,
          label: `${formatInfo.video_ext} - ${formatInfo.resolution}`,
          formatId: formatInfo.formatId,
          fileExtension: formatInfo.video_ext,
        },
      ])
      .reverse();

    return {
      formatOptions,
      audioOptions,
      defaultFormatId: formatOptions[0]?.formatId || '',
      defaultExt: formatOptions[0]?.fileExtension || 'mp4',
    };
  }

  public static async processVideoFormats(
    info: VideoInfo,
  ): Promise<ProcessedFormats> {
    console.log(
      '🔍 VideoFormatService.processVideoFormats - info object:',
      info,
    );
    console.log(
      '🔍 VideoFormatService.processVideoFormats - info.data:',
      info.data,
    );
    const formatsArray = info.data.formats || [];
    const extractorKey = info.data.extractor_key;
    const defaultFormat = info.data.format_id;
    const defaultExt = info.data.ext;
    let processed;
    switch (extractorKey) {
      case 'Youtube':
        processed = this.processYoutubeFormats(
          formatsArray,
          defaultFormat,
          defaultExt,
        );
        break;
      case 'Dailymotion':
        processed = this.processDailymotionFormats(formatsArray);
        break;
      case 'BiliBili':
      case 'BiliIntl':
      case 'Vimeo':
      case 'CNN':
        processed = this.processVimeoFormats(formatsArray);
        break;
      default:
        processed = this.processDefaultFormats(formatsArray);
    }

    return {
      ...processed,
      formatOptions: [...processed.formatOptions, ...processed.audioOptions],
      audioOptions: processed.audioOptions,
      defaultFormatId: processed.defaultFormatId,
      defaultExt: processed.defaultExt,
    };
  }
}
