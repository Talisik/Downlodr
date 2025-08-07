# Native macOS Notification System

The Downlodr app includes a comprehensive native notification system and dock badge counter that provides real-time feedback about download status and progress.

## Features

### 🔔 Native macOS Notifications
- **Download Complete**: Notifications when downloads finish successfully
- **Download Failed**: Notifications when downloads encounter errors
- **Conversion Complete**: Notifications when format conversions finish
- **Batch Complete**: Notifications when multiple downloads finish together
- **App Updates**: Notifications about available app updates

### 🔴 Dock Badge Counter
- **Real-time Count**: Shows number of active downloads on the dock icon
- **Conversion Support**: Optional inclusion of active conversions in the count
- **Auto-clear**: Badge automatically clears when no operations are active
- **99+ Support**: Displays "99+" for counts over 99

## User Settings

All notification and badge features can be configured in **Settings > Notifications & Dock Badge**:

### Notification Preferences
- ✅ Show notification when downloads complete
- ✅ Show notification when downloads fail  
- ✅ Show notification when conversions complete
- ✅ Show notification when batch downloads complete
- ✅ Play sound with notifications

### Dock Badge Settings
- ✅ Show badge counter on dock icon
- ✅ Include conversions in badge count

## Technical Implementation

### Architecture
The notification system consists of several components:

1. **NotificationManager** (`src/Utils/notificationSystem.ts`)
   - Handles native notification display
   - Manages user preferences
   - Provides permission handling

2. **DockBadgeManager** (`src/Utils/notificationSystem.ts`)
   - Manages dock badge counter
   - Tracks active downloads/conversions
   - Updates badge in real-time

3. **NotificationManager Component** (`src/Components/SubComponents/custom/NotificationManager.tsx`)
   - Integrates with download store
   - Automatically shows notifications for download events
   - Manages badge counter updates

4. **Settings Integration** (`src/Components/Main/Modal/SettingsModal.tsx`)
   - User preference controls
   - Real-time setting updates

### IPC Communication
The system uses Electron IPC for native functionality:

```typescript
// Notification API
window.notificationAPI.showNotification(config)
window.notificationAPI.requestPermissions()
window.notificationAPI.hasPermissions()

// Dock Badge API  
window.dockBadgeAPI.setBadgeCount(count)
window.dockBadgeAPI.getBadgeCount()
window.dockBadgeAPI.clearBadge()
```

### Store Integration
Notification preferences are stored in the main Zustand store:

```typescript
interface DownloadSettings {
  notificationPreferences: {
    downloadComplete: boolean;
    downloadFailed: boolean;
    conversionComplete: boolean;
    batchComplete: boolean;
    appUpdates: boolean;
    soundEnabled: boolean;
  };
  dockBadgePreferences: {
    showBadge: boolean;
    includeConversions: boolean;
    includePausedDownloads: boolean;
  };
}
```

## Usage Examples

### Testing Notifications (Development)
In development mode, test utilities are available in the browser console:

```javascript
// Test all notification types
window.testNotifications.testAll()

// Test individual notifications
window.testNotifications.testDownloadComplete()
window.testNotifications.testDownloadFailed()
window.testNotifications.testConversionComplete()
window.testNotifications.testBatchComplete()

// Test dock badge
window.testNotifications.testDockBadge()

// Check permissions
window.testNotifications.testPermissions()

// View current preferences
window.testNotifications.getPreferences()
```

### Programmatic Usage
```typescript
import { notificationManager, dockBadgeManager, NotificationType } from '@/Utils/notificationSystem';

// Show a notification
await notificationManager.showNotification(
  NotificationType.DOWNLOAD_COMPLETE,
  'My Video',
  { 
    filename: 'video.mp4',
    location: '/Downloads/video.mp4'
  }
);

// Update dock badge
dockBadgeManager.incrementDownloads();
dockBadgeManager.setDownloadCount(5);
dockBadgeManager.clearBadge();
```

## Platform Compatibility

### macOS Features
- ✅ Native Notification Center integration
- ✅ Dock badge counter with red background
- ✅ System sound support
- ✅ Click-to-focus functionality
- ✅ Show in Finder actions
- ✅ Do Not Disturb respect

### Cross-platform Fallbacks
- Windows/Linux: Basic system notifications (no dock badge)
- Web: Browser notifications with permission prompts
- Graceful degradation when features are unavailable

## Security & Permissions

### Notification Permissions
- Automatically requested on first app launch
- Graceful handling of denied permissions
- User can enable/disable via system settings or app settings
- No data collection or external communication

### Privacy
- All notifications are generated locally
- No sensitive user data is included in notification content
- Respects system Do Not Disturb settings
- User has full control over notification types and frequency

## Error Handling

The system includes comprehensive error handling:
- Permission denied scenarios
- Platform compatibility checks
- IPC communication failures
- Store state corruption recovery

## Performance

### Optimizations
- Notification throttling to prevent spam
- Efficient memory management with cleanup
- Minimal CPU impact using event-driven architecture
- Badge updates are debounced for better performance

### Memory Management
- Automatic cleanup of processed notification IDs
- Limited notification history to prevent memory leaks
- Efficient state management with Zustand

## Future Enhancements

Potential future improvements:
- [ ] Custom notification sounds
- [ ] Notification history view
- [ ] Advanced filtering options
- [ ] Rich notification content (thumbnails)
- [ ] Integration with iOS/iPadOS via Universal Clipboard
- [ ] Notification scheduling and quiet hours