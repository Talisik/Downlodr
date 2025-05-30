import React, { useEffect, useState } from 'react';
import { usePluginStore } from '../../Store/pluginStore';
import { PluginSidePanelOptions, PluginSidePanelResult } from '../types';
import PluginSidePanelExtension from './PluginSidePanelExtension';

interface PluginSidePanelRequest {
  id: string;
  options: PluginSidePanelOptions;
  resolve: (result: PluginSidePanelResult) => void;
}

const PluginSidePanelManager: React.FC = () => {
  const [requestQueue, setRequestQueue] = useState<PluginSidePanelRequest[]>(
    [],
  );
  const [currentRequest, setCurrentRequest] =
    useState<PluginSidePanelRequest | null>(null);
  const { settingsPlugin, updateIsOpenPluginSidebar } = usePluginStore();
  const isOpen = settingsPlugin.isOpenPluginSidebar;

  // Listen for store changes and update panel visibility accordingly
  useEffect(() => {
    if (!isOpen && currentRequest) {
      // If the store indicates the panel should be closed, close it
      handleClose();
    }
  }, [isOpen]);

  // Setup the global manager when the component mounts
  useEffect(() => {
    if (typeof window !== 'undefined') {
      window.pluginSidePanelManager = {
        showPluginSidePanel: (options: PluginSidePanelOptions) => {
          // Add debug logging here
          console.log('PluginSidePanelManager received options:', {
            title: options.title,
            icon: options.icon,
            iconType: typeof options.icon,
            hasIcon: !!options.icon,
          });

          return new Promise<PluginSidePanelResult>((resolve) => {
            const request: PluginSidePanelRequest = {
              id: `panel_${Date.now()}`,
              options,
              resolve,
            };
            setRequestQueue((queue) => [...queue, request]);
          });
        },
      };
    }

    return () => {
      if (typeof window !== 'undefined') {
        delete window.pluginSidePanelManager;
      }
    };
  }, []);

  // Process the queue whenever it changes or when currentRequest becomes null
  useEffect(() => {
    if (!currentRequest && requestQueue.length > 0) {
      const nextRequest = requestQueue[0];
      console.log('Setting current request:', {
        title: nextRequest.options.title,
        icon: nextRequest.options.icon,
        iconType: typeof nextRequest.options.icon,
        hasIcon: !!nextRequest.options.icon,
      });
      setCurrentRequest(nextRequest);
      setRequestQueue(requestQueue.slice(1));
      updateIsOpenPluginSidebar(true);
    }
  }, [requestQueue, currentRequest, updateIsOpenPluginSidebar]);

  // Handle closing the panel
  const handleClose = () => {
    if (currentRequest) {
      currentRequest.resolve({
        closed: true,
      });
      setCurrentRequest(null);
      updateIsOpenPluginSidebar(false);
    }
  };

  // Handle message events for panel closing
  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      if (event.data && event.data.type === 'closePanel') {
        handleClose();
      }
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, []);

  // Handle close panel events from IPC
  useEffect(() => {
    const handleClosePanel = () => {
      handleClose();
    };

    // Add event listener for plugin:close-panel
    if (typeof window !== 'undefined') {
      window.addEventListener('plugin:close-panel', handleClosePanel);
    }

    return () => {
      if (typeof window !== 'undefined') {
        window.removeEventListener('plugin:close-panel', handleClosePanel);
      }
    };
  }, []);

  return (
    <>
      {currentRequest && (
        <PluginSidePanelExtension
          isOpen={isOpen}
          onClose={handleClose}
          options={currentRequest.options}
          onAction={(result) => {
            currentRequest.resolve(result);
            setCurrentRequest(null);
            updateIsOpenPluginSidebar(false);
          }}
        />
      )}
    </>
  );
};

export default PluginSidePanelManager;

// Add typings for the window object
declare global {
  interface Window {
    pluginSidePanelManager?: {
      showPluginSidePanel: (
        options: PluginSidePanelOptions,
      ) => Promise<PluginSidePanelResult>;
    };
  }
}
