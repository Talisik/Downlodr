// src/hooks/usePluginState.ts
import { useState, useEffect } from 'react';

export function usePluginState() {
  const [enabledPlugins, setEnabledPlugins] = useState<Record<string, boolean>>(
    {},
  );

  useEffect(() => {
    // Load initial plugin states
    const loadEnabledState = async () => {
      try {
        const enabledState = await window.plugins.getEnabledPlugins();
        setEnabledPlugins(enabledState || {});
      } catch (error) {
        console.error('Failed to load plugin enabled states:', error);
      }
    };

    loadEnabledState();

    // Set up listener for plugin state changes
    const unsubscribe = window.plugins.onPluginStateChanged(
      ({ pluginId, enabled }) => {
        setEnabledPlugins((prev) => ({
          ...prev,
          [pluginId]: enabled,
        }));
      },
    );

    return () => {
      if (unsubscribe) unsubscribe();
    };
  }, []);

  return enabledPlugins;
}
