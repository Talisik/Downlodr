import React, { useEffect, useRef } from 'react';
import { PluginSidePanelOptions, PluginSidePanelResult } from '../types';
// import { toast } from '../../Components/SubComponents/shadcn//hooks/use-toast';

interface PluginSidePanelExtensionProps {
  isOpen: boolean;
  onClose: () => void;
  options: PluginSidePanelOptions;
  onAction: (result: PluginSidePanelResult) => void;
}

// src/Components/SubComponents/custom/PluginSidePanelExtension.tsx
const PluginSidePanelExtension: React.FC<PluginSidePanelExtensionProps> = ({
  isOpen,
  onClose,
  options,
  // onAction,
}) => {
  // Create a ref to hold the iframe element
  const iframeRef = useRef<HTMLIFrameElement>(null);

  // Handle callbacks by injecting a script that connects them to UI elements
  useEffect(() => {
    if (
      typeof options.content === 'string' &&
      options.callbacks &&
      iframeRef.current
    ) {
      const iframe = iframeRef.current;

      // Wait for iframe to load
      iframe.onload = () => {
        if (!iframe.contentWindow) return;

        // Create a secure proxy for callbacks
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const callbackProxy: Record<string, (...args: any[]) => any> = {};

        // Add each callback to the proxy
        if (options.callbacks) {
          Object.entries(options.callbacks).forEach(([name, callback]) => {
            if (typeof callback === 'function') {
              callbackProxy[name] = (...args) => {
                try {
                  return callback(...args);
                } catch (error) {
                  console.error(`Error in plugin callback ${name}:`, error);
                }
              };
            }
          });
        }

        // Inject the callback proxy into the iframe
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (iframe.contentWindow as any).__pluginCallbacks = callbackProxy;

        // Inject connector script
        const script = iframe.contentDocument.createElement('script');
        script.textContent = `
            // Connect button events to callbacks
            document.addEventListener('DOMContentLoaded', () => {
              // Format selection
              let selectedFormat = 'md';
              
              document.querySelectorAll('.format-option').forEach(option => {
                option.addEventListener('click', function() {
                  document.querySelectorAll('.format-option').forEach(el => {
                    el.classList.remove('bg-orange-100', 'dark:bg-orange-900', 'border-orange-500');
                    el.classList.add('hover:bg-gray-50', 'dark:hover:bg-gray-800');
                  });
                  
                  this.classList.add('bg-orange-100', 'dark:bg-orange-900', 'border-orange-500');
                  this.classList.remove('hover:bg-gray-50', 'dark:hover:bg-gray-800');
                  
                  selectedFormat = this.getAttribute('data-format');
                  
                  if (window.__pluginCallbacks && window.__pluginCallbacks.onFormatChange) {
                    window.__pluginCallbacks.onFormatChange(selectedFormat);
                  }
                });
              });
              
              // Browse button handler
              const browseBtn = document.querySelector('.browse-btn');
              if (browseBtn && window.__pluginCallbacks && window.__pluginCallbacks.onBrowse) {
                browseBtn.addEventListener('click', window.__pluginCallbacks.onBrowse);
              }
              
              // Cancel button handler
              const cancelBtn = document.querySelector('.cancel-btn');
              if (cancelBtn && window.__pluginCallbacks && window.__pluginCallbacks.onCancel) {
                cancelBtn.addEventListener('click', window.__pluginCallbacks.onCancel);
              }
              
              // Convert button handler
              const convertBtn = document.querySelector('.convert-btn');
              if (convertBtn && window.__pluginCallbacks && window.__pluginCallbacks.onConvert) {
                convertBtn.addEventListener('click', () => {
                  window.__pluginCallbacks.onConvert(selectedFormat);
                });
              }
            });
          `;

        iframe.contentDocument.head.appendChild(script);
      };
    }
  }, [options.content, options.callbacks]);

  if (!isOpen) return null;

  // Calculate panel width
  const panelWidth = options.width
    ? typeof options.width === 'number'
      ? `${options.width}px`
      : options.width
    : '250px';

  return (
    <div
      className="fixed right-0 top-0 h-full bg-white dark:bg-darkMode shadow-lg z-40 flex flex-col border-2 border-[#D1D5DB] dark:border-darkModeCompliment"
      style={{ width: '300px' }}
    >
      {/* Header */}
      <div className="bg-titleBar dark:bg-darkMode px-2 py-1 pt-[11px] border-b-2 border-gray-200 dark:border-darkModeCompliment flex items-center justify-between">
        <h3 className="text-md font-semibold text-gray-900 dark:text-gray-100 flex items-center justify-center h-full my-auto">
          {options.title || 'Plugin Panel'}
        </h3>
        {options.closable !== false && (
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
          >
            <svg
              width="22"
              height="22"
              viewBox="0 0 28 28"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <line x1="18" y1="6" x2="6" y2="18"></line>
              <line x1="6" y1="6" x2="18" y2="18"></line>
            </svg>
          </button>
        )}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto">
        {typeof options.content === 'string' ? (
          <iframe
            ref={iframeRef}
            className="w-full h-full border-0"
            srcDoc={options.content}
            sandbox="allow-scripts"
          />
        ) : (
          options.content
        )}
      </div>
    </div>
  );
};

export default PluginSidePanelExtension;
