/* eslint-disable @typescript-eslint/no-explicit-any */
declare global {
  interface Window {
    downlodrFunctions: {
      closeApp: () => void;
      minimizeApp: () => void;
      maximizeApp: () => void;
    };
  }
}

export {};
