#!/usr/bin/env node
/**
 * Fetches the large gitignored binaries the app needs at runtime — ffmpeg.exe,
 * ffprobe.exe and ggml-small.bin — into the repo root.
 *
 * `.gitignore` blanket-ignores `*.exe`, and the whisper model is 487MB, so none
 * of these three can live in git. forge.config.ts's extraResource copies them
 * from the repo root at package time, and in dev transcriptHandler.ts resolves
 * ffmpeg from process.cwd(); either way a fresh clone has no transcription until
 * they are on disk. Declared in package.json's "downlodrBinaries" field.
 *
 * ffmpeg must be a *full* build: only those are compiled with --enable-whisper,
 * and the essentials/shared builds fail at runtime with "No such filter:
 * 'whisper'" rather than at install time. 8.0.0 additionally corrupts every
 * subtitle cue it writes, hence the minVersion gate here and in forge.config.ts.
 *
 * Usage: node scripts/binaries.mjs <check|setup> [--force]
 */
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import {
  copyFileSync,
  createWriteStream,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  statSync,
} from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import process from 'node:process';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

const log = (msg) => console.log(`[binaries] ${msg}`);

function loadSpecs() {
  const pkg = JSON.parse(readFileSync(path.join(ROOT, 'package.json'), 'utf8'));
  return pkg.downlodrBinaries ?? {};
}

const mb = (bytes) => `${(bytes / 1024 / 1024).toFixed(0)}MB`;

/**
 * bsdtar reads .7z, but GNU tar does not — and on a dev box with Git for
 * Windows installed, a bare `tar` resolves to Git's GNU tar first and dies with
 * "Unrecognized archive format". Always call the shipped bsdtar by full path.
 */
const BSDTAR = path.join(
  process.env.SystemRoot ?? 'C:\\Windows',
  'System32',
  'tar.exe',
);

async function download(url, destPath) {
  const res = await fetch(url, { redirect: 'follow' });
  if (!res.ok || !res.body) throw new Error(`HTTP ${res.status} for ${url}`);

  const total = Number(res.headers.get('content-length')) || 0;
  const body = Readable.fromWeb(res.body);

  // A \r-updated counter is only meaningful on a terminal; piped to a file or a
  // CI log it would emit hundreds of junk lines, so there it stays silent.
  if (process.stdout.isTTY) {
    let seen = 0;
    let lastPrint = 0;
    body.on('data', (chunk) => {
      seen += chunk.length;
      if (Date.now() - lastPrint < 250) return; // throttle to ~4 redraws/sec
      lastPrint = Date.now();
      const pct = total ? ` (${((seen / total) * 100).toFixed(0)}%)` : '';
      process.stdout.write(
        `\r[binaries]   ${mb(seen)}${total ? ` / ${mb(total)}` : ''}   ${pct}`,
      );
    });
  } else if (total) {
    log(`  ${mb(total)} to fetch`);
  }

  await pipeline(body, createWriteStream(destPath));
  if (process.stdout.isTTY) process.stdout.write('\r\x1b[K'); // clear the counter
}

function sha256(filePath) {
  const hash = createHash('sha256');
  hash.update(readFileSync(filePath));
  return hash.digest('hex');
}

/**
 * Pulls the wanted basenames out of an extracted tree. The layout inside gyan's
 * archive is versioned (ffmpeg-9.0.1-full_build/bin/...), so matching on
 * basename rather than a hardcoded path keeps a version bump to a one-line
 * package.json edit.
 */
function collectByBasename(dir, wanted, found = new Map()) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) collectByBasename(full, wanted, found);
    else if (wanted.includes(entry.name) && !found.has(entry.name))
      found.set(entry.name, full);
  }
  return found;
}

async function install(name, spec) {
  const tmpDir = mkdtempSync(path.join(os.tmpdir(), 'downlodr-binaries-'));
  try {
    const artifact = path.join(
      tmpDir,
      path.basename(new URL(spec.url).pathname),
    );
    log(`${name}: downloading ${spec.url}`);
    await download(spec.url, artifact);

    if (spec.sha256) {
      const actual = sha256(artifact);
      if (actual !== spec.sha256) {
        log(`${name}: ERROR: checksum mismatch`);
        log(`${name}:   expected ${spec.sha256}`);
        log(`${name}:   actual   ${actual}`);
        log(
          `${name}: the upstream file changed or the download was corrupted — not installing`,
        );
        return false;
      }
    }

    if (spec.archive) {
      log(`${name}: extracting`);
      const extractDir = path.join(tmpDir, 'x');
      mkdirSync(extractDir);
      if (
        spawnSync(BSDTAR, ['-xf', artifact, '-C', extractDir], {
          stdio: 'inherit',
        }).status !== 0
      ) {
        log(`${name}: ERROR: extraction failed — is ${BSDTAR} present?`);
        return false;
      }
      const found = collectByBasename(extractDir, spec.files);
      const missing = spec.files.filter((f) => !found.has(f));
      if (missing.length > 0) {
        log(`${name}: ERROR: archive did not contain ${missing.join(', ')}`);
        return false;
      }
      for (const [file, src] of found) copyFileSync(src, path.join(ROOT, file));
    } else {
      // Single unarchived file — spec.files holds the one name to install as.
      copyFileSync(artifact, path.join(ROOT, spec.files[0]));
    }

    for (const file of spec.files) {
      log(
        `${name}: installed ${file} (${mb(
          statSync(path.join(ROOT, file)).size,
        )})`,
      );
    }
    return true;
  } catch (err) {
    log(`${name}: ERROR: ${err.message}`);
    return false;
  } finally {
    rmSync(tmpDir, { recursive: true, force: true });
  }
}

/**
 * Verifies an installed ffmpeg is new enough and actually has the whisper
 * filter. Deliberately does not re-hash the installed files: `check` runs on
 * every `yarn start` and hashing 700MB would add seconds to each launch.
 * Returns null when satisfied, or a human-readable reason.
 */
function inspectFfmpeg(spec) {
  if (!spec.minVersion) return null;
  const exe = path.join(ROOT, 'ffmpeg.exe');
  const res = spawnSync(exe, ['-version'], { encoding: 'utf8' });
  if (res.status !== 0) return 'ffmpeg.exe will not run';

  const out = res.stdout ?? '';
  const m = out.match(/ffmpeg version (\d+)\.(\d+)(?:\.(\d+))?/);
  if (!m) return 'could not parse ffmpeg version';

  const actual = [Number(m[1]), Number(m[2]), Number(m[3] ?? 0)];
  const wanted = spec.minVersion.split('.').map(Number);
  for (let i = 0; i < 3; i++) {
    if (actual[i] > (wanted[i] ?? 0)) break;
    if (actual[i] < (wanted[i] ?? 0)) {
      return `ffmpeg ${actual.join('.')} is older than the required ${
        spec.minVersion
      }`;
    }
  }
  if (!out.includes('--enable-whisper')) {
    return 'this ffmpeg build lacks --enable-whisper (you likely have an essentials build, not a full one)';
  }
  return null;
}

/** Reasons this spec is not satisfied; empty array means it is. */
function problems(name, spec) {
  const missing = spec.files.filter((f) => !existsSync(path.join(ROOT, f)));
  if (missing.length > 0) return [`missing ${missing.join(', ')}`];
  const reason = name === 'ffmpeg' ? inspectFfmpeg(spec) : null;
  return reason ? [reason] : [];
}

async function setup(specs, force) {
  let failed = false;
  for (const [name, spec] of Object.entries(specs)) {
    const issues = problems(name, spec);
    if (issues.length === 0 && !force) {
      log(
        `${name}: already present — use "yarn binaries:setup --force" to reinstall`,
      );
      continue;
    }
    if (issues.length > 0) log(`${name}: ${issues.join('; ')}`);
    if (!(await install(name, spec))) failed = true;
  }
  if (failed) {
    log(
      'one or more binaries could not be installed — transcription will not work until they are',
    );
    return 1;
  }
  log('all binaries present');
  return 0;
}

function check(specs) {
  let notices = 0;
  for (const [name, spec] of Object.entries(specs)) {
    for (const issue of problems(name, spec)) {
      log(`${name}: ${issue} — run "yarn binaries:setup"`);
      notices++;
    }
  }
  if (notices === 0) log('binaries present');
  return 0; // check is a signal, never a gate — must not block yarn start
}

async function main() {
  const specs = loadSpecs();
  const cmd = process.argv[2];

  // Every asset here is a Windows build; there is nothing to fetch elsewhere.
  if (process.platform !== 'win32') {
    log(`not Windows (${process.platform}) — skipping`);
    return 0;
  }
  if (cmd === 'check') return check(specs);
  if (cmd === 'setup') return setup(specs, process.argv.includes('--force'));

  console.error('usage: node scripts/binaries.mjs <check|setup> [--force]');
  return 2;
}

process.exit(await main());
