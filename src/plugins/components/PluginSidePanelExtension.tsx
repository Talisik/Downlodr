import React, { useEffect, useRef, useState } from 'react';
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
  const iframeRef = useRef<HTMLIFrameElement>(null);

  // Generate theme-aware content
  const getThemedContent = (originalContent: string) => {
    const isDark = document.documentElement.classList.contains('dark');

    const themeStyles = `
      <style id="injected-theme">
        :root {
          --bg-primary: ${isDark ? '#09090B' : '#ffffff'};
          --bg-secondary: ${isDark ? '#18181B' : '#f4f4f5'};
          --text-primary: ${isDark ? '#ffffff' : '#01010b'};
          --text-secondary: ${isDark ? '#71717A' : '#666'};
          --text-tertiary: ${isDark ? '#52525B' : '#BCBCBC'};
          --border-primary: ${isDark ? '#272727' : '#D1D5DB'};
          --border-accent: #F45513;
          --border-disabled: ${isDark ? '#3f3f46' : '#E0E0E0'};
          --accent-primary: #F45513;
          --accent-hover: #e56c10;
          --bg-accent: #FEF9F4;
          --bg-accent-hover: ${
            isDark ? 'rgba(254, 249, 244, 0.8)' : 'rgba(252, 242, 236, 1)'
          };
          --text-on-accent: #fff;
          --bg-hover: ${isDark ? '#3E3E46' : 'rgb(227, 227, 227)'};
          --bg-disabled: ${isDark ? '#27272a' : '#cccccc'};
          --text-disabled: ${isDark ? '#52525b' : '#666'};
          --success-primary: #22C55E;
          --error-primary: #FF3B30;
          --text-on-success: #fff;
          --text-on-error: #fff;
          --bg-success-hover: rgba(255, 255, 255, 0.1);
          --bg-progress-track: ${isDark ? '#272727' : '#D1D5DB'};
          --bg-tooltip: ${isDark ? '#18181B' : '#333'};
          --text-tooltip: ${isDark ? '#a1a1aa' : '#fff'};
          --shadow-primary: ${
            isDark ? 'rgba(0, 0, 0, 0.5)' : 'rgba(0, 0, 0, 0.1)'
          };
          --shadow-success: ${
            isDark ? 'rgba(34, 197, 94, 0.3)' : 'rgba(16, 185, 129, 0.3)'
          };
          --scrollbar-thumb: ${isDark ? '#52525b' : '#888'};
          --scrollbar-thumb-hover: ${isDark ? '#71717a' : '#666'};
        }
        body {
          background-color: ${isDark ? '#09090B' : '#fff'} !important;
          color: ${isDark ? '#a1a1aa' : '#01010b'} !important;
        }
        ${isDark ? 'html { color-scheme: dark; }' : ''}
      </style>
    `;

    // Inject the theme styles right after the opening <style> tag
    if (originalContent.includes('<style>')) {
      return originalContent.replace(
        '<style>',
        `<style>${themeStyles.replace(/<\/?style[^>]*>/g, '')}`,
      );
    } else if (originalContent.includes('</head>')) {
      return originalContent.replace('</head>', `${themeStyles}</head>`);
    } else {
      // Fallback: prepend to the content
      return `${themeStyles}${originalContent}`;
    }
  };

  // State to hold the current themed content
  const [themedContent, setThemedContent] = useState(() =>
    typeof options.content === 'string'
      ? getThemedContent(options.content)
      : options.content,
  );

  // Update content when theme changes
  useEffect(() => {
    if (typeof options.content === 'string') {
      const newContent = getThemedContent(options.content);
      setThemedContent(newContent);
    }
  }, [options.content]);

  // Listen for theme changes
  useEffect(() => {
    const themeObserver = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        if (
          mutation.type === 'attributes' &&
          mutation.attributeName === 'class'
        ) {
          if (typeof options.content === 'string') {
            const newContent = getThemedContent(options.content);
            setThemedContent(newContent);
          }
        }
      });
    });

    themeObserver.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['class'],
    });

    return () => {
      themeObserver.disconnect();
    };
  }, [options.content]);

  // Handle callbacks
  useEffect(() => {
    if (options.callbacks && iframeRef.current) {
      const iframe = iframeRef.current;

      iframe.onload = () => {
        const callbackProxy: Record<string, (...args: any[]) => any> = {};

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

        if (iframe.contentWindow) {
          (iframe.contentWindow as any).__pluginCallbacks = callbackProxy;
        }
      };
    }
  }, [options.callbacks, onClose]);

  // Helper function to check if a string is an SVG
  const isSvgString = (str: string): boolean => {
    return str.trim().startsWith('<svg') && str.trim().endsWith('</svg>');
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed right-0 top-0 h-full bg-white dark:bg-darkMode shadow-lg z-40 flex flex-col border-2 border-[#D1D5DB] dark:border-darkModeCompliment"
      style={{ width: '300px' }}
    >
      {/* Header */}
      <div className="bg-titleBar dark:bg-darkModeDropdown px-2 py-1 pt-[11px] border-b-2 border-gray-200 dark:border-darkModeCompliment flex items-center justify-between">
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
        {typeof themedContent === 'string' ? (
          <iframe
            ref={iframeRef}
            className="w-full h-full border-0"
            srcDoc={themedContent}
            sandbox="allow-scripts"
          />
        ) : (
          themedContent
        )}
      </div>
    </div>
  );
};

export default PluginSidePanelExtension;
