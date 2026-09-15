import { app } from 'electron';
import * as extendr from 'extendr';
import path from 'path';

extendr.Config.log = true;
extendr.Config.listenerPrefix = 'extendr';
extendr.Config.extensionsPaths = [
  {
    name: 'local',
    directory: path.join(app.getPath('userData'), 'extensions'),
  },
  {
    name: 'portable',
    directory: path.join(
      app.getPath('exe'),
      app.isPackaged ? '../extensions' : '../../../../extensions',
    ),
  },
];
extendr.Config.loadOrderPath = path.join(
  app.getPath('exe'),
  app.isPackaged ? '../load-order.json' : '../../../../load-order.json',
);

export async function setupExtendr() {
  // Find extensions first. Load order relies on the extensions being found.
  await extendr.Loadr.findExtensions();
  // Load the load order.
  await extendr.LoadOrdr.load();
  // Setup the main process.
  await extendr.Deployr.setupMain();
}
