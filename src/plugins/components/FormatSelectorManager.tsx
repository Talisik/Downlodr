import React, { useState, useCallback } from 'react';
import FormatSelectorExtension from '../../Components/SubComponents/custom/FormatSelectorExtension';
import { FormatSelectorOptions, FormatSelectorResult } from '../types';

interface FormatSelectorRequest {
  options: FormatSelectorOptions;
  resolve: (result: FormatSelectorResult | null) => void;
}

// Create a component that manages format selector requests
const FormatSelectorManager: React.FC = () => {
  const [currentRequest, setCurrentRequest] =
    useState<FormatSelectorRequest | null>(null);

  // Create a function to show the format selector
  const showFormatSelector = useCallback(
    (options: FormatSelectorOptions): Promise<FormatSelectorResult | null> => {
      return new Promise((resolve) => {
        setCurrentRequest({ options, resolve });
      });
    },
    [],
  );

  // Handle close without selection
  const handleClose = useCallback(() => {
    if (currentRequest) {
      currentRequest.resolve(null);
      setCurrentRequest(null);
    }
  }, [currentRequest]);

  // Handle format selection
  const handleSelect = useCallback(
    (result: FormatSelectorResult) => {
      if (currentRequest) {
        currentRequest.resolve(result);
        setCurrentRequest(null);
      }
    },
    [currentRequest],
  );

  // Expose the showFormatSelector method to the window
  React.useEffect(() => {
    if (typeof window !== 'undefined') {
      window.formatSelectorManager = {
        showFormatSelector,
      };
    }

    return () => {
      if (typeof window !== 'undefined' && window.formatSelectorManager) {
        delete window.formatSelectorManager;
      }
    };
  }, [showFormatSelector]);

  // Render the format selector if there's a request
  return currentRequest ? (
    <FormatSelectorExtension
      isOpen={!!currentRequest}
      onClose={handleClose}
      options={currentRequest.options}
      onSelect={handleSelect}
    />
  ) : null;
};

export default FormatSelectorManager;

// Add typings for the window object
declare global {
  interface Window {
    formatSelectorManager?: {
      showFormatSelector: (
        options: FormatSelectorOptions,
      ) => Promise<FormatSelectorResult | null>;
    };
  }
}
