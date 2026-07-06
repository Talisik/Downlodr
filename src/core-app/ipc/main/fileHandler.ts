/* Handler for file operations of base app such as opening, deleting, calling select folder dialog, etc. */

import { BrowserWindow, dialog, ipcMain, shell } from 'electron';
import fs, { existsSync } from 'fs';
import os from 'os';
import path from 'path';

export const fileHandler = (mainWindow: BrowserWindow) => {
  ipcMain.handle('joinDownloadPath', async (event, downloadPath, fileName) => {
    const normalizedPath = downloadPath.endsWith(path.sep)
      ? downloadPath
      : downloadPath + path.sep;
    return path.join(normalizedPath, fileName);
  });

  ipcMain.handle(
    'downloadFile',
    async (
      _event,
      url: string,
      outputPath: string,
    ): Promise<{ success: boolean; path?: string; error?: string }> => {
      try {
        const dir = path.dirname(outputPath);
        await fs.promises.mkdir(dir, { recursive: true });
        const response = await fetch(url, { redirect: 'follow' });
        if (!response.ok) {
          return {
            success: false,
            error: `HTTP ${response.status}: ${response.statusText}`,
          };
        }
        const buffer = Buffer.from(await response.arrayBuffer());
        await fs.promises.writeFile(outputPath, buffer);
        return { success: true, path: outputPath };
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        return { success: false, error: message };
      }
    },
  );

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

  ipcMain.handle('createFolder', async (_event, dirPath) => {
    if (!fs.existsSync(dirPath)) {
      await fs.promises.mkdir(dirPath, { recursive: true });
    }
    return true;
  });
  ipcMain.handle('getDownloadFolder', async () => {
    try {
      const homedir = os.homedir();
      let downloadsPath;

      switch (process.platform) {
        case 'win32':
          downloadsPath = path.join(homedir, 'Downloads') + path.sep;
          break;
        case 'darwin':
          downloadsPath = path.join(homedir, 'Downloads') + path.sep;
          break;
        case 'linux':
          downloadsPath = path.join(homedir, 'Downloads') + path.sep;
          break;
        default:
          downloadsPath = path.join(homedir, 'Downloads') + path.sep;
      }

      return downloadsPath;
    } catch (error) {
      // console.error('Error determining Downloads folder:', error);
      return null;
    }
  });
  ipcMain.handle('validatePath', async (event, folderPath) => {
    try {
      const resolvedPath = path.resolve(folderPath);

      // Check if the resolved path exists and is a directory
      const stats = await fs.promises.stat(resolvedPath);
      if (!stats.isDirectory()) {
        return false;
      }
      await fs.promises.access(
        resolvedPath,
        fs.constants.R_OK | fs.constants.W_OK,
      );

      return true;
    } catch (err) {
      return false;
    }
  });
  ipcMain.handle('dialog:openDirectory', async (event) => {
    // Get the parent browser window
    const browserWindow = BrowserWindow.fromWebContents(event.sender);

    const result = await dialog.showOpenDialog(browserWindow, {
      properties: ['openDirectory'],
      // Explicitly set modal behavior
      // modal: true,
    });

    // Process the result as before
    if (result.canceled || !result.filePaths || result.filePaths.length === 0) {
      return null;
    }

    return result.filePaths[0].endsWith(path.sep)
      ? result.filePaths[0]
      : result.filePaths[0] + path.sep;
  });

  ipcMain.handle('dialog:selectVideoFile', async (event) => {
    const browserWindow = BrowserWindow.fromWebContents(event.sender);

    const result = await dialog.showOpenDialog(browserWindow, {
      properties: ['openFile'],
      title: 'Select Video or Audio File to Transcribe',
      filters: [
        {
          name: 'Video & Audio Files',
          extensions: [
            'mp4',
            'mkv',
            'avi',
            'mov',
            'wmv',
            'flv',
            'webm',
            'mp3',
            'wav',
            'm4a',
            'aac',
            'ogg',
            'flac',
            'wma',
          ],
        },
        {
          name: 'Video Files',
          extensions: ['mp4', 'mkv', 'avi', 'mov', 'wmv', 'flv', 'webm'],
        },
        {
          name: 'Audio Files',
          extensions: ['mp3', 'wav', 'm4a', 'aac', 'ogg', 'flac', 'wma'],
        },
        { name: 'All Files', extensions: ['*'] },
      ],
    });

    if (result.canceled || !result.filePaths || result.filePaths.length === 0) {
      return null;
    }

    return result.filePaths[0];
  });

  ipcMain.handle('open-folder', async (_, folderPath, filePath = null) => {
    try {
      // If a file path is provided, show the file in the folder (will highlight it)
      if (filePath) {
        await shell.showItemInFolder(filePath);
        return { success: true };
      } else {
        // Otherwise just open the folder without highlighting anything
        const result = await shell.openPath(folderPath);
        if (result) {
          return { success: false, error: result };
        }
        return { success: true };
      }
    } catch (error) {
      console.error('Failed to open folder:', error);
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('file-exists', async (_event, path) => {
    return existsSync(path);
  });

  ipcMain.handle('openVideo', async (event, filePath) => {
    shell.openPath(filePath);
  });

  ipcMain.handle('deleteFile', async (event, filepath) => {
    try {
      // Normalize the file path
      const normalizedPath = path.normalize(filepath);

      // Check if the file exists
      if (!fs.existsSync(normalizedPath)) {
        console.error('File does not exist:', normalizedPath);
        return false;
      }

      // Move the file to trash
      await shell.trashItem(normalizedPath);
      //console.log('File moved to trash successfully');
      return true;
    } catch (error) {
      return false;
    }
  });

  ipcMain.handle('deleteFolder', async (event, filepath) => {
    try {
      // Normalize the folder path
      const normalizedPath = path.normalize(filepath);

      // Check if the folder exists
      if (!fs.existsSync(normalizedPath)) {
        return false;
      }

      // Check if it's actually a directory
      const stats = await fs.promises.stat(normalizedPath);
      if (!stats.isDirectory()) {
        return false;
      }

      // Move the folder to trash
      await shell.trashItem(normalizedPath);
      return true;
    } catch (error) {
      return false;
    }
  });

  ipcMain.handle('normalizePath', async (event, filepath) => {
    try {
      // Normalize the file path
      const normalizedPath = path.normalize(filepath);
      return normalizedPath;
    } catch (error) {
      return '';
    }
  });

  ipcMain.handle(
    'article-html-to-pdf',
    async (
      _event,
      htmlContent: string,
    ): Promise<{ success: boolean; data?: number[]; error?: string }> => {
      let win: BrowserWindow | null = null;
      const tempFile = path.join(os.tmpdir(), `afda-article-${Date.now()}.html`);
      try {
        fs.writeFileSync(tempFile, htmlContent, 'utf-8');
        win = new BrowserWindow({
          show: false,
          webPreferences: { contextIsolation: true, nodeIntegration: false },
        });
        await new Promise<void>((resolve, reject) => {
          win!.webContents.once('did-finish-load', resolve);
          win!.webContents.once('did-fail-load', (_e, code, desc) =>
            reject(new Error(`Page load failed: ${desc} (${code})`)),
          );
          win!.loadFile(tempFile).catch(reject);
        });
        const pdfBuffer = await win.webContents.printToPDF({
          printBackground: true,
          pageSize: 'A4',
        });
        return { success: true, data: Array.from(new Uint8Array(pdfBuffer)) };
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        return { success: false, error: message };
      } finally {
        if (win && !win.isDestroyed()) win.destroy();
        try { fs.unlinkSync(tempFile); } catch { /* ignore */ }
      }
    },
  );

  ipcMain.handle('ensureDirectoryExists', async (event, dirPath) => {
    try {
      try {
        await fs.promises.access(dirPath, fs.constants.F_OK);
        return true; // Directory already exists
      } catch (error) {
        // Directory doesn't exist, create it
        await fs.promises.mkdir(dirPath, { recursive: true });
        return true;
      }
    } catch (error) {
      return false;
    }
  });
};
