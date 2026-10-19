#!/usr/bin/env node
/**
 * Fills in the add-on download links in addons.config.json at build time.
 *
 * The public repo ships addons.config.json with blank fileId/downloadUrl so the
 * package links aren't published. CI passes them in through the
 * ADDONS_DOWNLOAD_URLS secret, a JSON object keyed by pack name:
 *
 *   {"afda-backend": "https://...", "video-nemesis-toolkit": "https://...", ...}
 *
 * Fails the build if the secret is missing or any pack is still left without
 * a link: a release with a blank downloadUrl can't install that add-on at all
 * ("No download URL configured"), so shipping one is worse than not building.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const configPath = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  '..',
  'addons.config.json',
);

function fail(message) {
  console.error(`❌ inject-addon-urls: ${message}`);
  process.exit(1);
}

const raw = process.env.ADDONS_DOWNLOAD_URLS;
if (!raw) fail('ADDONS_DOWNLOAD_URLS is not set');

let urls;
try {
  urls = JSON.parse(raw);
} catch {
  fail('ADDONS_DOWNLOAD_URLS is not valid JSON');
}

const config = JSON.parse(fs.readFileSync(configPath, 'utf-8'));

for (const [pack, url] of Object.entries(urls)) {
  if (!config[pack]) fail(`unknown pack "${pack}" in ADDONS_DOWNLOAD_URLS`);
  config[pack].downloadUrl = url;
}

const missing = Object.keys(config).filter((pack) => !config[pack].downloadUrl);
if (missing.length) fail(`no download URL for: ${missing.join(', ')}`);

fs.writeFileSync(configPath, `${JSON.stringify(config, null, 2)}\n`);
// Names only — the links themselves stay out of the build log.
console.log(`✅ inject-addon-urls: set links for`);
