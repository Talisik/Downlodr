import { app, BrowserWindow, ipcMain, dialog, shell } from 'electron';
import path from 'path';
import started from 'electron-squirrel-startup';

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
    minWidth: 500, // Add minimum width
    minHeight: 400, // Add minimum height
    webPreferences: {
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js'),
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

};


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
