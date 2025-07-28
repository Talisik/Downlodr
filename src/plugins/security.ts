// src/plugins/security.ts
import fs from 'fs';
import path from 'path';
import yauzl from 'yauzl';

export async function extractPlugin(
  zipPath: string,
  extractTo: string,
): Promise<string> {
  return new Promise((resolve, reject) => {
    console.log(`Starting extraction of: ${zipPath}`);
    console.log(`Extracting to: ${extractTo}`);

    // Extract zip file using yauzl
    yauzl.open(zipPath, { lazyEntries: true }, (err, zipfile) => {
      if (err || !zipfile) {
        console.error('Failed to open zip file:', err);
        reject(err || new Error('Failed to open zip file'));
        return;
      }

      // Create temporary directory for extraction
      const tempDir = path.join(extractTo, 'temp-plugin-' + Date.now());
      console.log(`Creating temp directory: ${tempDir}`);
      fs.mkdirSync(tempDir, { recursive: true });

      let pendingEntries = 0;
      let completed = false;
      let totalEntries = 0;
      let processedEntries = 0;
      let zipReadingComplete = false;

      const finish = () => {
        // Only finish when zip reading is complete AND all files are processed
        if (!completed && pendingEntries === 0 && zipReadingComplete) {
          completed = true;

          console.log(
            `Extraction complete. Processed ${processedEntries}/${totalEntries} entries`,
          );
          console.log(`Looking for plugin root in: ${tempDir}`);

          // List contents of temp directory for debugging
          try {
            const tempContents = fs.readdirSync(tempDir);
            console.log('Temp directory contents:', tempContents);
            tempContents.forEach((item) => {
              const itemPath = path.join(tempDir, item);
              const stat = fs.statSync(itemPath);
              console.log(
                `  ${item} (${stat.isDirectory() ? 'directory' : 'file'})`,
              );
              if (stat.isDirectory()) {
                try {
                  const subContents = fs.readdirSync(itemPath);
                  console.log(`    Subdirectory contents:`, subContents);
                } catch (err) {
                  console.log(`    Error reading subdirectory: ${err.message}`);
                }
              }
            });
          } catch (err) {
            console.log('Error listing temp directory contents:', err.message);
          }

          // Look for the plugin root directory
          const extractedPath = findPluginRoot(tempDir);
          if (extractedPath) {
            console.log(`Found plugin root at: ${extractedPath}`);
            resolve(extractedPath);
          } else {
            console.error('No valid plugin structure found in extracted files');
            reject(
              new Error('No valid plugin structure found in extracted files'),
            );
          }
        }
      };

      zipfile.on('entry', (entry) => {
        totalEntries++;
        console.log(
          `Processing entry: ${entry.fileName} (${entry.uncompressedSize} bytes)`,
        );

        if (/\/$/.test(entry.fileName)) {
          // Directory entry
          const dirPath = path.join(tempDir, entry.fileName);
          console.log(`Creating directory: ${dirPath}`);
          fs.mkdirSync(dirPath, { recursive: true });
          processedEntries++;
          zipfile.readEntry();
        } else {
          // File entry
          pendingEntries++;

          zipfile.openReadStream(entry, (err, readStream) => {
            if (err) {
              console.error(
                `Error opening read stream for ${entry.fileName}:`,
                err,
              );
              pendingEntries--;
              reject(err);
              return;
            }

            if (!readStream) {
              console.error(`No read stream for ${entry.fileName}`);
              pendingEntries--;
              reject(new Error('Failed to create read stream'));
              return;
            }

            const filePath = path.join(tempDir, entry.fileName);
            const fileDir = path.dirname(filePath);

            // Ensure directory exists
            fs.mkdirSync(fileDir, { recursive: true });

            console.log(`Extracting file to: ${filePath}`);
            const writeStream = fs.createWriteStream(filePath);

            writeStream.on('error', (err) => {
              console.error(`Write error for ${entry.fileName}:`, err);
              pendingEntries--;
              reject(err);
            });

            writeStream.on('close', () => {
              console.log(`Successfully extracted: ${entry.fileName}`);
              pendingEntries--;
              processedEntries++;
              // Only attempt to finish if conditions are met
              finish();
            });

            readStream.pipe(writeStream);
            zipfile.readEntry();
          });
        }
      });

      zipfile.on('end', () => {
        console.log(
          `Zip file reading complete. Total entries: ${totalEntries}`,
        );
        zipReadingComplete = true;
        // Attempt to finish now that zip reading is complete
        finish();
      });

      zipfile.on('error', (err) => {
        console.error('Zip file error:', err);
        reject(err);
      });

      zipfile.readEntry();
    });
  });
}

/**
 * Find the root directory containing the plugin manifest
 */
function findPluginRoot(extractedDir: string): string | null {
  console.log(`🔍 Looking for plugin root in: ${extractedDir}`);

  try {
    // Check if manifest.json is directly in the extracted directory
    const directManifest = path.join(extractedDir, 'manifest.json');
    console.log(`Checking for direct manifest: ${directManifest}`);
    if (fs.existsSync(directManifest)) {
      console.log('✅ Found manifest.json directly in extracted directory');
      return extractedDir;
    }

    // Also check for different case variations
    const manifestVariations = [
      'manifest.json',
      'Manifest.json',
      'MANIFEST.json',
      'manifest.JSON',
    ];
    for (const variation of manifestVariations) {
      const manifestPath = path.join(extractedDir, variation);
      console.log(`Checking manifest variation: ${manifestPath}`);
      if (fs.existsSync(manifestPath)) {
        console.log(`✅ Found manifest file: ${variation}`);
        return extractedDir;
      }
    }

    // Look for manifest.json in subdirectories (common case: zip contains a folder)
    const items = fs.readdirSync(extractedDir);
    console.log(
      `📁 Found ${items.length} items in extracted directory:`,
      items,
    );

    for (const item of items) {
      const itemPath = path.join(extractedDir, item);
      console.log(`Checking item: ${item} at ${itemPath}`);

      try {
        const stat = fs.statSync(itemPath);
        console.log(
          `  ${item} is a ${stat.isDirectory() ? 'directory' : 'file'}`,
        );

        if (stat.isDirectory()) {
          console.log(`📂 Searching in subdirectory: ${item}`);

          // Check all manifest variations in this subdirectory
          for (const variation of manifestVariations) {
            const manifestPath = path.join(itemPath, variation);
            console.log(`  Checking: ${manifestPath}`);
            if (fs.existsSync(manifestPath)) {
              console.log(`✅ Found ${variation} in subdirectory: ${item}`);
              return itemPath;
            }
          }

          // List contents of subdirectory for debugging
          try {
            const subItems = fs.readdirSync(itemPath);
            console.log(`  Subdirectory contents:`, subItems);
          } catch (err) {
            console.log(`  Error reading subdirectory: ${err.message}`);
          }

          // Recursively search one level deeper
          console.log(`🔍 Recursively searching in: ${item}`);
          const subResult = findPluginRoot(itemPath);
          if (subResult) {
            console.log(`✅ Found plugin root via recursion: ${subResult}`);
            return subResult;
          }
        }
      } catch (statError) {
        console.log(`Error checking item ${item}:`, statError.message);
      }
    }

    console.log('❌ No valid plugin structure found');
    return null;
  } catch (error) {
    console.error('Error finding plugin root:', error);
    return null;
  }
}

export async function validatePlugin(pluginPath: string): Promise<boolean> {
  try {
    // Check for required files
    const manifestPath = path.join(pluginPath, 'manifest.json');
    if (!fs.existsSync(manifestPath)) {
      return false;
    }

    // Parse and validate manifest
    const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));

    // Check required fields
    if (!manifest.id || !manifest.name || !manifest.version) {
      return false;
    }

    // Check main file exists
    const mainFile = path.join(pluginPath, manifest.main || 'index.js');
    if (!fs.existsSync(mainFile)) {
      return false;
    }

    return true;
  } catch (error) {
    console.error('Plugin validation failed:', error);
    return false;
  }
}
