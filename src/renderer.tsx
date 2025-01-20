import React from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import App from './App';
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
