#!/usr/bin/env node
/**
 * Dev packages tool — manages the gitignored backend package clones
 * declared in package.json's "downlodrDev" field.
 * Spec: docs/superpowers/specs/2026-07-14-dev-packages-workflow-design.md
 *
 * Usage: node scripts/dev-packages.mjs <check|setup|update> [--config <file>]
 */
import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

// --config <file> points at a standalone JSON file with the same shape as
// downlodrDev; package paths inside it resolve relative to the file. Used
// for exercising the tool against fixture repos.
function loadConfig() {
  const flag = process.argv.indexOf('--config');
  if (flag !== -1) {
    const value = process.argv[flag + 1];
    if (!value) {
      console.error('usage: node scripts/dev-packages.mjs <check|setup|update> [--config <file>]');
      process.exit(2);
    }
    const file = path.resolve(value);
    return { packages: JSON.parse(readFileSync(file, 'utf8')), root: path.dirname(file) };
  }
  const pkg = JSON.parse(readFileSync(path.join(ROOT, 'package.json'), 'utf8'));
  return { packages: pkg.downlodrDev ?? {}, root: ROOT };
}

function readPkg(dir) {
  try {
    return JSON.parse(readFileSync(path.join(dir, 'package.json'), 'utf8'));
  } catch {
    return null;
  }
}

const log = (name, msg) => console.log(`[dev-packages] ${name}: ${msg}`);

function runGit(args, cwd) {
  return spawnSync('git', args, { cwd, stdio: 'inherit' }).status === 0;
}

// postUpdate entries are whole shell commands (e.g. "npm run build");
// shell: true is required so npm.cmd resolves on Windows.
function runShell(command, cwd) {
  return spawnSync(command, { cwd, stdio: 'inherit', shell: true }).status === 0;
}

function gitCapture(args, cwd) {
  const res = spawnSync('git', args, { cwd, encoding: 'utf8' });
  return res.status === 0 ? res.stdout.trim() : null;
}

// The package repo serves two apps from one history: the AFDA app ships from
// main as plain vX.Y.Z, Downlodr ships from downlodr-ipc as vX.Y.Z-downlodr.
// Both lines share package.json's version field, so it cannot tell them apart
// (main's v1.9.0 and downlodr-ipc's v1.9.0-downlodr both read "1.9.0"), and the
// downlodr line can run ahead of main, leaving its version behind its own tag.
// The tag at HEAD is therefore the only reliable identity.
const tagFor = (spec) => `v${spec.version}-downlodr`;

// Returns the tags pointing at HEAD, or null if dir is not a git repository.
// --points-at rather than `describe --exact-match` so a commit carrying both
// vX.Y.Z and vX.Y.Z-downlodr still resolves to the downlodr one.
function tagsAtHead(dir) {
  const out = gitCapture(['tag', '--points-at', 'HEAD'], dir);
  return out === null ? null : out.split('\n').filter(Boolean);
}

// Human-readable "what am I on" for log messages.
function describeHead(dir) {
  const tags = tagsAtHead(dir);
  if (tags === null) return 'unknown';
  const downlodrTag = tags.find((t) => t.endsWith('-downlodr'));
  if (downlodrTag) return downlodrTag;
  if (tags.length > 0) return tags[0];
  return gitCapture(['rev-parse', '--short', 'HEAD'], dir) ?? 'unknown';
}

function checkoutAndFinish(name, spec, dir) {
  const tag = tagFor(spec);
  // Verify the tag resolves first — otherwise git checkout treats the name
  // as a path and fails with a confusing "--detach does not take a path" error.
  if (gitCapture(['rev-parse', '--verify', '--quiet', `refs/tags/${tag}`], dir) === null) {
    log(name, `ERROR: tag ${tag} not found — create it in the package repo and push it (git tag ${tag} && git push --tags)`);
    return false;
  }
  if (!runGit(['checkout', '--detach', tag], dir)) {
    log(name, `ERROR: could not check out tag ${tag} — was it pushed to the remote?`);
    return false;
  }
  const pkg = readPkg(dir);
  if (!pkg || pkg.name !== name) {
    log(name, `WARNING: tag ${tag} contains package "${pkg?.name ?? '?'}", expected "${name}" — the tag may be mis-tagged`);
  }
  // pkg.version is deliberately not compared: it tracks the version line shared
  // with the AFDA app and legitimately trails this tag. Confirm the checkout
  // landed on the tag instead — that is what identifies the release.
  if (!(tagsAtHead(dir) ?? []).includes(tag)) {
    log(name, `ERROR: checkout did not land on ${tag} — HEAD is at ${describeHead(dir)}`);
    return false;
  }
  for (const command of spec.postUpdate ?? []) {
    log(name, `running "${command}"`);
    if (!runShell(command, dir)) {
      log(name, `ERROR: "${command}" failed — fix the underlying issue, then re-run it manually in ${dir} (or delete that folder and run "yarn packages:setup")`);
      return false;
    }
  }
  log(name, `ready at ${tag}`);
  return true;
}

function setup(cfg) {
  let failed = false;
  for (const [name, spec] of Object.entries(cfg.packages)) {
    const dir = path.resolve(cfg.root, spec.path);
    if (existsSync(dir)) {
      log(name, 'already present — use "yarn packages:update" to update it');
      continue;
    }
    log(name, `cloning ${spec.repo}`);
    if (!runGit(['clone', spec.repo, dir], cfg.root)) {
      log(name, `ERROR: clone failed — make sure you have access to ${spec.repo}`);
      failed = true;
      continue;
    }
    if (!checkoutAndFinish(name, spec, dir)) failed = true;
  }
  return failed ? 1 : 0;
}

function update(cfg) {
  let failed = false;
  for (const [name, spec] of Object.entries(cfg.packages)) {
    const dir = path.resolve(cfg.root, spec.path);
    const pkg = readPkg(dir);
    if (!pkg) {
      log(name, 'not installed — run "yarn packages:setup"');
      failed = true;
      continue;
    }
    const dirty = gitCapture(['status', '--porcelain'], dir);
    if (dirty === null) {
      log(name, 'ERROR: not a git repository — delete the folder and run "yarn packages:setup"');
      failed = true;
      continue;
    }
    if ((tagsAtHead(dir) ?? []).includes(tagFor(spec))) {
      log(name, `already at ${tagFor(spec)}`);
      continue;
    }
    if (dirty !== '') {
      log(name, 'has uncommitted changes — skipped; commit or stash them, then re-run "yarn packages:update"');
      failed = true;
      continue;
    }
    if (!runGit(['fetch', '--tags', '--force', 'origin'], dir)) {
      log(name, `ERROR: fetch failed — make sure you have access to ${spec.repo}`);
      failed = true;
      continue;
    }
    if (!checkoutAndFinish(name, spec, dir)) failed = true;
  }
  return failed ? 1 : 0;
}

function check(cfg) {
  let notices = 0;
  for (const [name, spec] of Object.entries(cfg.packages)) {
    const dir = path.resolve(cfg.root, spec.path);
    const pkg = readPkg(dir);
    if (!pkg) {
      log(name, 'not installed — run "yarn packages:setup"');
      notices++;
      continue;
    }
    const tags = tagsAtHead(dir);
    if (tags === null) {
      log(name, 'not a git repository — delete the folder and run "yarn packages:setup"');
      notices++;
    } else if (!tags.includes(tagFor(spec))) {
      log(name, `${describeHead(dir)} -> ${tagFor(spec)} available — run "yarn packages:update"`);
      notices++;
    }
  }
  if (notices === 0) console.log('[dev-packages] dev packages up to date');
  return 0; // check is a signal, never a gate — must not block yarn start
}

const commands = { check, setup, update };

const cmd = commands[process.argv[2]];
if (!cmd) {
  console.error('usage: node scripts/dev-packages.mjs <check|setup|update> [--config <file>]');
  process.exit(2);
}
process.exit(cmd(loadConfig()));
