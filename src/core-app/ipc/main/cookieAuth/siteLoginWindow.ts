import { BaseWindow, BrowserWindow, WebContentsView, ipcMain, session } from 'electron';
import { mkdir, writeFile } from 'fs/promises';
import path from 'path';
import { extractRegistrableDomain } from './domain';
import { serializeCookiesToNetscapeJar } from './netscapeSerializer';
import { partitionNameFor, siteJarPathFor, upsertSiteLogin } from './siteLogins';

export interface SiteLoginResult {
  ok: boolean;
  domain?: string;
  error?: string;
}

const TOP_BAR_HEIGHT = 40;

function escapeHtml(text: string): string {
  return text.replace(/[&<>"']/g, (c) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
  }[c] as string));
}

function topBarHtml(domain: string): string {
  return `<!doctype html>
<html><head><meta charset="utf-8"><style>
  body { margin:0; display:flex; align-items:center; gap:8px; height:${TOP_BAR_HEIGHT}px;
    background:#1f2937; font-family:system-ui,sans-serif; padding:0 12px; box-sizing:border-box; }
  #hint { color:#9ca3af; font-size:12px; margin-right:auto; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
  button { font-size:12px; padding:6px 12px; border-radius:6px; border:1px solid #4b5563; cursor:pointer; }
  #done { background:#ea580c; color:white; border-color:#ea580c; }
  #cancel { background:transparent; color:#e5e7eb; }
</style></head>
<body>
  <span id="hint">Log in to ${escapeHtml(domain)}, then click Done.</span>
  <button id="cancel">Cancel</button>
  <button id="done">Done, I'm logged in</button>
  <script>
    const { ipcRenderer } = require('electron');
    document.getElementById('done').onclick = () => ipcRenderer.send('siteLoginTopBar:done');
    document.getElementById('cancel').onclick = () => ipcRenderer.send('siteLoginTopBar:cancel');
  </script>
</body></html>`;
}

let activeWindow: BaseWindow | null = null;

export async function openSiteLoginWindow(
  pastedUrl: string,
  parent: BrowserWindow | null,
): Promise<SiteLoginResult> {
  if (activeWindow && !activeWindow.isDestroyed()) {
    return { ok: false, error: 'A login window is already open. Finish or cancel it first.' };
  }

  const initialDomain = extractRegistrableDomain(pastedUrl);
  if (!initialDomain) {
    return { ok: false, error: 'That does not look like a valid URL.' };
  }

  const win = new BaseWindow({
    width: 900,
    height: 700,
    title: `Log in — ${initialDomain}`,
    parent: parent ?? undefined,
  });
  activeWindow = win;

  const topBar = new WebContentsView({
    webPreferences: { nodeIntegration: true, contextIsolation: false },
  });
  const content = new WebContentsView({
    webPreferences: {
      partition: partitionNameFor(initialDomain),
      contextIsolation: true,
      nodeIntegration: false,
      webSecurity: true,
    },
  });

  win.contentView.addChildView(topBar);
  win.contentView.addChildView(content);

  const layout = () => {
    const [w, h] = win.getContentSize();
    topBar.setBounds({ x: 0, y: 0, width: w, height: TOP_BAR_HEIGHT });
    content.setBounds({ x: 0, y: TOP_BAR_HEIGHT, width: w, height: Math.max(0, h - TOP_BAR_HEIGHT) });
  };
  layout();
  win.on('resize', layout);

  topBar.webContents
    .loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(topBarHtml(initialDomain))}`)
    .catch(() => undefined);
  content.webContents.loadURL(pastedUrl).catch(() => undefined);

  let lastKnownUrl = pastedUrl;
  content.webContents.on('did-navigate', (_e, url) => {
    lastKnownUrl = url;
  });
  content.webContents.on('did-navigate-in-page', (_e, url) => {
    lastKnownUrl = url;
  });

  content.webContents.setWindowOpenHandler(() => {
    return { action: 'deny' };
  });

  return new Promise<SiteLoginResult>((resolve) => {
    let settled = false;

    const cleanupListeners = () => {
      ipcMain.removeAllListeners('siteLoginTopBar:done');
      ipcMain.removeAllListeners('siteLoginTopBar:cancel');
    };

    const finish = (result: SiteLoginResult) => {
      if (settled) return;
      settled = true;
      cleanupListeners();
      if (activeWindow === win) activeWindow = null;
      resolve(result);
      if (!topBar.webContents.isDestroyed()) topBar.webContents.close();
      if (!content.webContents.isDestroyed()) content.webContents.close();
      if (!win.isDestroyed()) win.close();
    };

    ipcMain.once('siteLoginTopBar:cancel', () => finish({ ok: false }));

    ipcMain.once('siteLoginTopBar:done', async () => {
      try {
        const domain = extractRegistrableDomain(lastKnownUrl) ?? initialDomain;
        const partitionSession = session.fromPartition(partitionNameFor(domain));
        const cookies = await partitionSession.cookies.get({});
        if (cookies.length === 0) {
          finish({
            ok: false,
            error: 'No cookies found — the login may not have completed.',
          });
          return;
        }
        const jarText = serializeCookiesToNetscapeJar(cookies);
        const jarPath = siteJarPathFor(domain);
        await mkdir(path.dirname(jarPath), { recursive: true });
        await writeFile(jarPath, jarText, 'utf-8');
        await upsertSiteLogin(domain, jarPath, pastedUrl);
        finish({ ok: true, domain });
      } catch (err) {
        finish({
          ok: false,
          error: `Could not save this login: ${
            err instanceof Error ? err.message : String(err)
          }`,
        });
      }
    });

    win.on('closed', () => finish({ ok: false }));
  });
}
