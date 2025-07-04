/**
 * Entry point for the UI and App.tsx.
 * This file is responsible for rendering the main App component
 * into the DOM.
 */

import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import './index.css';
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
