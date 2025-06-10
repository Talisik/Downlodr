# Downlodr Plugin Development Guide

This document provides a comprehensive guide for creating plugins for Downlodr, allowing you to extend the application's functionality.

## Table of Contents
- [Overview](#overview)
- [Plugin Structure](#plugin-structure)
- [Creating Your First Plugin](#creating-your-first-plugin)
- [Plugin API Reference](#plugin-api-reference)
- [Examples](#examples)
- [Best Practices](#best-practices)
- [Troubleshooting](#troubleshooting)

## Overview

Downlodr's plugin system allows developers to extend the application's functionality through a JavaScript API. Plugins can:

- Add custom menu items to the application
- Create custom download sources
- Add format handlers
- Create custom format selectors
- Add settings pages
- Show notifications
- Interact with downloads

## Plugin Structure

A plugin consists of two main files:

1. **manifest.json** - Contains plugin metadata
2. **index.js** (or other main JS file) - Contains the plugin's code

### manifest.json
json
   ```
   <pre>
{
"id": "com.example.myplugin",
"name": "My Plugin",
"version": "1.0.0",
"description": "A description of what your plugin does",
"main": "index.js",
"author": "Your Name",
"license": "MIT",
"minAppVersion": "1.0.0",
"icon": "🔌"
}
</pre>
   ```

Required fields:
   ```
   <pre>
- `id`: Unique identifier for your plugin (use reverse domain notation)
- `name`: Human-readable name 
- `version`: Plugin version using semantic versioning
- `description`: Short description of plugin functionality
- `main`: Entry point JavaScript file (relative to plugin directory)
- `author`: Plugin author name or organization
</pre>
   ```

Optional fields:
   ```
   
- `license`: License under which the plugin is distributed
- `minAppVersion`: Minimum app version required
- `icon`: Emoji or path to icon image
</pre>   
```

### index.js

The main JavaScript file must export an object with at least these properties:

javascript
   ```
   <pre>   
const myPlugin = {
id: "com.example.myplugin",
name: "My Plugin",
version: "1.0.0",
description: "A description of what your plugin does",
author: "Your Name",
// Required: Initialize function called when plugin is loaded
async initialize(api) {
this.api = api;
// Plugin initialization code
console.log("My plugin initialized!");
},
// Optional: Called when plugin is disabled or unloaded
async onUnload() {
// Cleanup code
console.log("My plugin unloaded!");
}
};
module.exports = myPlugin;
</pre>   
   ```

## Creating Your First Plugin

Follow these steps to create a basic plugin:

1. Create a new directory for your plugin with the structure:
   ```
   my-plugin/
   ├── manifest.json
   └── index.js
   ```

2. Define your plugin metadata in manifest.json:
   ```json
   {
     "id": "com.example.helloworldplugin",
     "name": "Hello World Plugin",
     "version": "1.0.0",
     "description": "A simple hello world plugin for Downlodr",
     "main": "index.js",
     "author": "Your Name",
     "license": "MIT",
     "minAppVersion": "1.0.0",
     "icon": "👋"
   }
   ```

3. Create a basic plugin implementation in index.js:
   ```javascript
   const helloWorldPlugin = {
     id: "com.example.helloworldplugin",
     name: "Hello World Plugin",
     version: "1.0.0",
     description: "A simple hello world plugin for Downlodr",
     author: "Your Name",
     
     menuItemIds: [],
     
     async initialize(api) {
       this.api = api;
       
       // Register a menu item
       const menuItemId = await api.ui.registerMenuItem({
         label: "Hello World",
         icon: "👋",
         context: "main",
         onClick: () => this.sayHello()
       });
       
       this.menuItemIds.push(menuItemId);
       console.log("Hello World Plugin initialized!");
     },
     
     sayHello() {
       this.api.ui.showNotification({
         title: "Hello World",
         message: "This is my first Downlodr plugin!",
         type: "success",
         duration: 3000
       });
     },
     
     async onUnload() {
       // Clean up registered menu items
       for (const id of this.menuItemIds) {
         await this.api.ui.unregisterMenuItem(id);
       }
       console.log("Hello World Plugin unloaded!");
     }
   };
   
   module.exports = helloWorldPlugin;
   ```

4. Install the plugin by placing it in the plugins directory of Downlodr, which is located at:
   - Windows: `%APPDATA%\downlodr\plugins\`
   - macOS: `~/Library/Application Support/downlodr/plugins/`
   - Linux: `~/.config/downlodr/plugins/`

## Plugin API Reference

The plugin API is provided to your plugin through the `initialize(api)` method.

### API Structure

javascript
   ```
   <pre>   
api: {
downloads: DownloadAPI,
ui: UIAPI,
formats: FormatAPI,
utilities: UtilityAPI
}
</pre>   
   ```

### DownloadAPI

Methods for interacting with downloads:

javascript
   ```
   <pre>   
downloads: {
// Register a new download source
registerDownloadSource: (source: DownloadSource) => void,
// Get list of active downloads
getActiveDownloads: () => Download[],
// Add a new download
addDownload: (url: string, options: DownloadOptions) => Promise<string>,
// Cancel a download
cancelDownload: (id: string) => Promise<boolean>,
// Pause a download
pauseDownload: (id: string) => Promise<boolean>,
// Get information about a URL
getInfo: (url: string) => Promise<DownloadInfo>
}
</pre>   
   ```

### UIAPI

Methods for modifying the UI:

javascript
   ```
   <pre>   
ui: {
// Register a menu item
registerMenuItem: (menuItem: MenuItem) => Promise<string>,
// Unregister a menu item
unregisterMenuItem: (id: string) => Promise<boolean>,
// Register a format provider
registerFormatProvider: (provider: FormatProvider) => string,
// Register a settings page
registerSettingsPage: (page: SettingsPage) => string,
// Show a notification
showNotification: (options: NotificationOptions) => void,
// Show a format selector dialog
showFormatSelector: (options: FormatSelectorOptions) => Promise<FormatSelectorResult | null>
}
</pre>   
   ```

### FormatAPI

Methods for handling formats:

javascript
   ```
   <pre>   
formats: {
// Register a format handler
registerFormatHandler: (handler: FormatHandler) => string,
// Get supported formats
getSupportedFormats: () => string[]
}
</pre>   
   ```

### UtilityAPI

Utility functions:

javascript
   ```
   <pre>   
utilities: {
// Format file size (bytes to human-readable string)
formatFileSize: (size: number) => string,
// Open a URL in the default browser
openExternalLink: (url: string) => Promise<void>,
// Show dialog to select a directory
selectDirectory: () => Promise<string>
}
</pre>   
   ```

## Type Definitions

### MenuItem

typescript
   ```
   <pre>   
interface MenuItem {
id?: string;
label: string;
icon?: string;
onClick: (contextData?: any) => void;
disabled?: boolean;
tooltip?: string;
submenu?: MenuItem[];
order?: number;
context?: 'download' | 'main' | 'all';
}
</pre>   
   ```

### NotificationOptions

typescript
   ```
   <pre>   
interface NotificationOptions {
title: string;
message: string;
type?: 'info' | 'warning' | 'error' | 'success';
duration?: number;
}
</pre>   
   ```

### FormatSelectorOptions

typescript
   ```
   <pre>   
interface FormatSelectorOptions {
title?: string;
formats: FormatOption[];
keepOriginal?: boolean;
}
interface FormatOption {
id: string;
label: string;
value: string;
default?: boolean;
}
</pre>   
 ```

### DownloadOptions

typescript
   ```
   <pre>   
interface DownloadOptions {
name: string;
downloadName?: string;
size?: number;
format?: string;
location?: string;
ext?: string;
speed?: string;
timeLeft?: string;
formatId?: string;
audioFormatId?: string;
audioExt?: string;
extractorKey?: string;
limitRate?: string;
automaticCaption?: any;
thumbnails?: any;
getTranscript?: boolean;
getThumbnail?: boolean;
}
</pre>   
   ```

## Examples

### Example 1: Format Converter Plugin

The format converter plugin allows users to convert downloaded videos to different formats.

javascript
   ```
   <pre>   
const formatConverter = {
id: 'formatConverter',
name: 'Format Converter',
version: '1.0.0',
description: 'Convert downloads to different formats',
author: 'Downlodr',
menuItemIds: [],
async initialize(api) {
this.api = api;
// Register a menu item for format conversion
const menuItemId = await api.ui.registerMenuItem({
label: 'Convert Format',
icon: '🔄',
context: 'download',
onClick: (contextData) => this.showFormatSelector(contextData)
});
this.menuItemIds.push(menuItemId);
console.log('Format Converter initialized');
},
async showFormatSelector(contextData) {
try {
const formatResult = await this.api.ui.showFormatSelector({
title: "Choose Format to Convert",
formats: [
{ id: "mp3", label: "MP3 (Audio)", value: "mp3", default: true },
{ id: "mp4", label: "MP4 (Video)", value: "mp4", default: false },
{ id: "webm", label: "WebM (Video)", value: "webm", default: false },
{ id: "mkv", label: "MKV (Video)", value: "mkv", default: false },
{ id: "m4a", label: "M4A (Audio)", value: "m4a", default: false }
],
keepOriginal: false
});
if (!formatResult) return; // User cancelled
const { selectedFormat } = formatResult;
this.convertFormat(contextData, selectedFormat);
} catch (error) {
this.api.ui.showNotification({
title: 'Error',
message: 'Failed to show format selector',
type: 'error',
duration: 3000
});
}
},
async convertFormat(contextData, format) {
// Implementation details for conversion
// ...
},
async onUnload() {
// Clean up registered menu items
for (const id of this.menuItemIds) {
await this.api.ui.unregisterMenuItem(id);
}
}
};
module.exports = formatConverter;
</pre>   
   ```

### Example 2: Custom Download Source

javascript
   ```
   <pre>   
const customSource = {
id: 'custom-source-plugin',
name: 'Custom Source Plugin',
version: '1.0.0',
description: 'Add support for a custom video source',
author: 'Your Name',
async initialize(api) {
this.api = api;
// Register a custom download source
api.downloads.registerDownloadSource({
id: 'custom-source',
name: 'Custom Source',
// Determine if this source can handle a URL
canHandle: (url) => {
return url.includes('custom-video-site.com');
},
// Get information about a URL
getInfo: async (url) => {
// Custom implementation to fetch video info
// ...
return {
title: 'Video Title',
formats: [
{ id: 'mp4', name: 'MP4', extension: 'mp4', quality: 'high' },
{ id: 'webm', name: 'WebM', extension: 'webm', quality: 'medium' }
],
thumbnail: 'https://example.com/thumbnail.jpg',
duration: 120,
uploader: 'Video Uploader'
};
}
});
console.log('Custom Source Plugin initialized');
}
};
module.exports = customSource;
</pre>   
   ```

## Best Practices

1. **Error Handling**: Always wrap async operations in try/catch blocks.

2. **Clean up resources**: Implement the `onUnload` method to clean up resources when your plugin is disabled.

3. **Resource management**: Store IDs of registered items (menus, etc.) to properly clean them up.

4. **Versioning**: Use semantic versioning for your plugin.

5. **Documentation**: Include clear documentation about what your plugin does and how to use it.

6. **Security**: Don't include sensitive information in your plugin code.

7. **Performance**: Be mindful of performance impacts, especially for operations that run frequently.

8. **Compatibility**: Check the Downlodr version compatibility in your manifest.

## Troubleshooting

### Common Issues

1. **Plugin doesn't load**
   - Check the console for errors
   - Verify your manifest.json has all required fields
   - Ensure your main JS file exports the plugin object correctly

2. **API methods not working**
   - Store the API reference in your plugin object (`this.api = api`)
   - Check that you're using the correct API namespace for your operation

3. **Menu items not appearing**
   - Verify you specified the correct context
   - Check if the plugin is enabled in the app

4. **Plugin conflicts**
   - Use a unique ID for your plugin using reverse domain notation

## Conclusion

This guide should help you get started with developing plugins for Downlodr. Review the Plugin API Reference and examples to understand how to leverage the plugin system to extend the application's functionality.

For more complex examples, refer to the sample plugins provided with the application or the official repository. If you encounter issues or have questions, consult the application's documentation or community forums.
