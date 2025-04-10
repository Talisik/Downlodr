import React, { useEffect } from 'react';
import { createPluginAPI } from '../plugins/pluginAPI';

export const PluginLoader: React.FC = () => {
  useEffect(() => {
    loadPlugins();
  }, []);

  async function loadPlugins() {
    try {
      // Get list of plugins
      const plugins = await window.plugins.list();

      // Load each plugin in the renderer process
      for (const plugin of plugins) {
        try {
          console.log(`Loading plugin: ${plugin.id}`);
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
      // Create a controlled context for plugin execution
      const sandbox = {
        // Provide limited globals
        console: {
          log: (...args: any[]) => console.log(`[Plugin ${pluginId}]`, ...args),
          error: (...args: any[]) =>
            console.error(`[Plugin ${pluginId}]`, ...args),
          warn: (...args: any[]) =>
            console.warn(`[Plugin ${pluginId}]`, ...args),
        },
        setTimeout,
        clearTimeout,
        exports: {},
        module: { exports: {} },
        require: createSafeRequire(pluginId),
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
  function createSafeRequire(pluginId: string) {
    return function safeRequire(module: string) {
      // Only allow specific modules to be required
      if (module === 'path') {
        // Provide a safe subset of path
        return {
          join: (...parts: string[]) => parts.join('/'),
          basename: (path: string) => path.split('/').pop(),
        };
      }

      throw new Error(
        `Module '${module}' is not allowed to be required by plugins`,
      );
    };
  }

  return null; // This component doesn't render anything
};
