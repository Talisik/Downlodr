# Article DOCX Download Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** When a user pastes an article URL and clicks the download icon, open the side panel as today AND save a `.docx` file to disk; show the entry as a row in StatusPageTable, persisted via IndexedDB.

**Architecture:** A dedicated `articleDownloadStore` (Zustand + IndexedDB) holds `ArticleDownload[]`. A new `saveBufferToFile` IPC writes the `docx` buffer to disk. `StatusPage` merges article entries into `allDownloads`; `StatusPageTable` renders `ArticleDownloadTableRow` for entries tagged `type: 'article'`.

**Tech Stack:** React, Zustand + IndexedDB, `docx` v9.5.0 (already in `package.json`), Electron IPC

---

## File Map

| Action | Path | Responsibility |
|--------|------|----------------|
| Create | `src/afda/store/articleDownloadStore.ts` | Zustand store for article download entries |
| Create | `src/afda/utils/articleDocxGenerator.ts` | Build + return `Uint8Array` docx buffer |
| Create | `src/afda/components/ArticleDownloadTableRow.tsx` | Flat table row for article entries |
| Modify | `src/core-app/ipc/main/fileHandler.ts` | Add `save-buffer-to-file` IPC handler |
| Modify | `src/core-app/ipc/renderer/fileHandler.ts` | Expose `saveBufferToFile` on `fileFunctionsBridge` |
| Modify | `src/core-app/ipc/composeWindowApi.ts` | Wire `saveBufferToFile` into `window.downlodrFunctions` |
| Modify | `src/global.d.ts` | Type `saveBufferToFile` on both bridge and composed API |
| Modify | `src/downlodr/store/taskbarDownloadStore.tsx` | Add `ArticleSearchableDownload`; extend union |
| Modify | `src/downlodr/components/base/InputField/TaskbarInputField.tsx` | Trigger article download; watch fetchState |
| Modify | `src/downlodr/pages/StatusPage.tsx` | Merge article entries into `allDownloads` |
| Modify | `src/downlodr/pages/status/StatusPageTable.tsx` | Render `ArticleDownloadTableRow` for article type |

---

## Task 1: Create `articleDownloadStore`

**Files:**
- Create: `src/afda/store/articleDownloadStore.ts`

- [ ] **Step 1: Create the store file**

```typescript
// src/afda/store/articleDownloadStore.ts
import type { ArticleModel } from '@/afda/backend/schema/articleSchema';
import { createIndexedDBStorageWithMigration } from '@/core-app/utils/indexedDBStorage';
import { createDebouncedStorage } from '@/downlodr/store/download/storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

export interface ArticleDownload {
  id: string;
  title: string;
  url: string;
  status: 'loading' | 'finished' | 'failed';
  filePath: string | null;
  fileSize: number | null;
  dateAdded: string;
  errorMessage?: string;
  articleData: ArticleModel | null;
  thumbnailDataUrl: string | null;
}

interface ArticleDownloadStore {
  articleDownloads: ArticleDownload[];
  addArticleDownload: (id: string, url: string) => void;
  updateArticleDownload: (id: string, patch: Partial<ArticleDownload>) => void;
  removeArticleDownload: (id: string) => void;
}

export const useArticleDownloadStore = create<ArticleDownloadStore>()(
  persist(
    (set) => ({
      articleDownloads: [],

      addArticleDownload: (id, url) =>
        set((state) => ({
          articleDownloads: [
            {
              id,
              title: '',
              url,
              status: 'loading',
              filePath: null,
              fileSize: null,
              dateAdded: new Date().toISOString(),
              articleData: null,
              thumbnailDataUrl: null,
            },
            ...state.articleDownloads,
          ],
        })),

      updateArticleDownload: (id, patch) =>
        set((state) => ({
          articleDownloads: state.articleDownloads.map((d) =>
            d.id === id ? { ...d, ...patch } : d,
          ),
        })),

      removeArticleDownload: (id) =>
        set((state) => ({
          articleDownloads: state.articleDownloads.filter((d) => d.id !== id),
        })),
    }),
    {
      name: 'article-downloads-storage',
      storage: createJSONStorage(() =>
        createDebouncedStorage(
          createIndexedDBStorageWithMigration({
            dbName: 'downlodr-database',
            storeName: 'zustand-storage',
            version: 1,
          }),
          250,
        ),
      ),
    },
  ),
);
```

- [ ] **Step 2: Commit**

```bash
git add src/afda/store/articleDownloadStore.ts
git commit -m "feat(afda): add articleDownloadStore with IndexedDB persistence"
```

---

## Task 2: Add `saveBufferToFile` IPC

**Files:**
- Modify: `src/core-app/ipc/main/fileHandler.ts`
- Modify: `src/core-app/ipc/renderer/fileHandler.ts`
- Modify: `src/core-app/ipc/composeWindowApi.ts`
- Modify: `src/global.d.ts`

- [ ] **Step 1: Add IPC handler in main process**

In `src/core-app/ipc/main/fileHandler.ts`, add this block inside the `fileHandler` function, after the existing `downloadFile` handler (around line 41):

```typescript
  ipcMain.handle(
    'save-buffer-to-file',
    async (
      _event,
      data: number[],
      filePath: string,
    ): Promise<{ success: boolean; error?: string }> => {
      try {
        const dir = path.dirname(filePath);
        await fs.promises.mkdir(dir, { recursive: true });
        await fs.promises.writeFile(filePath, Buffer.from(data));
        return { success: true };
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        return { success: false, error: message };
      }
    },
  );
```

- [ ] **Step 2: Expose on `fileFunctionsBridge` in preload**

In `src/core-app/ipc/renderer/fileHandler.ts`, add `saveBufferToFile` to the `fileFunctionsBridge` `contextBridge.exposeInMainWorld` call:

```typescript
contextBridge.exposeInMainWorld('fileFunctionsBridge', {
  selectVideoFile: () => ipcRenderer.invoke('dialog:selectVideoFile'),
  downloadFile: (url: string, outputPath: string) =>
    ipcRenderer.invoke('downloadFile', url, outputPath),
  openVideo: (filePath: string) => ipcRenderer.invoke('openVideo', filePath),
  deleteFile: (filepath: string) => ipcRenderer.invoke('deleteFile', filepath),
  deleteFolder: (folderpath: string) =>
    ipcRenderer.invoke('deleteFolder', folderpath),
  openFolder: (folderPath: string, filePath: string) =>
    ipcRenderer.invoke('open-folder', folderPath, filePath),
  saveBufferToFile: (data: number[], filePath: string) =>
    ipcRenderer.invoke('save-buffer-to-file', data, filePath),
});
```

- [ ] **Step 3: Wire into `window.downlodrFunctions`**

In `src/core-app/ipc/composeWindowApi.ts`, add `saveBufferToFile` to the `w.downlodrFunctions` object (after `selectVideoFile`):

```typescript
      selectVideoFile: fileFn.selectVideoFile,
      saveBufferToFile: fileFn.saveBufferToFile,
```

- [ ] **Step 4: Add types to `global.d.ts`**

In `src/global.d.ts`, add `saveBufferToFile` to `fileFunctionsBridge` (after `openFolder`):

```typescript
      openFolder: (folderPath: string, filePath: string) => Promise<{ success: boolean; error?: string }>;
      saveBufferToFile: (data: number[], filePath: string) => Promise<{ success: boolean; error?: string }>;
```

Add `saveBufferToFile` to `downlodrFunctions` (after `selectVideoFile`):

```typescript
      selectVideoFile: () => Promise<string | null>;
      saveBufferToFile: (data: number[], filePath: string) => Promise<{ success: boolean; error?: string }>;
```

- [ ] **Step 5: Commit**

```bash
git add src/core-app/ipc/main/fileHandler.ts src/core-app/ipc/renderer/fileHandler.ts src/core-app/ipc/composeWindowApi.ts src/global.d.ts
git commit -m "feat(ipc): add save-buffer-to-file IPC handler and expose on window.downlodrFunctions"
```

---

## Task 3: Create `articleDocxGenerator` utility

**Files:**
- Create: `src/afda/utils/articleDocxGenerator.ts`

- [ ] **Step 1: Create the generator**

```typescript
// src/afda/utils/articleDocxGenerator.ts
import type { ArticleModel } from '@/afda/backend/schema/articleSchema';
import {
  Document,
  HeadingLevel,
  ImageRun,
  Packer,
  Paragraph,
  TextRun,
} from 'docx';
import { formatArticleSections } from './articleFormatter';

export const sanitizeFilename = (title: string | null): string => {
  const safe = (title ?? 'article')
    .slice(0, 20)
    .replace(/[^a-zA-Z0-9]/g, '_')
    .replace(/^_+|_+$/g, '');
  return safe || 'article';
};

export const fetchAsDataUrl = async (url: string): Promise<string | null> => {
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const blob = await res.blob();
    return new Promise<string | null>((resolve) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = () => resolve(null);
      reader.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
};

const fetchAsArrayBuffer = async (url: string): Promise<ArrayBuffer | null> => {
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    return res.arrayBuffer();
  } catch {
    return null;
  }
};

export const generateArticleDocx = async (
  article: ArticleModel,
): Promise<Uint8Array> => {
  const sections = formatArticleSections(article);

  const thumbnailUrl = article.article_images[0]?.url ?? null;
  const thumbnailBuffer = thumbnailUrl
    ? await fetchAsArrayBuffer(thumbnailUrl)
    : null;

  const metaParts: string[] = [];
  if (article.article_publish_date) {
    metaParts.push(
      new Date(article.article_publish_date).toLocaleDateString(),
    );
  }
  if (article.article_authors.length > 0) {
    metaParts.push(article.article_authors.map((a) => a.name).join(', '));
  }

  const children: Paragraph[] = [];

  children.push(
    new Paragraph({
      text: article.article_title ?? 'Article',
      heading: HeadingLevel.HEADING_1,
    }),
  );

  if (metaParts.length > 0) {
    children.push(
      new Paragraph({
        children: [
          new TextRun({ text: metaParts.join(' · '), color: '888888' }),
        ],
      }),
    );
  }

  if (thumbnailBuffer) {
    children.push(
      new Paragraph({
        children: [
          new ImageRun({
            data: thumbnailBuffer,
            transformation: { width: 400, height: 225 },
            type: 'jpg',
          }),
        ],
      }),
    );
  }

  for (const section of sections) {
    if (section.heading) {
      children.push(
        new Paragraph({
          text: section.heading,
          heading: HeadingLevel.HEADING_2,
        }),
      );
    }
    for (const para of section.paragraphs) {
      children.push(new Paragraph({ children: [new TextRun(para)] }));
    }
  }

  const doc = new Document({ sections: [{ children }] });
  const blob = await Packer.toBlob(doc);
  const arrayBuffer = await blob.arrayBuffer();
  return new Uint8Array(arrayBuffer);
};
```

- [ ] **Step 2: Commit**

```bash
git add src/afda/utils/articleDocxGenerator.ts
git commit -m "feat(afda): add articleDocxGenerator utility using docx v9"
```

---

## Task 4: Extend `SearchableDownload` with `ArticleSearchableDownload`

**Files:**
- Modify: `src/downlodr/store/taskbarDownloadStore.tsx`

- [ ] **Step 1: Add imports and new type**

In `src/downlodr/store/taskbarDownloadStore.tsx`, add the following import at the top alongside the existing download type imports:

```typescript
import type { BaseDownload } from '@/downlodr/store/download/types';
```

Then add the `ArticleSearchableDownload` interface and update the `SearchableDownload` union. Find the existing `SearchableDownload` type definition and replace it:

```typescript
export interface ArticleSearchableDownload extends BaseDownload {
  type: 'article';
  errorMessage?: string;
}

export type SearchableDownload =
  | ForDownload
  | Downloading
  | FinishedDownloads
  | HistoryDownloads
  | QueuedDownload
  | ArticleSearchableDownload;
```

The `ArticleSearchableDownload extends BaseDownload` approach satisfies all the optional fields on `BaseDownload` (they default to `undefined`) while adding the `type` discriminator. When mapping from `ArticleDownload` in `StatusPage`, the required fields of `BaseDownload` (`id`, `videoUrl`, `name`, `downloadName`, `channelName`, `size`, `speed`, `timeLeft`, `DateAdded`, `progress`, `location`, `status`, `ext`, `tags`, `category`, `extractorKey`, `formatId`, `audioExt`, `audioFormatId`, `isLive`, `automaticCaption`, `thumbnails`, `getTranscript`, `getThumbnail`, `duration`) all need values.

- [ ] **Step 2: Commit**

```bash
git add src/downlodr/store/taskbarDownloadStore.tsx
git commit -m "feat(store): add ArticleSearchableDownload type and extend SearchableDownload union"
```

---

## Task 5: Modify `TaskbarInputField` to trigger article downloads

**Files:**
- Modify: `src/downlodr/components/base/InputField/TaskbarInputField.tsx`

- [ ] **Step 1: Add imports**

Add these imports to the existing import block at the top of `TaskbarInputField.tsx`:

```typescript
import { useArticleDownloadStore } from '@/afda/store/articleDownloadStore';
import {
  fetchAsDataUrl,
  generateArticleDocx,
  sanitizeFilename,
} from '@/afda/utils/articleDocxGenerator';
```

- [ ] **Step 2: Subscribe to `afdaStore` fetch state and article download actions**

Add these lines in the component body, after the existing `fetchAndOpenArticle` line:

```typescript
  const fetchState = useAfdaStore((state) => state.fetchState);
  const articleData = useAfdaStore((state) => state.articleData);
  const articleError = useAfdaStore((state) => state.articleError);
  const addArticleDownload = useArticleDownloadStore(
    (state) => state.addArticleDownload,
  );
  const updateArticleDownload = useArticleDownloadStore(
    (state) => state.updateArticleDownload,
  );
  const pendingArticleIdRef = useRef<string | null>(null);
```

- [ ] **Step 3: Replace the article branch of `handleDownload`**

Find the existing article branch in `handleDownload`:

```typescript
    // Article flow — fetch article and open the side panel as a viewer
    if (isArticle) {
      fetchAndOpenArticle(videoUrl.trim());
      resetModal();
      return;
    }
```

Replace it with:

```typescript
    // Article flow — open side panel and trigger background docx save
    if (isArticle) {
      const id = crypto.randomUUID();
      pendingArticleIdRef.current = id;
      addArticleDownload(id, videoUrl.trim());
      fetchAndOpenArticle(videoUrl.trim());
      resetModal();
      return;
    }
```

- [ ] **Step 4: Add `useEffect` to watch fetch completion**

Add the following `useEffect` after the existing effects in the component (before the `return` statement):

```typescript
  useEffect(() => {
    if (!pendingArticleIdRef.current) return;

    if (fetchState === 'success' && articleData) {
      const id = pendingArticleIdRef.current;
      pendingArticleIdRef.current = null;
      const currentDownloadFolder =
        useTaskbarDownloadStore.getState().downloadFolder;

      (async () => {
        try {
          const buffer = await generateArticleDocx(articleData);
          const filename = sanitizeFilename(articleData.article_title);
          const filePath = `${currentDownloadFolder}${filename}.docx`;

          const result = await window.downlodrFunctions.saveBufferToFile(
            Array.from(buffer),
            filePath,
          );

          const fileSize = result.success
            ? ((await window.downlodrFunctions.getFileSize(filePath)) ?? 0)
            : 0;

          const thumbUrl = articleData.article_images[0]?.url ?? null;
          const thumbnailDataUrl = thumbUrl
            ? await fetchAsDataUrl(thumbUrl)
            : null;

          updateArticleDownload(id, {
            status: result.success ? 'finished' : 'failed',
            filePath: result.success ? filePath : null,
            fileSize: result.success ? fileSize : null,
            title: articleData.article_title ?? 'Article',
            articleData,
            thumbnailDataUrl,
            ...(result.success ? {} : { errorMessage: result.error }),
          });
        } catch (err) {
          updateArticleDownload(id, {
            status: 'failed',
            errorMessage:
              err instanceof Error ? err.message : 'Unknown error',
          });
        }
      })();
    } else if (fetchState === 'error' && articleError) {
      const id = pendingArticleIdRef.current;
      pendingArticleIdRef.current = null;
      updateArticleDownload(id, {
        status: 'failed',
        errorMessage:
          articleError.article_error_status ?? 'Failed to fetch article',
      });
    }
  }, [fetchState, articleData, articleError]);
```

- [ ] **Step 5: Commit**

```bash
git add src/downlodr/components/base/InputField/TaskbarInputField.tsx
git commit -m "feat(afda): trigger article docx download from TaskbarInputField"
```

---

## Task 6: Create `ArticleDownloadTableRow`

**Files:**
- Create: `src/afda/components/ArticleDownloadTableRow.tsx`

- [ ] **Step 1: Create the component**

```typescript
// src/afda/components/ArticleDownloadTableRow.tsx
import TooltipWrapper from '@/core-app/components/wrapper/TooltipWrapper';
import type { ArticleSearchableDownload } from '@/downlodr/store/taskbarDownloadStore';
import type { DisplayColumn } from '@/downlodr/pages/status/statusPageTypes';
import { formatFileSize, formatRelativeTime } from '@/downlodr/pages/status/statusPageUtils';
import React from 'react';
import { HiOutlineFolderOpen } from 'react-icons/hi';
import { AiOutlineFileWord } from 'react-icons/ai';

interface ArticleDownloadTableRowProps {
  download: ArticleSearchableDownload;
  displayColumns: DisplayColumn[];
  isChecked: boolean;
  isSelectedDownload: boolean;
  index: number;
  onCheckboxChange: () => void;
  onRowClick: () => void;
}

export const ArticleDownloadTableRow: React.FC<
  ArticleDownloadTableRowProps
> = ({
  download,
  displayColumns,
  isChecked,
  isSelectedDownload,
  index,
  onCheckboxChange,
  onRowClick,
}) => {
  const handleRowClick = () => {
    onRowClick();
    onCheckboxChange();
  };

  const openFolder = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (download.location) {
      window.downlodrFunctions.openFolder(download.location, download.name);
    }
  };

  return (
    <tr
      className={`border-b hover:bg-gray-50 dark:border-[#F2F2F2] dark:hover:bg-darkModeHover cursor-pointer ${
        isSelectedDownload
          ? 'bg-blue-50 dark:bg-gray-600'
          : index === 0
          ? ''
          : 'dark:bg-darkMode'
      }`}
      onClick={handleRowClick}
      data-download-id={download.id}
    >
      <td className="w-8 p-2">
        <input
          type="checkbox"
          className="ml-2 mt-1 rounded border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:checked:bg-blue-500"
          checked={isChecked}
          onChange={(e) => {
            e.stopPropagation();
            onCheckboxChange();
          }}
        />
      </td>

      {displayColumns.map((column) => {
        switch (column.id) {
          case 'name':
            return (
              <td
                key={column.id}
                style={{ width: column.width }}
                className="p-2 dark:text-gray-200 flex justify-start items-center"
              >
                <div className="flex items-center gap-3 w-full">
                  <div className="flex-shrink-0 h-9 w-16 flex items-center justify-center bg-blue-50 dark:bg-blue-900/20 rounded">
                    <AiOutlineFileWord
                      size={24}
                      className="text-blue-600 dark:text-blue-400"
                    />
                  </div>
                  <TooltipWrapper content={download.name} side="bottom">
                    <span className="line-clamp-2 break-words break-all font-semibold min-w-0 flex-1">
                      {download.name || download.url}
                    </span>
                  </TooltipWrapper>
                </div>
              </td>
            );

          case 'status':
            return (
              <td
                key={column.id}
                style={{ width: column.width - 10 }}
                className="p-1 ml-1"
              >
                <div className="flex justify-center">
                  {download.status === 'loading' && (
                    <TooltipWrapper content="Generating docx…" side="bottom">
                      <span className="animate-spin text-blue-500 text-lg">
                        ⟳
                      </span>
                    </TooltipWrapper>
                  )}
                  {download.status === 'finished' && (
                    <TooltipWrapper content="Open folder" side="bottom">
                      <button onClick={openFolder}>
                        <HiOutlineFolderOpen
                          size={20}
                          className="text-green-600 hover:text-green-400 transition-colors duration-200"
                        />
                      </button>
                    </TooltipWrapper>
                  )}
                  {download.status === 'failed' && (
                    <TooltipWrapper
                      content={download.errorMessage ?? 'Failed'}
                      side="bottom"
                    >
                      <span className="text-red-500 text-lg">✕</span>
                    </TooltipWrapper>
                  )}
                </div>
              </td>
            );

          case 'size':
            return (
              <td
                key={column.id}
                style={{ width: column.width }}
                className="px-2 py-2 dark:text-gray-200 text-left"
              >
                <span className="whitespace-nowrap overflow-hidden">
                  {download.status === 'finished' && download.size
                    ? formatFileSize(download.size)
                    : '—'}
                </span>
              </td>
            );

          case 'format':
            return (
              <td
                key={column.id}
                style={{ width: Math.max(column.width), minWidth: '70px' }}
                className="p-2 text-center align-middle"
              >
                <span className="text-sm font-medium text-gray-600 dark:text-gray-300">
                  docx
                </span>
              </td>
            );

          case 'dateAdded':
            return (
              <td
                key={column.id}
                style={{ width: column.width }}
                className="p-2 dark:text-gray-200 ml-2 justify-center text-center"
              >
                <TooltipWrapper
                  content={new Date(download.DateAdded).toLocaleDateString()}
                  side="bottom"
                >
                  <div>{formatRelativeTime(download.DateAdded)}</div>
                </TooltipWrapper>
              </td>
            );

          case 'speed':
          case 'transcript':
          case 'source':
            return (
              <td
                key={column.id}
                style={{ width: column.width }}
                className="p-2 dark:text-gray-200 text-center"
              >
                <span>—</span>
              </td>
            );

          case 'action':
            return (
              <td
                key={column.id}
                style={{ width: column.width }}
                className="p-2 dark:text-gray-200 text-center"
              >
                {download.status === 'finished' && (
                  <TooltipWrapper content="Open folder" side="bottom">
                    <button
                      onClick={openFolder}
                      className="p-1 hover:opacity-80 transition-opacity"
                    >
                      <HiOutlineFolderOpen
                        size={14}
                        className="text-gray-500 dark:text-gray-400"
                      />
                    </button>
                  </TooltipWrapper>
                )}
              </td>
            );

          default:
            return null;
        }
      })}
    </tr>
  );
};
```

- [ ] **Step 2: Commit**

```bash
git add src/afda/components/ArticleDownloadTableRow.tsx
git commit -m "feat(afda): add ArticleDownloadTableRow component"
```

---

## Task 7: Integrate article downloads into `StatusPage` and `StatusPageTable`

**Files:**
- Modify: `src/downlodr/pages/StatusPage.tsx`
- Modify: `src/downlodr/pages/status/StatusPageTable.tsx`

- [ ] **Step 1: Add article downloads to `allDownloads` in `StatusPage.tsx`**

Add this import at the top of `src/downlodr/pages/StatusPage.tsx`:

```typescript
import { useArticleDownloadStore } from '@/afda/store/articleDownloadStore';
import type { ArticleSearchableDownload } from '../store/taskbarDownloadStore';
```

Add this selector in the component body (after the existing `queuedDownloads` selector):

```typescript
  const articleDownloads = useArticleDownloadStore(
    (state) => state.articleDownloads,
  );
```

Update the `allDownloads` `useMemo`. Find the section that builds `merged`:

```typescript
  const allDownloads = useMemo((): SearchableDownload[] => {
    if (isSearchActive) {
      return searchResults;
    }
    const merged = [
      ...forDownloads,
      ...downloading,
      ...finishedDownloads,
      ...history,
      ...queuedDownloads,
    ].filter(
      (download, index, self) =>
        index === self.findIndex((d) => d.id === download.id),
    );
```

Replace with:

```typescript
  const allDownloads = useMemo((): SearchableDownload[] => {
    if (isSearchActive) {
      return searchResults;
    }
    const merged = [
      ...forDownloads,
      ...downloading,
      ...finishedDownloads,
      ...history,
      ...queuedDownloads,
    ].filter(
      (download, index, self) =>
        index === self.findIndex((d) => d.id === download.id),
    );

    const mappedArticles: ArticleSearchableDownload[] = articleDownloads.map(
      (a) => ({
        type: 'article' as const,
        id: a.id,
        name: a.title || a.url,
        displayName: a.title || undefined,
        status: a.status,
        size: a.fileSize ?? 0,
        DateAdded: a.dateAdded,
        location: a.filePath ?? '',
        videoUrl: a.url,
        downloadName: a.title || a.url,
        channelName: '',
        extractorKey: 'Article',
        formatId: '',
        audioExt: '',
        audioFormatId: '',
        ext: 'docx',
        speed: '',
        timeLeft: '',
        progress: a.status === 'finished' ? 100 : a.status === 'failed' ? 0 : 50,
        isLive: false,
        duration: 0,
        getTranscript: false,
        getThumbnail: false,
        tags: [],
        category: [],
        automaticCaption: null,
        thumbnails: null,
        errorMessage: a.errorMessage,
      }),
    );
```

Then replace the entire `byStatus` block and closing of the `useMemo` with:

```typescript
    const allItems = [...merged, ...mappedArticles];
    const byStatus = currentStatus
      ? currentStatus.toLowerCase() === 'all'
        ? allItems
        : currentStatus.toLowerCase() === 'subscriptions'
        ? merged.filter((d) => !!d.subscriptionId)
        : allItems.filter(
            (d) => d.status.toLowerCase() === currentStatus.toLowerCase(),
          )
      : allItems;
    return sortDownloadsByColumn(byStatus, sortColumn, sortDirection);
  }, [
    forDownloads,
    downloading,
    finishedDownloads,
    history,
    queuedDownloads,
    articleDownloads,
    currentStatus,
    sortColumn,
    sortDirection,
    isSearchActive,
    searchQuery,
  ]);
```

- [ ] **Step 2: Render `ArticleDownloadTableRow` in `StatusPageTable.tsx`**

Add this import at the top of `src/downlodr/pages/status/StatusPageTable.tsx`:

```typescript
import { ArticleDownloadTableRow } from '@/afda/components/ArticleDownloadTableRow';
import type { ArticleSearchableDownload } from '@/downlodr/store/taskbarDownloadStore';
```

Find the `ungrouped` render block in `renderItems.map`:

```typescript
                  if (item.type === 'ungrouped') {
                    return (
                      <StatusPageTableRow
                        key={item.download.id}
```

Replace with:

```typescript
                  if (item.type === 'ungrouped') {
                    if (
                      'type' in item.download &&
                      (item.download as ArticleSearchableDownload).type ===
                        'article'
                    ) {
                      const articleDownload =
                        item.download as ArticleSearchableDownload;
                      return (
                        <ArticleDownloadTableRow
                          key={articleDownload.id}
                          download={articleDownload}
                          displayColumns={effectiveDisplayColumns}
                          isChecked={selectedRowIds.includes(articleDownload.id)}
                          isSelectedDownload={
                            selectedDownloadId === articleDownload.id
                          }
                          index={item.index}
                          onCheckboxChange={() =>
                            onCheckboxChange(articleDownload.id)
                          }
                          onRowClick={() => {
                            onClosePluginSidebar();
                            onRowClick(articleDownload.id);
                          }}
                        />
                      );
                    }

                    return (
                      <StatusPageTableRow
                        key={item.download.id}
```

- [ ] **Step 3: Commit**

```bash
git add src/downlodr/pages/StatusPage.tsx src/downlodr/pages/status/StatusPageTable.tsx
git commit -m "feat(afda): integrate article downloads into StatusPage and StatusPageTable"
```

---

## Self-Review Checklist

After completing all tasks, verify:

- [ ] Article entry appears in the table immediately on download click (status `loading`)
- [ ] Entry transitions to `finished` after the side panel finishes fetching, with file size shown
- [ ] Entry transitions to `failed` if the article fetch errors, with tooltip showing reason
- [ ] `.docx` file is saved to `downloadFolder` with a 20-char sanitized filename
- [ ] Clicking the folder icon opens the download folder in the OS explorer
- [ ] All other columns show `—` for article rows
- [ ] `format` column shows `docx` badge
- [ ] Entries persist across app restarts (IndexedDB)
- [ ] Existing video download rows are unaffected
