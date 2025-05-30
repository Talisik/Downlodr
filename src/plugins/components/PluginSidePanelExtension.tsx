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

        callbackProxy['closePanel'] = () => {
          try {
            onClose();
          } catch (error) {
            console.error('Error in plugin close panel callback:', error);
          }
        };

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
              
              // Close panel handler - add this to any close buttons in the panel
              const closePanelBtns = document.querySelectorAll('.close-panel-btn');
              if (closePanelBtns.length > 0 && window.__pluginCallbacks && window.__pluginCallbacks.closePanel) {
                closePanelBtns.forEach(btn => {
                  btn.addEventListener('click', window.__pluginCallbacks.closePanel);
                });
              }
              
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
              
              // Make closePanel available globally within the iframe
              window.closePanel = function() {
                if (window.__pluginCallbacks && window.__pluginCallbacks.closePanel) {
                  window.__pluginCallbacks.closePanel();
                }
              };
            });
          `;

        iframe.contentDocument.head.appendChild(script);
      };
    }
  }, [options.content, options.callbacks, onClose]);

  // Helper function to check if a string is an SVG
  const isSvgString = (str: string): boolean => {
    return str.trim().startsWith('<svg') && str.trim().endsWith('</svg>');
  };

  // Add this debug line right before the return statement
  console.log('Debug icon:', {
    icon: options.icon,
    type: typeof options.icon,
    isSvg: typeof options.icon === 'string' ? isSvgString(options.icon) : false,
  });

  if (!isOpen) return null;

  // Calculate panel width
  const panelWidth = options.width
    ? typeof options.width === 'number'
      ? `${options.width}px`
      : options.width
    : '250px';

  return (
    <div
      className="fixed right-0 top-0 h-full bg-white shadow-lg z-40 flex flex-col border-2 border-[#D1D5DB] dark:border-darkModeCompliment"
      style={{ width: '300px' }}
    >
      {/* Header */}
      <div className="bg-titleBar dark:bg-darkMode px-2 py-1 pt-[11px] border-b-2 border-gray-200 dark:border-darkModeCompliment flex items-center justify-between">
        <div className="flex items-center flex-1">
          {options.icon && (
            <span className="inline-flex items-center justify-center w-5 h-5 mr-3 flex-shrink-0">
              {typeof options.icon === 'string' && isSvgString(options.icon) ? (
                <span
                  dangerouslySetInnerHTML={{ __html: options.icon }}
                  className="text-black dark:text-white [&>svg]:w-5 [&>svg]:h-5 [&>svg]:fill-current"
                />
              ) : (
                <span className="text-black dark:text-white">
                  {options.icon}
                </span>
              )}
            </span>
          )}
          <span className="text-black dark:text-white font-semibold text-sm leading-6">
            {options.title}
          </span>
        </div>

        <button
          onClick={onClose}
          className="text-black dark:text-white hover:text-red-500 ml-2 p-1 flex-shrink-0"
        >
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            <path d="m18 6-12 12M6 6l12 12" />
          </svg>
        </button>
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
