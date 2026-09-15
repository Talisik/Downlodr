#!/usr/bin/env node
/**
 * Keeps downlodr-mcp's dependency-free bundle (dist/index.js) fresh in dev.
 *
 * Only downlodr-mcp/src is in git — its node_modules and dist are ignored — and
 * the embedded chat agent reaches Downlodr solely through the `downlodr` CLI
 * shim that ensureDownlodrCliOnPath() (src/core-app/ipc/main/chatHandler.ts)
 * points straight at that dist/index.js. With no bundle on disk the shim is
 * skipped behind a console.warn and the agent silently falls back to generic
 * reasoning, so a fresh clone needs this built before the first `yarn start`.
 * Packaging has its own guard (forge.config.ts's prePackage hook); this is the
 * dev-side equivalent.
 *
 * Usage: node scripts/mcp-bundle.mjs [--force]
 */
import { spawnSync } from 'node:child_process';
import { existsSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PKG_DIR = path.join(ROOT, 'downlodr-mcp');
const BUNDLE = path.join(PKG_DIR, 'dist', 'index.js');

const log = (msg) => console.log(`[mcp-bundle] ${msg}`);

// shell: true so npm.cmd resolves on Windows (same reason as dev-packages.mjs).
function runShell(command) {
  return spawnSync(command, { cwd: PKG_DIR, stdio: 'inherit', shell: true }).status === 0;
}

function newestMtime(target) {
  let newest = 0;
  const visit = (p) => {
    let stat;
    try {
      stat = statSync(p);
    } catch {
      return; // vanished mid-walk — nothing to compare against
    }
    if (stat.isDirectory()) {
      for (const entry of readdirSync(p)) visit(path.join(p, entry));
    } else if (stat.mtimeMs > newest) {
      newest = stat.mtimeMs;
    }
  };
  visit(target);
  return newest;
}

// The bundle is stale when anything it is built from is newer than it: the
// sources, the build script itself, or the dependency set it inlines.
function isStale() {
  if (!existsSync(BUNDLE)) return true;
  const built = statSync(BUNDLE).mtimeMs;
  const inputs = ['src', 'build.mjs', 'tsconfig.json', 'package.json'].map((f) =>
    newestMtime(path.join(PKG_DIR, f)),
  );
  return Math.max(...inputs) > built;
}

function main() {
  if (!existsSync(path.join(PKG_DIR, 'package.json'))) {
    log(`downlodr-mcp not found at ${PKG_DIR} — skipping`);
    return;
  }

  if (!existsSync(path.join(PKG_DIR, 'node_modules'))) {
    log('installing dependencies (npm ci)');
    if (!runShell('npm ci')) {
      log('ERROR: npm ci failed — run "yarn mcp:setup" manually; the embedded AI chat will have no `downlodr` CLI until it succeeds');
      return;
    }
  }

  if (!process.argv.includes('--force') && !isStale()) {
    log('bundle up to date');
    return;
  }

  log('building bundle');
  if (!runShell('npm run build')) {
    log('ERROR: build failed — the embedded AI chat will run without the `downlodr` CLI until "yarn mcp:build" succeeds');
  }
}

main();
// Never gate `yarn start`: a broken chat bundle must not stop the rest of the
// app from launching. Failures above are loud warnings, not a non-zero exit.
process.exit(0);
