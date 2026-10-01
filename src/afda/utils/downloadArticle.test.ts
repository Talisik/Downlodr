import { beforeEach, describe, expect, it, vi } from 'vitest';

const toastMock = vi.hoisted(() => vi.fn());
vi.mock('@/core-app/components/shadcn/hooks/use-toast', () => ({
  toast: toastMock,
}));

import type { ArticleModel } from '@/afda/backend/schema/articleSchema';
import {
  MAX_ARTICLE_LOG_ENTRIES,
  useArticleDownloadStore,
} from '@/afda/store/articleDownloadStore';
import {
  failArticleDownload,
  logArticleFetched,
  logArticleStep,
  resolveArticleDownloadFolder,
  saveArticleFile,
} from '@/afda/utils/downloadArticle';
import { useSettingStore } from '@/core-app/store/settingsStore';

// In-memory stand-in for the disk; saveBufferToFile resolves on a later tick
// so two concurrent saves genuinely overlap.
let disk: Set<string>;

beforeEach(() => {
  disk = new Set();
  toastMock.mockClear();
  useArticleDownloadStore.setState({ articleDownloads: [] });
  (window as unknown as { downlodrFunctions: unknown }).downlodrFunctions = {
    joinDownloadPath: async (folder: string, name: string) =>
      `${folder}/${name}`,
    fileExists: async (p: string) => disk.has(p),
    saveBufferToFile: async (_data: number[], p: string) => {
      await new Promise((r) => setTimeout(r, 5));
      disk.add(p);
      return { success: true };
    },
  };
});

describe('saveArticleFile', () => {
  it('uses the plain name when nothing is there', async () => {
    expect(await saveArticleFile('/dl', 'Pedicabs', 'docx', [])).toBe(
      '/dl/Pedicabs.docx',
    );
  });

  it('adds (1), (2) instead of overwriting an existing file', async () => {
    disk.add('/dl/Pedicabs.docx');
    disk.add('/dl/Pedicabs (1).docx');
    expect(await saveArticleFile('/dl', 'Pedicabs', 'docx', [])).toBe(
      '/dl/Pedicabs (2).docx',
    );
  });

  it('gives concurrent saves of the same name different paths', async () => {
    const paths = await Promise.all([
      saveArticleFile('/dl', 'Pedicabs', 'docx', []),
      saveArticleFile('/dl', 'Pedicabs', 'docx', []),
    ]);
    expect(new Set(paths).size).toBe(2);
  });

  it('throws the save error so the caller can report it', async () => {
    (
      window as unknown as {
        downlodrFunctions: { saveBufferToFile: unknown };
      }
    ).downlodrFunctions.saveBufferToFile = async () => ({
      success: false,
      error: 'EACCES',
    });
    await expect(saveArticleFile('/dl', 'x', 'docx', [])).rejects.toThrow(
      'EACCES',
    );
  });
});

describe('failArticleDownload', () => {
  it('marks the row failed with the message and shows a toast', () => {
    useArticleDownloadStore
      .getState()
      .addArticleDownload('a1', 'https://mb.com.ph/x/');

    failArticleDownload('a1', new Error('Failed to fetch the page'));

    const row = useArticleDownloadStore.getState().articleDownloads[0];
    expect(row.status).toBe('failed');
    expect(row.errorMessage).toBe('Failed to fetch the page');
    expect(toastMock).toHaveBeenCalledWith(
      expect.objectContaining({
        variant: 'destructive',
        description: expect.stringMatching(
          /^https:\/\/mb\.com\.ph\/x\/: Could not load the page\. /,
        ),
      }),
    );
  });
});

describe('addArticleDownload', () => {
  it('adds the same URL twice', () => {
    const { addArticleDownload } = useArticleDownloadStore.getState();
    addArticleDownload('a1', 'https://mb.com.ph/x/');
    addArticleDownload('a2', 'https://mb.com.ph/x/');
    expect(useArticleDownloadStore.getState().articleDownloads).toHaveLength(2);
  });
});

describe('article download log', () => {
  const store = () => useArticleDownloadStore.getState();
  const log = () => store().articleDownloads[0].log ?? [];

  beforeEach(() => {
    store().addArticleDownload('a1', 'https://mb.com.ph/x/');
  });

  it('starts empty and logs nothing for non-status patches', () => {
    store().updateArticleDownload('a1', { format: 'pdf' });
    expect(log()).toEqual([]);
  });

  it('logs start, save and finish across a successful download', () => {
    store().updateArticleDownload('a1', { status: 'loading' });
    store().updateArticleDownload('a1', {
      status: 'finished',
      filePath: '/dl/Pedicabs.docx',
      fileSize: 2048,
    });
    expect(log().map((e) => [e.level, e.message])).toEqual([
      ['info', 'Download started — DOCX from pasted URL: https://mb.com.ph/x/'],
      ['success', 'Saved to /dl/Pedicabs.docx (2.0 KB)'],
      ['success', expect.stringMatching(/^Download finished in \d+\.\ds$/)],
    ]);
  });

  it('logs the error, the retry reset, and numbers the next attempt', () => {
    store().updateArticleDownload('a1', { status: 'loading' });
    failArticleDownload('a1', new Error('Article not found'));
    store().updateArticleDownload('a1', { status: 'for_download' });
    store().updateArticleDownload('a1', { status: 'loading' });
    expect(log().map((e) => [e.level, e.message])).toEqual([
      ['info', expect.stringMatching(/^Download started — /)],
      [
        'error',
        expect.stringMatching(
          /^ERROR \[MISSING_IN_DATABASE\]: Article no longer available — /,
        ),
      ],
      ['error', 'Details: Article not found'],
      ['info', 'Reset for retry'],
      ['info', expect.stringMatching(/^Download started \(attempt 2\) — /)],
    ]);
  });

  it('warns about gaps in the fetched article', () => {
    logArticleFetched('a1', {
      article_title: null,
      article_publish_date: null,
      article_authors: [{ name: 'Juan' }],
      article_sections: [],
      article_content: '',
      article_videos: [],
      article_images: [],
      article_status: 'Done',
      article_error_status: null,
      is_published_date_correct: true,
      updated_by: 'test',
      date_updated: new Date(),
      date_parsed: new Date(),
      raw_html: null,
    } as ArticleModel);
    expect(log().map((e) => [e.level, e.message])).toEqual([
      [
        'info',
        'Fetched "(untitled)" — 0 sections, 0 images, by Juan (parser status: Done)',
      ],
      ['warn', 'WARNING: No title found; file will be named "article"'],
      ['warn', 'WARNING: No article body was extracted'],
      ['warn', 'WARNING: No publish date found'],
    ]);
  });

  it('keeps only the newest entries', () => {
    for (let i = 0; i < MAX_ARTICLE_LOG_ENTRIES + 5; i++)
      logArticleStep('a1', `step ${i}`);
    expect(log()).toHaveLength(MAX_ARTICLE_LOG_ENTRIES);
    expect(log()[0].message).toBe('step 5');
  });
});

describe('resolveArticleDownloadFolder', () => {
  const setLocation = (defaultLocation: string) =>
    useSettingStore.setState((state) => ({
      settings: { ...state.settings, defaultLocation },
    }));

  beforeEach(() => {
    (
      window as unknown as { downlodrFunctions: Record<string, unknown> }
    ).downlodrFunctions.getDownloadFolder = async () => '/home/Downloads/';
  });

  it('uses the download location from Settings', async () => {
    setLocation('D:/Media/Downlodr');
    expect(await resolveArticleDownloadFolder()).toBe('D:/Media/Downlodr');
  });

  it('falls back to the OS Downloads folder when none is set', async () => {
    setLocation('   ');
    expect(await resolveArticleDownloadFolder()).toBe('/home/Downloads/');
  });
});
