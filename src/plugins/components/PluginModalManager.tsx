import React, { useCallback, useState } from 'react';
import { PluginModalOptions, PluginModalResult } from '../types';
import PluginModalExtension from './PluginModalExtension';

interface PluginModalRequest {
  options: PluginModalOptions;
  resolve: (result: PluginModalResult | null) => void;
}

// Create a component that manages plugin modal requests
const PluginModalManager: React.FC = () => {
  const [currentRequest, setCurrentRequest] =
    useState<PluginModalRequest | null>(null);

  // Create a function to show the plugin modal
  const showPluginModal = useCallback(
    (options: PluginModalOptions): Promise<PluginModalResult | null> => {
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

  // Handle OK
  const handleOk = useCallback(() => {
    if (currentRequest) {
      currentRequest.resolve({ closed: false, confirmed: true });
      setCurrentRequest(null);

      // Call the onOk callback if provided
      if (currentRequest.options.callbacks?.onOk) {
        currentRequest.options.callbacks.onOk();
      }
    }
  }, [currentRequest]);

  // Handle cancel
  const handleCancel = useCallback(() => {
    if (currentRequest) {
      currentRequest.resolve({ closed: false, confirmed: false });
      setCurrentRequest(null);

      // Call the onCancel callback if provided
      if (currentRequest.options.callbacks?.onCancel) {
        currentRequest.options.callbacks.onCancel();
      }
    }
  }, [currentRequest]);

  // Handle custom action
  const handleAction = useCallback(
    (result: PluginModalResult) => {
      if (currentRequest) {
        currentRequest.resolve(result);
        setCurrentRequest(null);
      }
    },
    [currentRequest],
  );

  // Expose the showPluginModal method to the window
  React.useEffect(() => {
    if (typeof window !== 'undefined') {
      window.pluginModalManager = {
        showPluginModal,
      };
    }

    return () => {
      if (typeof window !== 'undefined' && window.pluginModalManager) {
        delete window.pluginModalManager;
      }
    };
  }, [showPluginModal]);

  // Render the plugin modal if there's a request
  return currentRequest ? (
    <PluginModalExtension
      isOpen={!!currentRequest}
      onClose={handleClose}
      onOk={handleOk}
      onCancel={handleCancel}
      options={currentRequest.options}
      onAction={handleAction}
    />
  ) : null;
};

export default PluginModalManager;

// Add typings for the window object
declare global {
  interface Window {
    pluginModalManager?: {
      showPluginModal: (
        options: PluginModalOptions,
      ) => Promise<PluginModalResult | null>;
    };
  }
}
