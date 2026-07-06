/**
 * Preload script for the Electron application.
 * Imports all IPC renderer handlers so bridges are exposed to the renderer.
 * The renderer can use bridge names (e.g. window.fileInfoBridge) or the
 * composed API (window.downlodrFunctions, etc.) after calling initComposedWindowApi().
 */

import * as extendr from 'extendr';
import './core-app/ipc/renderer/baseAppHandler';
import './core-app/ipc/renderer/browserHandler';
import './core-app/ipc/renderer/downlodrHandler';
import './core-app/ipc/renderer/extensionHandler';
import './core-app/ipc/renderer/fileHandler';
import './core-app/ipc/renderer/pluginHandler';
import './core-app/ipc/renderer/skedulosaHandler';
import './core-app/ipc/renderer/telemetryHandler';
import './core-app/ipc/renderer/transcriptHandler';
import './core-app/ipc/renderer/afdaHandler';
import './core-app/ipc/renderer/addonHandler';
import './core-app/ipc/renderer/updateHandler';

extendr.Deployr.setupPreload();
