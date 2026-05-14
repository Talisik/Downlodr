/**
 * Entry point for the UI and App.tsx.
 * This file is responsible for rendering the main App component
 * into the DOM.
 */

import React from 'react';
import { createRoot } from 'react-dom/client';
import { initComposedWindowApi } from './core-app/ipc/composeWindowApi';
import App from './App';
import './index.css';
import '@/core-app/i18n';

// Compose window.downlodrFunctions, window.ytdlp, window.updateAPI, etc. from IPC bridges
initComposedWindowApi();

// Create root element
const container = document.createElement('div');
document.body.appendChild(container);

// Create root and render
const root = createRoot(container);
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
