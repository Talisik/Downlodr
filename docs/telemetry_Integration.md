# Downlodr Telemetry System - Current Implementation

## Overview

The Downlodr application currently has a **basic telemetry system** with the following components:

1. **TelemetryStore** - Persistent telemetry ID management (ACTIVE - initialized in App.tsx)
2. **TelemetryService** - Full-featured OpenTelemetry-compatible backend logging (EXISTS but only used for debug testing)
3. **sendErrorLog** -  Service for sending telemetry data to the API

## Current Implementation Status

### ✅ What's Currently Working

- **Telemetry ID Generation**: Unique persistent ID created on first app run
- **Local Storage**: ID stored in IndexedDB for persistence
- **Debug Testing**: Manual telemetry generation via debug button


## Integration Points

### App.tsx (Renderer Process)

**Current implementation in `src/App.tsx`:**

```typescript
import { initializeTelemetry } from './Store/telemetryStore';

const App = () => {
  const { settings } = useMainStore();

  // Initialize telemetry store on app startup (runs once)
  useEffect(() => {
    const initAppTelemetry = async () => {
      try {
        const telemetryId = await initializeTelemetry();
        console.log('✅ App telemetry initialized:', telemetryId);

        // Optional: Log app startup event
        if (telemetryId) {
          console.log('📊 Telemetry ready for app-wide usage');
        }
      } catch (error) {
        console.error('❌ Failed to initialize app telemetry:', error);
        // App continues to function normally even if telemetry fails
      }
    };

    initAppTelemetry();
  }, []); // Empty dependency array = runs once on mount

  // ... rest of app
};
```

### Debug Telemetry Button (Testing Only)

**Located in `src/Components/DebugTelemetryButton.tsx`:**

```typescript
import { TelemetryService } from '@/Utils/Telemetry/telemetry';
import { LogLevel } from '@/Utils/Telemetry/telemetryTypes';
import useSendErrorLog from '@/dataServices/sendErrorLog';

export const DebugTelemetryButton: React.FC = () => {
  const generateSampleTelemetryData = async () => {
    // Create a temporary telemetry service for demonstration
    const tempTelemetry = new TelemetryService({
      apiEndpoint: config.telemetry.endpoint,
    });

    // Initialize the telemetry service to load real device info
    await tempTelemetry.init();

    // Create sample log records and payload
    const telemetryPayload = {
      resource: tempTelemetry.getResource(),
      log_records: sampleLogRecords,
      scope_name: 'downlodr-telemetry',
      // ... complete payload structure
    };

    return telemetryPayload;
  };

  const handleClick = async () => {
    // Generate telemetry data
    const telemetryPayload = await generateSampleTelemetryData();
    
    // Send through placeholder service (currently doesn't actually send)
    const response = await useSendErrorLog(telemetryPayload);
  };
};
```

### Error Logging Service

**Located in `src/dataServices/sendErrorLog.ts`:**

```typescript
import { TelemetryPayload } from '@/Utils/Telemetry/telemetryTypes';
import { config } from '../config';

const useSendErrorLog = async (payload: TelemetryPayload) => {
  console.log('useSendErrorLog', payload);
  console.log('config.telemetry.endpoint', config.telemetry.endpoint);
  
  // COMMENTED OUT - Not actually sending data
  /*
  const response = await POST({
    headers: {
      'Content-Type': 'application/json',
    },
    url: config.telemetry.endpoint,
    data: payload,
  });

  return response.data;
  */
};
```

## Current TelemetryStore API

### Functions Available

```typescript
// Initialize the telemetry store and generate ID (used in App.tsx)
const telemetryId = await initializeTelemetry();

// Get the current telemetry ID anywhere in the app
const telemetryId = getTelemetryId();

// React hook for components
const { telemetryId, isInitialized, createdAt } = useTelemetryId();

// Local logging utilities (console only - no backend)
logWithTelemetry('info', 'Message', { additional: 'data' });
trackAction('button_click', { button: 'submit' });
trackError(new Error('Something failed'), { context: 'form_submission' });
```

### Telemetry ID Format

The telemetry ID format is: `{host_id}_{YYYY-MM-DD}_{timestamp}`

Example: `desktop-abc123_2024-01-15_1704934800000`

## TelemetryService

The `TelemetryService` class exists with full OpenTelemetry-compatible features:


### Capabilities

- Log buffering and batching
- Rich metadata collection (device info, process info, etc.)
- OpenTelemetry-compatible payload structure


## Configuration

The telemetry system can be configured via your existing config system. Currently references:

```typescript
// In sendErrorLog.ts
config.telemetry.endpoint
```

## Testing the Current System

### Debug Button

1. The app includes a debug telemetry button in the UI
2. Located in `DropdownBar.tsx` as `DebugTelemetryButton`
3. Generates sample telemetry data when clicked
4. Logs complete payload structure to console
5. Attempts to send via `sendErrorLog` (currently just logs)

### Console Verification

You can verify telemetry ID generation:

```typescript
import { getTelemetryId, logWithTelemetry } from './Store/telemetryStore';

// Check if telemetry ID exists
const id = getTelemetryId();
console.log('Current telemetry ID:', id);

// Test local logging
logWithTelemetry('info', 'Testing telemetry system');
```

## File Locations

### Active Files
- **TelemetryStore**: `src/Store/telemetryStore.tsx` ✅ (Active)
- **App Integration**: `src/App.tsx` ✅ (Active)
- **Debug Component**: `src/Components/DebugTelemetryButton.tsx` ✅ (Active)

### Available but Inactive Files
- **TelemetryService**: `src/Utils/Telemetry/telemetry.ts`
- **Types**: `src/Utils/Telemetry/telemetryTypes.ts`
- **Error Logging**: `src/dataServices/sendErrorLog.ts`

---