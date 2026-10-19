/**
 * Custom Vitest reporter — writes one markdown file per test file into a
 * per-run folder under tests/fast-test/<date>_<time>/, mirroring the source
 * tree (minus the leading `src/`). Each file documents every test case's
 * result plus a short description of how the file sets up its tests (mocked
 * modules, fixtures, harnesses used), derived by scanning the test file's
 * own source for known patterns.
 *
 * Every `yarn test` run gets its own timestamped folder (named from when the
 * run started) instead of overwriting the previous run's results, so past
 * runs stay around as a history.
 *
 * Registered as an additional reporter in vitest.config.ts, so it runs
 * automatically on every `yarn test` alongside the normal terminal output.
 */
import fs from 'fs';
import path from 'path';
import type { File, Task } from 'vitest';

interface FlatResult {
  fullName: string;
  state: string;
  duration: number;
  errorMessage?: string;
}

function flattenTasks(tasks: Task[], prefix: string[] = []): FlatResult[] {
  const results: FlatResult[] = [];
  for (const task of tasks) {
    if (task.type === 'suite') {
      results.push(...flattenTasks(task.tasks, [...prefix, task.name]));
    } else {
      const state = task.result?.state ?? 'skip';
      const duration = task.result?.duration ?? 0;
      const errorMessage = task.result?.errors?.[0]?.message;
      results.push({
        fullName: [...prefix, task.name].join(' > '),
        state,
        duration,
        errorMessage,
      });
    }
  }
  return results;
}

/** Scans a test file's own source for known setup patterns, for the "how this file tests it" section. */
function describeMethod(source: string): string[] {
  const notes: string[] = [];

  const mockedModules = [...source.matchAll(/vi\.mock\(\s*['"]([^'"]+)['"]/g)].map((m) => m[1]);
  if (mockedModules.length > 0) {
    notes.push(`Mocks: ${mockedModules.map((m) => `\`${m}\``).join(', ')}`);
  }

  if (/vi\.hoisted\(/.test(source)) {
    notes.push('Uses `vi.hoisted()` so mock state exists before hoisted imports run.');
  }
  if (/vi\.resetModules\(\)/.test(source)) {
    notes.push('Uses `vi.resetModules()` + dynamic `import()` per test to get a fresh module instance (isolates module-scoped state like queues/singletons).');
  }
  if (/createStoreHarness/.test(source)) {
    notes.push('Uses the shared `createStoreHarness` fake Zustand set/get harness instead of booting the real persisted store.');
  }
  if (/\bwindow\.downlodrFunctions\s*=/.test(source)) {
    notes.push('Stubs `window.downlodrFunctions` (the Electron preload/IPC bridge for filesystem and app calls).');
  }
  if (/\bwindow\.ytdlp\s*=/.test(source)) {
    notes.push('Stubs `window.ytdlp` (the yt-dlp IPC bridge).');
  }
  if (/\bwindow\.afdaBridge\s*=/.test(source)) {
    notes.push('Stubs `window.afdaBridge` (the AFDA/article-scraping IPC bridge).');
  }
  if (/\bwindow\.skedulosaBridge\s*=/.test(source)) {
    notes.push('Stubs `window.skedulosaBridge` (the subscriptions IPC bridge).');
  }
  if (/vi\.useFakeTimers\(\)/.test(source)) {
    notes.push('Uses fake timers (`vi.useFakeTimers()` / `vi.advanceTimersByTimeAsync`) to control time deterministically.');
  }
  if (/vi\.waitFor\(/.test(source)) {
    notes.push('Uses `vi.waitFor()` to await an async condition instead of a fixed delay.');
  }
  if (!/createStoreHarness/.test(source) && /\.setState\(/.test(source) && /getState\(\)/.test(source)) {
    notes.push('Exercises a real Zustand store directly via `.setState()`/`.getState()`.');
  }
  if (/getInstance\(\)/.test(source)) {
    notes.push('Targets a singleton (`.getInstance()`), so shared state is reset between tests explicitly.');
  }

  return notes;
}

function toOutputPath(outDir: string, filepath: string, cwd: string): string {
  let relative = path.relative(cwd, filepath).replace(/\\/g, '/');
  relative = relative.replace(/^src\//, '');
  relative = relative.replace(/\.test\.(ts|tsx)$/, '.md');
  return path.join(outDir, relative);
}

/** e.g. 2026-08-20_08-00-00 — sorts chronologically as a plain string, safe as a folder name on Windows. */
function formatRunFolderName(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  const datePart = `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
  const timePart = `${pad(date.getHours())}-${pad(date.getMinutes())}-${pad(date.getSeconds())}`;
  return `${datePart}_${timePart}`;
}

export default class FastTestMarkdownReporter {
  private runStartedAt = new Date();

  onInit(): void {
    this.runStartedAt = new Date();
  }

  onFinished(files: File[] = []): void {
    const cwd = process.cwd();
    const outDir = path.resolve(cwd, 'tests/fast-test', formatRunFolderName(this.runStartedAt));
    fs.mkdirSync(outDir, { recursive: true });

    for (const file of files) {
      const flat = flattenTasks(file.tasks);
      if (flat.length === 0) continue;

      const passed = flat.filter((t) => t.state === 'pass').length;
      const failed = flat.filter((t) => t.state === 'fail').length;
      const skipped = flat.filter((t) => t.state !== 'pass' && t.state !== 'fail').length;
      const totalDuration = flat.reduce((sum, t) => sum + (t.duration || 0), 0);

      let source = '';
      try {
        source = fs.readFileSync(file.filepath, 'utf8');
      } catch {
        // Source unreadable (rare) — skip the methodology section, still report results.
      }
      const methodNotes = describeMethod(source);

      const relDisplay = path.relative(cwd, file.filepath).replace(/\\/g, '/');
      const lines: string[] = [];
      lines.push(`# ${relDisplay}`);
      lines.push('');
      lines.push(`Generated by \`yarn test\` on ${this.runStartedAt.toISOString()} (run folder: ${formatRunFolderName(this.runStartedAt)}).`);
      lines.push('');
      lines.push(
        `**Result: ${failed === 0 ? '✅ PASS' : '❌ FAIL'}** — ${passed} passed, ${failed} failed, ${skipped} skipped, ~${Math.round(totalDuration)}ms`,
      );
      lines.push('');

      if (methodNotes.length > 0) {
        lines.push('## How this file tests it');
        lines.push('');
        for (const note of methodNotes) lines.push(`- ${note}`);
        lines.push('');
      }

      lines.push('## Test cases');
      lines.push('');
      lines.push('| Test | Result | Duration | Failure |');
      lines.push('|---|---|---|---|');
      for (const t of flat) {
        const icon = t.state === 'pass' ? '✅' : t.state === 'fail' ? '❌' : '⏭️';
        const failure = t.errorMessage
          ? t.errorMessage.replace(/\|/g, '\\|').replace(/\r?\n/g, ' ').slice(0, 200)
          : '';
        lines.push(
          `| ${t.fullName.replace(/\|/g, '\\|')} | ${icon} ${t.state} | ${Math.round(t.duration)}ms | ${failure} |`,
        );
      }
      lines.push('');

      const outPath = toOutputPath(outDir, file.filepath, cwd);
      fs.mkdirSync(path.dirname(outPath), { recursive: true });
      fs.writeFileSync(outPath, lines.join('\n'));
    }
  }
}
