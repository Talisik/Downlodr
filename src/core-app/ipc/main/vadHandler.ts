// src/core-app/ipc/main/vadHandler.ts
import { spawn } from 'child_process';
import { BrowserWindow, ipcMain } from 'electron';

export interface VadDetectionResult {
  success: boolean;
  dominantLanguage?: string;
  error?: string;
}

interface SalinaResultJson {
  status: 'completed' | 'failed' | 'timeout';
  process_id: string;
  dominant_language?: string | null;
  error?: string;
}

const RESULT_LINE_PREFIX = 'SALINA_RESULT_JSON:';
const DEFAULT_TIMEOUT_MS = 120_000;

/**
 * Path to the Salina VAD prototype checkout, configured via env var since
 * this prototype does not bundle salina_vad.exe into the Electron install
 * (see VAD_INTEGRATION.md §4 — bundling is a separate follow-up).
 */
function getSalinaRepoPath(): string | null {
  return process.env.SALINA_VAD_REPO_PATH || null;
}

function parseSalinaOutput(stdout: string): SalinaResultJson | null {
  const lines = stdout.split('\n');
  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed.startsWith(RESULT_LINE_PREFIX)) {
      try {
        return JSON.parse(trimmed.slice(RESULT_LINE_PREFIX.length));
      } catch {
        return null;
      }
    }
  }
  return null;
}

export const vadHandler = (_mainWindow: BrowserWindow) => {
  ipcMain.handle(
    'vad:detect-dominant-language',
    async (
      _event,
      options: { audioFile: string; timeoutMs?: number },
    ): Promise<VadDetectionResult> => {
      const repoPath = getSalinaRepoPath();
      if (!repoPath) {
        return {
          success: false,
          error:
            'SALINA_VAD_REPO_PATH is not configured; skipping VAD detection.',
        };
      }

      const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;

      return new Promise((resolve) => {
        const child = spawn(
          'python',
          [
            'main.py',
            '--multilingual',
            'false',
            '--audio-file',
            options.audioFile,
            '--wait',
          ],
          { cwd: repoPath, stdio: ['ignore', 'pipe', 'pipe'] },
        );

        let stdout = '';
        let stderr = '';
        let settled = false;

        const timer = setTimeout(() => {
          if (settled) return;
          settled = true;
          child.kill();
          resolve({
            success: false,
            error: `Salina VAD detection timed out after ${timeoutMs}ms`,
          });
        }, timeoutMs);

        child.stdout.on('data', (data: Buffer) => {
          stdout += data.toString();
        });

        child.stderr.on('data', (data: Buffer) => {
          stderr += data.toString();
        });

        child.on('error', (error) => {
          if (settled) return;
          settled = true;
          clearTimeout(timer);
          resolve({
            success: false,
            error: `Failed to start Salina VAD: ${error.message}`,
          });
        });

        child.on('close', () => {
          if (settled) return;
          settled = true;
          clearTimeout(timer);

          const parsed = parseSalinaOutput(stdout);
          if (!parsed) {
            const baseError = 'Salina VAD produced no parseable result';
            resolve({
              success: false,
              error: stderr.trim()
                ? `${baseError}: ${stderr.trim()}`
                : baseError,
            });
            return;
          }

          if (parsed.status !== 'completed' || !parsed.dominant_language) {
            resolve({
              success: false,
              error: parsed.error || `Salina VAD status: ${parsed.status}`,
            });
            return;
          }

          resolve({
            success: true,
            dominantLanguage: parsed.dominant_language,
          });
        });
      });
    },
  );

  return () => ipcMain.removeHandler('vad:detect-dominant-language');
};
