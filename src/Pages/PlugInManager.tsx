// src/Components/Pages/PluginManager.tsx
import React, { useState, useEffect } from 'react';
import { Button } from '../Components/SubComponents/shadcn/components/ui/button';

interface PluginInfo {
  id: string;
  name: string;
  version: string;
  description: string;
  author: string;
}

const PluginManager: React.FC = () => {
  const [plugins, setPlugins] = useState<PluginInfo[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadPlugins();
  }, []);

  const loadPlugins = async () => {
    try {
      setLoading(true);
      const installedPlugins = await window.plugins.list();
      setPlugins(installedPlugins);
    } catch (error) {
      console.error('Failed to load plugins:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleInstall = async () => {
    try {
      // Use your existing file dialog
      const pluginPath = await window.ytdlp.selectDownloadDirectory();
      if (pluginPath) {
        const success = await window.plugins.install(pluginPath);
        if (success) {
          await loadPlugins();
        } else {
          // Show error notification
        }
      }
    } catch (error) {
      console.error('Failed to install plugin:', error);
    }
  };

  const handleUninstall = async (pluginId: string) => {
    try {
      const success = await window.plugins.uninstall(pluginId);
      if (success) {
        await loadPlugins();
      } else {
        // Show error notification
      }
    } catch (error) {
      console.error('Failed to uninstall plugin:', error);
    }
  };

  const handleLoadUnzipped = async () => {
    try {
      // Use your existing directory selection dialog
      const pluginDirPath = await window.ytdlp.selectDownloadDirectory();
      if (pluginDirPath) {
        const success = await window.plugins.loadUnzipped(pluginDirPath);
        if (success) {
          await loadPlugins();
        } else {
          // Show error notification
        }
      }
    } catch (error) {
      console.error('Failed to load unzipped plugin:', error);
    }
  };

  return (
    <div className="p-4">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">Plugin Manager</h1>
        <Button onClick={handleInstall}>Add Plugin</Button>
        <Button onClick={handleLoadUnzipped}>Load Unzipped Plugin</Button>
      </div>

      {loading ? (
        <div>Loading plugins...</div>
      ) : plugins.length === 0 ? (
        <div className="text-center text-gray-500 p-8">lol walang lumabas</div>
      ) : (
        <div className="grid gap-4">
          {plugins.map((plugin) => (
            <div key={plugin.id} className="border p-4 rounded-lg">
              <div className="flex justify-between">
                <div>
                  <h3 className="text-lg font-medium">{plugin.name}</h3>
                  <div className="text-sm text-gray-500">
                    v{plugin.version} • by {plugin.author}
                  </div>
                  <p className="mt-2">{plugin.description}</p>
                </div>
                <Button
                  variant="destructive"
                  onClick={() => handleUninstall(plugin.id)}
                >
                  Uninstall
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default PluginManager;
