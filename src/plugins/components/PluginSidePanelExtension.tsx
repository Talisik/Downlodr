import React, { useEffect } from 'react';
import { PluginSidePanelOptions, PluginSidePanelResult } from '../types';
import { toast } from '../../Components/SubComponents/shadcn//hooks/use-toast';

interface PluginSidePanelExtensionProps {
  isOpen: boolean;
  onClose: () => void;
  options: PluginSidePanelOptions;
  onAction: (result: PluginSidePanelResult) => void;
}

const PluginSidePanelExtension: React.FC<PluginSidePanelExtensionProps> = ({
  isOpen,
  onClose,
  options,
  onAction,
}) => {
  // Handle escape key to close panel if closable
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen && options.closable !== false) {
        onClose();
      }
    };

    window.addEventListener('keydown', handleEscape);
    return () => window.removeEventListener('keydown', handleEscape);
  }, [isOpen, onClose, options.closable]);

  if (!isOpen) return null;

  // Calculate panel width
  const panelWidth = options.width
    ? typeof options.width === 'number'
      ? `${options.width}px`
      : options.width
    : '320px';

  return (
    <div
      className="fixed right-0 top-0 h-full bg-white dark:bg-gray-800 shadow-lg z-40 flex flex-col"
      style={{ width: panelWidth }}
    >
      {/* Header */}
      <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
          {options.title || 'Plugin Panel'}
        </h3>
        {options.closable !== false && (
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
          >
            <svg
              width="24"
              height="24"
              viewBox="0 0 24 24"
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
      <div className="flex-1 overflow-auto p-4">
        {typeof options.content === 'string' ? (
          <div dangerouslySetInnerHTML={{ __html: options.content }} />
        ) : (
          options.content
        )}
      </div>
    </div>
  );
};

export default PluginSidePanelExtension;
