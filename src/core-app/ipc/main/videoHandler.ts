/* Handler for developer tools of base app such as opening dev tools, etc. */
/* Handler for window behavior of base app such as closing, minimizing, maximizing, etc. */

import { BrowserWindow, ipcMain } from 'electron';
import fs from 'fs';
/**
 * Handles the behavior of the base app such as closing, minimizing, maximizing, etc.
 * @param mainWindow - The main window of the base app
 * @returns void
 */
export const videoHandler = (mainWindow: BrowserWindow) => {
  // function to handle the dev tools or console open
  ipcMain.handle('get-video-blob', async (_, filePath) => {
    try {
      // Check if file exists
      if (!fs.existsSync(filePath)) {
        console.error('Video file not found:', filePath);
        return null;
      }

      const stats = fs.statSync(filePath);
      const fileSizeInMB = stats.size / (1024 * 1024);
      const fileSizeInGB = fileSizeInMB / 1024;

      // For files larger than 2GB, we need streaming approach
      // Node.js readFileSync has a 2GB limit
      if (stats.size >= 2 * 1024 * 1024 * 1024) {
        return {
          type: 'stream',
          filePath: filePath,
          size: stats.size,
          mimeType: 'video/mp4',
        };
      }

      // For smaller files, use direct buffer approach
      const data = fs.readFileSync(filePath);
      return {
        type: 'buffer',
        data: new Uint8Array(data),
        size: data.length,
        mimeType: 'video/mp4',
      };
    } catch (err) {
      console.error('Error reading video:', err);
      return null;
    }
  });

  // New handler for streaming large files in chunks
  ipcMain.handle('get-video-chunk', async (_, filePath, start, end) => {
    try {
      const chunkSize = end - start;
      const buffer = Buffer.alloc(chunkSize);

      const fd = fs.openSync(filePath, 'r');
      const bytesRead = fs.readSync(fd, buffer, 0, chunkSize, start);
      fs.closeSync(fd);

      return {
        data: new Uint8Array(buffer.slice(0, bytesRead)),
        bytesRead: bytesRead,
      };
    } catch (err) {
      console.error('Error reading video chunk:', err);
      return null;
    }
  });
};
