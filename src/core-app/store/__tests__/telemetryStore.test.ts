/**
 * Test for telemetry store persistence
 * Ensures that telemetryConsentShown is properly persisted
 */

import { useTelemetryStore } from '../telemetryStore';

// Mock IndexedDB storage
const mockStorage = {
  data: new Map<string, string>(),
  getItem: jest.fn((key: string) => Promise.resolve(mockStorage.data.get(key) || null)),
  setItem: jest.fn((key: string, value: string) => {
    mockStorage.data.set(key, value);
    return Promise.resolve();
  }),
  removeItem: jest.fn((key: string) => {
    mockStorage.data.delete(key);
    return Promise.resolve();
  }),
};

// Mock the IndexedDB storage creation
jest.mock('@/core-app/utils/indexedDBStorage', () => ({
  createIndexedDBStorageWithMigration: () => mockStorage,
}));

describe('TelemetryStore Persistence', () => {
  beforeEach(() => {
    // Clear mock storage before each test
    mockStorage.data.clear();
    jest.clearAllMocks();
  });

  it('should persist telemetryConsentShown when set to true', async () => {
    const store = useTelemetryStore.getState();
    
    // Initially should be false
    expect(store.settings.telemetryConsentShown).toBe(false);
    
    // Update consent shown to true
    store.updateTelemetryConsentShown(true);
    
    // Verify it's updated in memory
    expect(useTelemetryStore.getState().settings.telemetryConsentShown).toBe(true);
    
    // Wait for persistence to complete
    await new Promise(resolve => setTimeout(resolve, 100));
    
    // Verify setItem was called with the correct data
    expect(mockStorage.setItem).toHaveBeenCalled();
    
    // Get the persisted data
    const persistedData = JSON.parse(mockStorage.setItem.mock.calls[0][1]);
    
    // Verify settings are included in persisted data
    expect(persistedData.state.settings).toBeDefined();
    expect(persistedData.state.settings.telemetryConsentShown).toBe(true);
  });

  it('should persist telemetryEnabled setting', async () => {
    const store = useTelemetryStore.getState();
    
    // Update telemetry enabled
    store.updateTelemetryEnabled(true);
    
    // Verify it's updated in memory
    expect(useTelemetryStore.getState().settings.telemetryEnabled).toBe(true);
    
    // Wait for persistence to complete
    await new Promise(resolve => setTimeout(resolve, 100));
    
    // Verify setItem was called
    expect(mockStorage.setItem).toHaveBeenCalled();
    
    // Get the persisted data
    const persistedData = JSON.parse(mockStorage.setItem.mock.calls[0][1]);
    
    // Verify settings are included in persisted data
    expect(persistedData.state.settings.telemetryEnabled).toBe(true);
  });

  it('should include telemetryData in persistence', async () => {
    const store = useTelemetryStore.getState();
    
    // Initialize telemetry (this would normally generate an ID)
    await store.initialize();
    
    // Wait for persistence to complete
    await new Promise(resolve => setTimeout(resolve, 100));
    
    // Verify setItem was called
    expect(mockStorage.setItem).toHaveBeenCalled();
    
    // Get the persisted data
    const persistedData = JSON.parse(mockStorage.setItem.mock.calls[0][1]);
    
    // Verify telemetryData structure is preserved
    expect(persistedData.state.telemetryData).toBeDefined();
    expect(persistedData.state.telemetryData.telemetryId).toBeDefined();
    expect(persistedData.state.telemetryData.isInitialized).toBeDefined();
  });
});