import { app, BrowserWindow, ipcMain, dialog, shell } from 'electron';
import path from 'path';
import started from 'electron-squirrel-startup';
import os from 'os';
import * as YTDLP from 'yt-dlp-helper';
import fs, { existsSync } from 'fs';

// Handle creating/removing shortcuts on Windows when installing/uninstalling.
if (started) {
  app.quit();
}

declare const MAIN_WINDOW_VITE_DEV_SERVER_URL: string;
declare const MAIN_WINDOW_VITE_NAME: string;

const createWindow = () => {
  // Create the browser window.
  const mainWindow = new BrowserWindow({
    width: 1000,
    height: 600,
    frame: false,
    // icon: '256x256', //    icon: './src/Assets/appLogo/png 256x256',
    autoHideMenuBar: true,
    minWidth: 550, // Add minimum width
    minHeight: 400, // Add minimum height
    webPreferences: {
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js'),
      webSecurity: true,
      nodeIntegration: true,
      // devTools: false,
    },
  });

  if (MAIN_WINDOW_VITE_DEV_SERVER_URL) {
    mainWindow.loadURL(MAIN_WINDOW_VITE_DEV_SERVER_URL);
    // Only open DevTools in development
    mainWindow.webContents.openDevTools();
  } else {
    mainWindow.loadFile(
      path.join(__dirname, `../renderer/${MAIN_WINDOW_VITE_NAME}/index.html`),
    );
  }

  // MAIN FUNCTIONS FOR TITLE BAR

  ipcMain.on('close-btn', () => {
    mainWindow.close();
  });

  ipcMain.on('minimize-btn', () => {
    mainWindow.minimize();
  });

  ipcMain.on('maximize-btn', () => {
    if (mainWindow.isMaximized()) {
      mainWindow.unmaximize();
    } else {
      mainWindow.maximize();
    }
  });

  // Add this to handle file protocol security
  mainWindow.webContents.on('will-navigate', (event, url) => {
    event.preventDefault();
  });
};

// Functions for Download Verification

ipcMain.handle('joinDownloadPath', async (event, downloadPath, fileName) => {
  const normalizedPath = downloadPath.endsWith(path.sep)
    ? downloadPath
    : downloadPath + path.sep;
  return path.join(normalizedPath, fileName);
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
    console.error('Error determining Downloads folder:', error);
    return null; // or a default path if you prefer
  }
});

ipcMain.handle('validatePath', async (event, folderPath) => {
  try {
    const resolvedPath = path.resolve(folderPath);

    // Check if the resolved path exists and is a directory
    const stats = await fs.promises.stat(resolvedPath);
    if (!stats.isDirectory()) {
      console.error('Path is not a directory:', resolvedPath);
      return false;
    }

    // Check if the directory is accessible
    await fs.promises.access(
      resolvedPath,
      fs.constants.R_OK | fs.constants.W_OK,
    );

    return true;
  } catch (err) {
    console.error('Path is not accessible or invalid:');
    return false;
  }
});

ipcMain.handle('dialog:openDirectory', async () => {
  const result = await dialog.showOpenDialog({
    properties: ['openDirectory'],
  });
  return result.filePaths[0].endsWith(path.sep)
    ? result.filePaths[0]
    : result.filePaths[0] + path.sep;
});

ipcMain.handle('open-folder', async (_, folderPath) => {
  try {
    const result = await shell.openPath(folderPath);
    if (result) {
      console.error(`Error opening folder: ${result}`);
      return { success: false, error: result };
    }
    return { success: true };
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
    console.log('File moved to trash successfully');
    return true;
  } catch (error) {
    console.error('Failed to move file to trash:', error);
    return false;
  }
});

ipcMain.handle('normalizePath', async (event, filepath) => {
  try {
    // Normalize the file path
    const normalizedPath = path.normalize(filepath);
    return normalizedPath;
  } catch (error) {
    console.error('Failed to normalize:', error);
    return '';
  }
});
// YTDLP functons

ipcMain.on('ytdlp:playlist:info', async (event, url) => {
  console.log('Fetching playlist info for URL:', url);
  try {
    const info = await YTDLP.getPlaylistInfo({
      url: url,
      // ytdlpDownloadDestination: os.tmpdir(),
      // ffmpegDownloadDestination: os.tmpdir(),
    });
    // console.log(info);
    event.returnValue = info;
  } catch (error) {
    console.error('Error fetching playlist info:', error);
    event.returnValue = { error: 'Failed to fetch playlist info.' };
  }
});

ipcMain.handle('ytdlp:playlist:info', async (e, videoUrl) => {
  try {
    const info = await YTDLP.getPlaylistInfo({
      url: videoUrl.url,
      //ytdlpDownloadDestination: os.tmpdir(),
      // ffmpegDownloadDestination: os.tmpdir(),
    });
    console.log(videoUrl.url);
    return info;
  } catch (error) {
    console.error('Error fetching playlist info:', error);
    throw error; // Propagate the error to the renderer process
  }
});

// Register the IPC handler before loading the window
ipcMain.handle('ytdlp:info', async (e, url) => {
  YTDLP.Config.log = true;
  try {
    const info = await YTDLP.getInfo(url);
    if (!info) {
      throw new Error('No info returned from YTDLP.getInfo');
    }
    console.log(info.data.formats);
    return info;
  } catch (error) {
    console.error('Error fetching video info:', error);
    return { error: error.message }; // Optionally send a default response
  }
});

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function killControllerById(id: any) {
  try {
    const controller = YTDLP.getTerminalFromID(id);
    // const controller2 = YTDLP.Terminal.fromID(id);

    if (controller) {
      controller.kill(); // Call the kill function
      console.log(`Controller with ID ${id} has been killed.`);
      return true;
    } else {
      console.log(`Controller with ID ${id} not found.`);
      return false;
    }
  } catch (error) {
    console.error(`Failed to kill controller with ID ${id}:`, error);
    return false;
  }
}

ipcMain.handle('ytdlp:stop', (e, id: string) => {
  try {
    const terminal = YTDLP.getTerminalFromID(id);

    if (!terminal) {
      console.log(`No terminal found for ID: ${id}`);
      return false;
    }

    terminal.kill('SIGKILL');
    console.log('i went through stop and true');
    return true;
  } catch (error) {
    console.error('Error stopping download:', error);
    return false;
  }
});
// Listen for the kill-controller event from the renderer
ipcMain.handle('kill-controller', async (_, id) => {
  return killControllerById(id); // Call the function and return the result
});

ipcMain.handle('ytdlp:download', async (e, id, args) => {
  console.log('Downloading...', args);

  try {
    const controller = await YTDLP.download({
      args: {
        url: args.url,
        output: args.outputFilepath,
        videoFormat: args.videoFormat,
        remuxVideo: args.ext,
        audioFormat: args.audioFormat,
        audioQuality: args.audioQuality,
        // limitRate: '50k',
      },
    });

    console.log('Controller Main:', controller.id);
    console.log(
      'Controller methods Main:',
      Object.getOwnPropertyNames(Object.getPrototypeOf(controller)),
    );

    if (!controller || typeof controller.listen !== 'function') {
      throw new Error(
        'Controller is not defined or does not have a listen method',
      );
    }

    //  let stopping = false;

    // Send the controller ID back to the renderer process
    e.sender.send(`ytdlp:controller:${id}`, {
      downloadId: id,
      controllerId: controller.id,
    });

    for await (const chunk of controller.listen()) {
      // if (!stopping) {
      //  stopping = true;
      //  setTimeout(() => controller.kill(), 1_000); // Stop the process after 1 second.
      //  }
      // Send the download status back to the renderer process
      e.sender.send(`ytdlp:download:status:${id}`, chunk);
    }
    // Return the download ID and controller ID
    return { downloadId: id, controllerId: controller.id };
  } catch (error) {
    console.error('Error during download:', error);
    e.sender.send(`ytdlp:download:error:${id}`, error.message);
    throw error; // Ensure the error is propagated
  }
});

app.on('ready', createWindow);

// Quit when all windows are closed, except on macOS. There, it's common
// for applications and their menu bar to stay active until the user quits
// explicitly with Cmd + Q.
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  // On OS X it's common to re-create a window in the app when the
  // dock icon is clicked and there are no other windows open.
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});

// In this file you can include the rest of your app's specific main process
// code. You can also put them in separate files and import them here.

ipcMain.on('toggle-dev-tools', () => {
  const win = BrowserWindow.getFocusedWindow();
  if (win) {
    if (win.webContents.isDevToolsOpened()) {
      win.webContents.closeDevTools();
    } else {
      win.webContents.openDevTools();
    }
  }
});
