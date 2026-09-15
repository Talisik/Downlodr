import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { bridgeGet } from '../client.js';

export async function handleTranscriptInfo() {
  return bridgeGet<Record<string, unknown>>('/status');
}

export function handleGenerateTranscript({
  inputFile,
  modelPath,
  outputFile,
  language = 'en',
  format = 'srt',
}: {
  inputFile: string;
  modelPath: string;
  outputFile: string;
  language?: string;
  format?: 'srt' | 'vtt';
}) {
  const normalizeForFilter = (p: string) =>
    p.replace(/\\/g, '/').replace(/^([A-Za-z]):/, '$1\\:');
  const modelNorm = normalizeForFilter(modelPath);
  const outputNorm = normalizeForFilter(outputFile);
  const filterComplex = `[0:a]whisper=model='${modelNorm}':language=${language}:destination='${outputNorm}':format=${format}`;
  return `ffmpeg -i "${inputFile}" -filter_complex "${filterComplex}" -f null -`;
}

export function registerTranscriptTools(server: McpServer): void {
  // ── get transcript info ─────────────────────────────────────────────────────
  server.tool(
    'downlodr_transcript_info',
    'Check whether transcript generation (FFmpeg Whisper) is available in Downlodr and get setup instructions.',
    {},
    async () => {
      const status = await bridgeGet<Record<string, unknown>>('/status');
      return {
        content: [
          {
            type: 'text' as const,
            text: [
              'Downlodr supports AI transcription via FFmpeg 8.0+ with the Whisper filter.',
              '',
              `App status: ${status.ok ? 'running' : 'unreachable'}`,
              `App version: ${status.version ?? 'unknown'}`,
              '',
              'To generate a transcript:',
              '1. Open Downlodr and go to the Transcript section.',
              '2. Select a downloaded video file.',
              '3. Choose language and output format (SRT or VTT).',
              '4. Click Generate Transcript.',
              '',
              'Alternatively, use the Downlodr UI — transcript generation requires',
              'FFmpeg 8.0+ which must be installed on this machine.',
              '',
              'Requirements:',
              '  - FFmpeg 8.0+ with Whisper filter support',
              '  - ggml-base.bin Whisper model file',
              '  - A video file already downloaded to disk',
            ].join('\n'),
          },
        ],
      };
    },
  );

  // ── generate transcript instructions ────────────────────────────────────────
  server.tool(
    'downlodr_generate_transcript',
    'Get the exact FFmpeg command to generate a transcript from a video file using Whisper. Run this command in your terminal, or use the Downlodr UI.',
    {
      inputFile: z.string().describe('Full path to the video file'),
      modelPath: z.string().describe('Full path to the ggml-base.bin Whisper model file'),
      outputFile: z.string().describe('Full path for the output transcript file (e.g. /Users/me/Downloads/video.srt)'),
      language: z.string().optional().describe('Language code, e.g. "en", "fr", "es" (default: "en")'),
      format: z.enum(['srt', 'vtt']).optional().describe('Output format: "srt" or "vtt" (default: "srt")'),
    },
    async ({ inputFile, modelPath, outputFile, language = 'en', format = 'srt' }) => {
      // Normalize paths for FFmpeg filter syntax (escape colons in drive letters on Windows)
      const normalizeForFilter = (p: string) =>
        p.replace(/\\/g, '/').replace(/^([A-Za-z]):/, '$1\\:');

      const modelNorm = normalizeForFilter(modelPath);
      const outputNorm = normalizeForFilter(outputFile);
      const filterComplex = `[0:a]whisper=model='${modelNorm}':language=${language}:destination='${outputNorm}':format=${format}`;
      const ffmpegCmd = `ffmpeg -i "${inputFile}" -filter_complex "${filterComplex}" -f null -`;

      return {
        content: [
          {
            type: 'text' as const,
            text: [
              '## Transcript Generation Command',
              '',
              'Run this in your terminal:',
              '',
              '```sh',
              ffmpegCmd,
              '```',
              '',
              `Output will be saved to: ${outputFile}`,
              '',
              'Note: Requires FFmpeg 8.0+ with Whisper filter support.',
              'You can also trigger this from the Downlodr UI → Transcript tab.',
            ].join('\n'),
          },
        ],
      };
    },
  );
}
