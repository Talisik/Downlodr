import React, { useState, useCallback } from 'react';
import PluginSidePanelExtension from './PluginSidePanelExtension';
import { PluginSidePanelOptions, PluginSidePanelResult } from '../types';

interface PluginSidePanelRequest {
  options: PluginSidePanelOptions;
  resolve: (result: PluginSidePanelResult | null) => void;
}

// Create a component that manages plugin side panel requests
const PluginSidePanelManager: React.FC = () => {
  const [currentRequest, setCurrentRequest] =
    useState<PluginSidePanelRequest | null>(null);

  // Create a function to show the plugin side panel
  const showPluginSidePanel = useCallback(
    (
      options: PluginSidePanelOptions,
    ): Promise<PluginSidePanelResult | null> => {
      return new Promise((resolve) => {
        setCurrentRequest({ options, resolve });
      });
    },
    [],
  );

  // Handle close
  const handleClose = useCallback(() => {
    if (currentRequest) {
      currentRequest.resolve({ closed: true });
      setCurrentRequest(null);
    }
  }, [currentRequest]);

  // Handle action
  const handleAction = useCallback(
    (result: PluginSidePanelResult) => {
      if (currentRequest) {
        currentRequest.resolve(result);
        setCurrentRequest(null);
      }
    },
    [currentRequest],
  );

  // Expose the showPluginSidePanel method to the window
  React.useEffect(() => {
    if (typeof window !== 'undefined') {
      window.pluginSidePanelManager = {
        showPluginSidePanel,
      };
    }

    return () => {
      if (typeof window !== 'undefined' && window.pluginSidePanelManager) {
        delete window.pluginSidePanelManager;
      }
    };
  }, [showPluginSidePanel]);

  // Render the plugin side panel if there's a request
  return currentRequest ? (
    <PluginSidePanelExtension
      isOpen={!!currentRequest}
      onClose={handleClose}
      options={currentRequest.options}
      onAction={handleAction}
    />
  ) : null;
};

export default PluginSidePanelManager;

// Add typings for the window object
declare global {
  interface Window {
    pluginSidePanelManager?: {
      showPluginSidePanel: (
        options: PluginSidePanelOptions,
      ) => Promise<PluginSidePanelResult | null>;
    };
  }
}
