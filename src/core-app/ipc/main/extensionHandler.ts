import { ipcMain } from 'electron';
import { setupExtendr } from '../../../extension/utils/extensionLoader';

export const extensionHandler = () => {
  ipcMain.handle('setup-extendr', async () => {
    await setupExtendr();
  });
};
