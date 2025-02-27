/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * A custom React function
 * This function provides methods to process video formats from various platforms and create audio options
 * (YouTube, Dailymotion, Vimeo, etc.)
 * for audio-only formats. It includes methods to handle different format processing and return structured format options.
 */

interface FormatOption {
  value: string;
  label: string;
  formatId: string;
  fileExtension: string;
}

interface ProcessedFormats {
  formatOptions: FormatOption[];
  audioOptions: FormatOption[];
  defaultFormatId: string;
  defaultExt: string;
}

export class VideoFormatService {
  private static createAudioOptions(audioOnlyFormat: any): FormatOption[] {
    if (!audioOnlyFormat) return [];

    return [
      {
        value: `audio-${audioOnlyFormat.format_id}-${audioOnlyFormat.audio_ext}`,
        label: `Audio Only (${audioOnlyFormat.audio_ext}) - ${
          audioOnlyFormat.format_note || audioOnlyFormat.ext
        }`,
        formatId: audioOnlyFormat.format_id,
        fileExtension: audioOnlyFormat.audio_ext,
      },
      {
        value: `audio-${audioOnlyFormat.format_id}-mp3`,
        label: `Audio Only (mp3) - ${
          audioOnlyFormat.format_note || audioOnlyFormat.ext
        }`,
        formatId: audioOnlyFormat.format_id,
        fileExtension: 'mp3',
      },
    ];
  }

  private static processYoutubeFormats(formatsArray: any[]): ProcessedFormats {
    const formatMap = new Map();
    const seenCombinations = new Set();

    formatsArray.forEach((format: any) => {
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

      video_ext = video_ext === 'webm' ? 'mkv' : video_ext;
      const combinationKey = `${video_ext}-${format_note}`;

      if (!seenCombinations.has(combinationKey)) {
        seenCombinations.add(combinationKey);
        formatMap.set(formatId, { formatId, video_ext, format_note });
      }
    });

    const audioOnlyFormat = formatsArray.find(
      (format: any) =>
        format.vcodec === 'none' &&
        format.format.includes('audio only (medium)'),
    );

    const audioOptions = this.createAudioOptions(audioOnlyFormat);
    const formatOptions = Array.from(formatMap.entries())
      .flatMap(([resolution, formatInfo]: [any, any]) => [
        {
          value: `${formatInfo.video_ext}-${resolution}`,
          label: `${formatInfo.video_ext} - ${formatInfo.format_note}`,
          formatId: `${audioOptions[0]?.formatId}+${formatInfo.formatId}`,
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

  private static processDailymotionFormats(
    formatsArray: any[],
  ): ProcessedFormats {
    const formatMap = new Map();
    const seenCombinations = new Set();

    formatsArray.forEach((format: any) => {
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
      .flatMap(([_, formatInfo]: [any, any]) => [
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

  private static processVimeoFormats(formatsArray: any[]): ProcessedFormats {
    const formatMap = new Map();
    const seenCombinations = new Set();

    const audioOnlyFormat = formatsArray.find(
      (format: any) =>
        format.resolution === 'audio only' ||
        format.vcodec === 'none' ||
        (format.format && format.format.toLowerCase().includes('audio only')),
    );

    const audioFormatId = audioOnlyFormat ? audioOnlyFormat.format_id : '0';

    formatsArray.forEach((format: any) => {
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
      .flatMap(([_, formatInfo]: [any, any]) => [
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

  private static processDefaultFormats(formatsArray: any[]): ProcessedFormats {
    const formatMap = new Map();
    const seenCombinations = new Set();

    formatsArray.forEach((format: any) => {
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
      .flatMap(([_, formatInfo]: [any, any]) => [
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
    info: any,
  ): Promise<ProcessedFormats> {
    const formatsArray = info.data.formats || [];
    const extractorKey = info.data.extractor_key;

    let processed;
    switch (extractorKey) {
      case 'Youtube':
        processed = this.processYoutubeFormats(formatsArray);
        break;
      case 'Dailymotion':
        processed = this.processDailymotionFormats(formatsArray);
        break;
      case 'Vimeo':
      case 'BiliBili':
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
