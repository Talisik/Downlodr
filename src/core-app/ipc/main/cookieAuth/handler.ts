import { BrowserWindow, dialog, ipcMain } from 'electron';
import { importCookies, importFile, type ImportResult } from './jarImport';
import { openSiteLoginWindow } from './siteLoginWindow';
import { listSiteLogins, removeSiteLogin, type SiteLogin } from './siteLogins';
import {
  type CookieAuthMode,
  getCookieAuthState,
  setCookieAuthMode,
} from './state';

export const cookieAuthHandler = (mainWindow: BrowserWindow): (() => void) => {
  ipcMain.handle('cookieAuth:getState', () => getCookieAuthState());

  ipcMain.handle(
    'cookieAuth:setMode',
    (_e, mode: CookieAuthMode, browser: string | null) => {
      setCookieAuthMode(mode, browser);
    },
  );

  ipcMain.handle(
    'cookieAuth:import',
    async (_e, browser: string): Promise<ImportResult> => {
      try {
        return await importCookies(browser);
      } catch (err) {
        return {
          ok: false,
          error: `Could not import cookies from ${browser}: ${
            err instanceof Error ? err.message : String(err)
          }`,
        };
      }
    },
  );

  ipcMain.handle('cookieAuth:importFile', async (e): Promise<ImportResult> => {
    const win = BrowserWindow.fromWebContents(e.sender);
    const result = await dialog.showOpenDialog(win ?? undefined, {
      title: 'Choose a cookies.txt file',
      properties: ['openFile'],
      filters: [
        { name: 'Cookie files', extensions: ['txt'] },
        { name: 'All Files', extensions: ['*'] },
      ],
    });
    if (result.canceled || result.filePaths.length === 0) {
      return { ok: false, error: 'No file selected.' };
    }
    try {
      return await importFile(result.filePaths[0]);
    } catch (err) {
      return {
        ok: false,
        error: `Could not import that file: ${
          err instanceof Error ? err.message : String(err)
        }`,
      };
    }
  });

  ipcMain.handle('cookieAuth:siteLogin:open', async (_e, url: string) => {
    try {
      return await openSiteLoginWindow(url, mainWindow);
    } catch (err) {
      return {
        ok: false,
        error: err instanceof Error ? err.message : String(err),
      };
    }
  });

  ipcMain.handle('cookieAuth:siteLogin:list', (): Promise<SiteLogin[]> => listSiteLogins());

  ipcMain.handle('cookieAuth:siteLogin:remove', async (_e, domain: string) => {
    try {
      return await removeSiteLogin(domain);
    } catch {
      return { ok: false };
    }
  });

  return () => {
    ipcMain.removeHandler('cookieAuth:getState');
    ipcMain.removeHandler('cookieAuth:setMode');
    ipcMain.removeHandler('cookieAuth:import');
    ipcMain.removeHandler('cookieAuth:importFile');
    ipcMain.removeHandler('cookieAuth:siteLogin:open');
    ipcMain.removeHandler('cookieAuth:siteLogin:list');
    ipcMain.removeHandler('cookieAuth:siteLogin:remove');
  };
};
