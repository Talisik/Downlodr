# Zustand Store Migration Guide

This guide explains how to safely modify your Zustand store structures without losing user data in localStorage.

## Overview

Both `mainStore.tsx` and `downloadStore.tsx` now include migration functionality that automatically handles state structure changes. This prevents localStorage from resetting when you modify your store interfaces.

## How Migration Works

### Version System
- Each store has a version constant (e.g., `MAIN_STORE_VERSION = 1`)
- When the version in code doesn't match the persisted version, migration runs
- Migration functions transform old state structures to new ones

### Migration Process
1. User loads app with existing localStorage data
2. Zustand checks if persisted version matches current version
3. If versions differ, migration function runs
4. Old state is transformed to match new structure
5. New version is saved to localStorage

## Making Changes to Store Structure

### Step 1: Increment Version
```typescript
// Before: const MAIN_STORE_VERSION = 1;
const MAIN_STORE_VERSION = 2;
```

### Step 2: Add Migration Logic
Add your migration case to the existing migration function:

```typescript
const migrateMainStore = (persistedState: any, version: number) => {
  // ... existing code ...
  
  // Handle migration from version 1 to 2
  if (version === 1) {
    return {
      ...persistedState,
      // Add new field with default value
      newField: 'defaultValue',
      // Transform existing field
      oldArray: Array.isArray(persistedState.oldArray) 
        ? persistedState.oldArray.map(item => ({
            ...item,
            newProperty: 'default'
          }))
        : [],
      // Remove obsolete fields (they just won't be included)
    };
  }
  
  // ... rest of function ...
};
```

### Step 3: Update Interface
Add your new fields to the TypeScript interface:

```typescript
interface MainStore {
  // ... existing fields ...
  newField: string; // Add new field
  // Remove obsolete fields from interface
}
```

## Common Migration Patterns

### Adding New Fields
```typescript
if (version === 1) {
  return {
    ...persistedState,
    newField: 'defaultValue',
    newArray: [],
    newObject: { prop: 'default' },
  };
}
```

### Transforming Arrays
```typescript
if (version === 1) {
  return {
    ...persistedState,
    downloads: Array.isArray(persistedState.downloads)
      ? persistedState.downloads.map(download => ({
          ...download,
          newProperty: download.oldProperty || 'default',
          // Remove oldProperty by not including it
        }))
      : [],
  };
}
```

### Renaming Fields
```typescript
if (version === 1) {
  return {
    ...persistedState,
    newFieldName: persistedState.oldFieldName || 'default',
    // Don't include oldFieldName in return object
  };
}
```

### Complex Transformations
```typescript
if (version === 1) {
  // Handle complex nested structure changes
  const migratedSettings = {
    ...persistedState.settings,
    // Restructure nested objects
    newSection: {
      prop1: persistedState.settings.oldProp1 || 'default',
      prop2: persistedState.settings.oldProp2 || false,
    },
  };
  
  return {
    ...persistedState,
    settings: migratedSettings,
  };
}
```

## Best Practices

### 1. Always Increment Version
Never modify existing migration logic. Always increment version and add new migration cases.

### 2. Provide Safe Defaults
Always provide fallback values for missing data:
```typescript
newField: persistedState.newField || 'defaultValue'
```

### 3. Validate Array Data
Always check if arrays exist and are valid:
```typescript
Array.isArray(persistedState.myArray) ? persistedState.myArray : []
```

### 4. Test Migrations
Test your migrations with different localStorage states:
- Empty localStorage (new user)
- Previous version data
- Corrupted data

### 5. Log Migration Success
The migration functions already log their progress. Monitor these logs to ensure migrations work correctly.

## Example: Adding Download Progress History

Let's say you want to add progress history tracking to downloads:

### Step 1: Update Version
```typescript
// In downloadStore.tsx
const DOWNLOAD_STORE_VERSION = 2; // Increment from 1 to 2
```

### Step 2: Update Interface
```typescript
interface BaseDownload {
  // ... existing fields ...
  progressHistory?: { timestamp: number; progress: number }[];
}
```

### Step 3: Add Migration
```typescript
const migrateDownloadStore = (persistedState: any, version: number) => {
  // ... existing migration code ...
  
  // Handle migration from version 1 to 2
  if (version === 1) {
    const migrateDownloadArray = (downloads: any[]) => 
      downloads.map(download => ({
        ...download,
        progressHistory: [], // Add empty history for existing downloads
      }));
    
    return {
      ...persistedState,
      downloading: Array.isArray(persistedState.downloading) 
        ? migrateDownloadArray(persistedState.downloading)
        : [],
      finishedDownloads: Array.isArray(persistedState.finishedDownloads)
        ? migrateDownloadArray(persistedState.finishedDownloads)
        : [],
      // ... migrate other download arrays ...
    };
  }
  
  // ... rest of function ...
};
```

## Troubleshooting

### Migration Not Running
- Check that version number was incremented
- Verify migration function is added to persist config
- Check browser console for migration logs

### Data Loss
- Migration functions should preserve existing data
- Always test with actual localStorage data
- Provide defaults for all new fields

### Performance Issues
- Keep migrations simple and fast
- Avoid heavy computations in migration functions
- Consider data cleanup for very large datasets

## Testing Migrations

### Manual Testing
1. Create localStorage with old structure
2. Update code with new version and migration
3. Reload app and verify data migrated correctly

### Automated Testing
```typescript
// Example test
describe('Store Migration', () => {
  it('should migrate from v1 to v2', () => {
    const oldState = { /* v1 structure */ };
    const migrated = migrateMainStore(oldState, 1);
    expect(migrated.newField).toBe('defaultValue');
  });
});
```

This migration system ensures your users never lose their data when you update your application structure! 