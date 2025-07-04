import React, { useEffect, useState } from 'react';
import { createPluginAPI } from '../plugins/pluginAPI';

export const PluginLoader: React.FC = () => {
  const [, setEnabledPlugins] = useState<Record<string, boolean>>({});

  useEffect(() => {
    // Load enabled state and plugins
    const initializePlugins = async () => {
      try {
        // First load enabled state
        const enabledState = await window.plugins.getEnabledPlugins();
        setEnabledPlugins(enabledState || {});

        // Then load plugins
        await loadPlugins();

        // Notify that plugins are ready
        window.dispatchEvent(new CustomEvent('pluginsReady'));
      } catch (error) {
        console.error('Failed to initialize plugins:', error);
      }
    };

    // Initial load
    initializePlugins();

    // Set up reload listener
    const unsubscribe = window.plugins.onReloaded(async () => {
      // Reload plugins
      await loadPlugins();
      // Notify that plugins have been reloaded
      window.dispatchEvent(new CustomEvent('pluginsReady'));
    });

    // Set up state change listener
    const unsubscribeState = window.plugins.onPluginStateChanged(
      ({ pluginId, enabled }) => {
        setEnabledPlugins((prev) => ({
          ...prev,
          [pluginId]: enabled,
        }));
      },
    );

    // Cleanup
    return () => {
      if (unsubscribe) unsubscribe();
      if (unsubscribeState) unsubscribeState();
    };
  }, []);

  async function loadPlugins() {
    try {
      // Get list of plugins
      const plugins = await window.plugins.list();

      // Get current enabled states
      const enabledStates = await window.plugins.getEnabledPlugins();
      setEnabledPlugins(enabledStates);

      // Load each plugin in the renderer process
      for (const plugin of plugins) {
        try {
          console.log(`Loading plugin: ${plugin.id}`);
          // eslint-disable-next-line @typescript-eslint/no-unused-vars
          const { code, manifest, error } = await window.plugins.getCode(
            plugin.id,
          );

          if (error) {
            console.error(`Error loading plugin ${plugin.id}: ${error}`);
            continue;
          }

          // Create a sandbox and execute the plugin
          const pluginExports = await executePluginCode(code, plugin.id);

          if (!pluginExports) {
            console.error(`Plugin ${plugin.id} failed to load properly`);
            continue;
          }

          // Create isolated API instance for this plugin
          const api = createPluginAPI(plugin.id);

          // Initialize the plugin with its API
          if (pluginExports.initialize) {
            await pluginExports.initialize(api);
            console.log(`Plugin ${plugin.id} initialized successfully`);
          }
        } catch (error) {
          console.error(`Error initializing plugin ${plugin.id}:`, error);
        }
      }
    } catch (error) {
      console.error('Failed to load plugins:', error);
    }
  }

  // Execute plugin code in a controlled way
  async function executePluginCode(code: string, pluginId: string) {
    try {
      const sandbox = {
        // Provide limited globals
        console: {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          log: (...args: any[]) => console.log(`[Plugin ${pluginId}]`, ...args),
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          error: (...args: any[]) =>
            console.error(`[Plugin ${pluginId}]`, ...args),
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          warn: (...args: any[]) =>
            console.warn(`[Plugin ${pluginId}]`, ...args),
        },
        setTimeout: (callback: TimerHandler, ms?: number, ...args: any[]) => 
          setTimeout(callback, ms, ...args),
        clearTimeout: (id?: number) => clearTimeout(id),
        exports: {},
        module: { exports: {} },
        require: createSafeRequire(),
      };

      // Execute the plugin code within this sandbox
      const fn = new Function(
        'sandbox',
        `
        with (sandbox) {
          ${code}
        }
        return sandbox.module.exports;
      `,
      );

      return fn(sandbox);
    } catch (error) {
      console.error(`Error executing plugin ${pluginId}:`, error);
      return null;
    }
  }

  // Create a limited require function for plugins
  function createSafeRequire() {
    return async function safeRequire(module: string) {
      // Only allow specific modules to be required
      if (module === 'path') {
        // Provide a safe subset of path
        return {
          join: (...parts: string[]) => parts.join('/'),
          basename: (path: string) => path.split('/').pop(),
        };
      }

      if (module === 'docx') {
        // Allow docx for document generation
        const docx = await import('docx');
        return {
          Document: docx.Document,
          Paragraph: docx.Paragraph,
          TextRun: docx.TextRun,
          Packer: docx.Packer,
        };
      }

      if (module === 'talisik-shortener') {
        // Allow talisik-shortener for URL shortening
        const talisikShortener = await import('talisik-shortener');
        return {
          TalisikClient: talisikShortener.TalisikClient,
        };
      }

      throw new Error(
        `Module '${module}' is not allowed to be required by plugins`,
      );
    };
  }

  return null; // This component doesn't render anything
};
