/**
 * Side-effect-only module: populates global.__electronPaths for the main
 * process. Must be main.ts's FIRST import — Rollup concatenates every
 * statically-imported module's top-level code before main.ts's own body
 * runs, so a function call inside that body (even at the very top) is
 * already too late for modules like skedulosaHandler.ts that transitively
 * require('better-sqlite3') at their own top level.
 */
import { app } from 'electron';
import { setElectronPaths } from './electronPaths';

setElectronPaths({
  isPackaged: app.isPackaged,
  resourcesPath: process.resourcesPath,
  appPath: app.getAppPath(),
});
