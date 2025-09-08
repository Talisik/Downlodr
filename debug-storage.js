// Storage debugging script for Downlodr
// Run this in the browser console to check storage

console.log('=== STORAGE DEBUGGING ===');

// Check localStorage
console.log('\n🗄️ LocalStorage:');
try {
  const keys = Object.keys(localStorage);
  console.log('Keys found:', keys);
  
  keys.forEach(key => {
    const value = localStorage.getItem(key);
    console.log(`${key}:`, value?.slice(0, 200) + (value?.length > 200 ? '...' : ''));
  });
  
  // Check specific store keys
  const downloadStore = localStorage.getItem('downlodr-storage');
  const settingsStore = localStorage.getItem('download-settings-storage');
  const pluginStore = localStorage.getItem('download-plugin-storage');
  
  console.log('\n📊 Store sizes:');
  console.log('Download store:', downloadStore ? `${(downloadStore.length / 1024).toFixed(2)} KB` : 'Not found');
  console.log('Settings store:', settingsStore ? `${(settingsStore.length / 1024).toFixed(2)} KB` : 'Not found');
  console.log('Plugin store:', pluginStore ? `${(pluginStore.length / 1024).toFixed(2)} KB` : 'Not found');
  
} catch (error) {
  console.error('LocalStorage error:', error);
}

// Check IndexedDB
console.log('\n🏗️ IndexedDB:');
if ('indexedDB' in window) {
  console.log('IndexedDB supported: ✅');
  
  // Check for Downlodr databases
  indexedDB.databases().then(databases => {
    console.log('Available databases:', databases);
    
    // Check telemetry database specifically
    const telemetryDB = databases.find(db => db.name === 'downlodr-telemetry-database');
    if (telemetryDB) {
      console.log('Telemetry database found:', telemetryDB);
      
      // Open and inspect telemetry database
      const dbRequest = indexedDB.open('downlodr-telemetry-database');
      dbRequest.onsuccess = () => {
        const db = dbRequest.result;
        console.log('Telemetry DB stores:', Array.from(db.objectStoreNames));
        
        const transaction = db.transaction(['telemetry-storage'], 'readonly');
        const store = transaction.objectStore('telemetry-storage');
        const getAllRequest = store.getAll();
        
        getAllRequest.onsuccess = () => {
          console.log('Telemetry data:', getAllRequest.result);
        };
        
        getAllRequest.onerror = () => {
          console.error('Failed to read telemetry data:', getAllRequest.error);
        };
      };
      
      dbRequest.onerror = () => {
        console.error('Failed to open telemetry database:', dbRequest.error);
      };
    } else {
      console.log('❌ Telemetry database not found');
    }
  }).catch(error => {
    console.error('Failed to list databases:', error);
  });
  
} else {
  console.log('IndexedDB not supported: ❌');
}

// Check if data is being saved
console.log('\n🔄 Testing save operations...');
try {
  // Test localStorage save
  localStorage.setItem('test-storage', JSON.stringify({test: true, timestamp: Date.now()}));
  const testData = localStorage.getItem('test-storage');
  console.log('LocalStorage test:', testData ? '✅ Working' : '❌ Failed');
  localStorage.removeItem('test-storage');
} catch (error) {
  console.error('LocalStorage test failed:', error);
}