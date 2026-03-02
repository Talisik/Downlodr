# GitHub Actions Workflow Reference

This document captures the current GitHub Actions workflow setup for Downlodr, including trigger behavior, branch requirements, and operational commands.

## Current Workflows

- `Build and Release macOS` (`.github/workflows/build-release-macos.yml`)
- `macOS Production Build` (`.github/workflows/macos-build.yml`)
- `Build and Publish Docker Images` (`.github/workflows/docker-publish.yml`)
- `Build Linux Packages` (`.github/workflows/build-linux.yml`)
- `Weekly Build` (`.github/workflows/weekly-build.yml`)

## Key Changes Applied

### 1) Added macOS Production Build Workflow

- Added: `.github/workflows/macos-build.yml`
- Trigger: `workflow_dispatch`
- Input: `target_arch` (`arm64`, `intel`, `both`)
- Uses Apple signing/notarization secrets and uploads generated artifacts.

### 2) Updated Artifact Actions to v4

- Updated in `.github/workflows/docker-publish.yml`:
  - `actions/upload-artifact@v3` -> `actions/upload-artifact@v4`
  - `actions/download-artifact@v3` -> `actions/download-artifact@v4`

### 3) Prevented Docker Workflow From Catching All `v*` Tags

- Updated `docker-publish.yml` tag trigger:
  - from: `v*`
  - to: `docker-v*`

This avoids accidental Docker workflow runs when creating app release tags such as `v1.7.13-mac-stable`.

### 4) Workflow Availability Requirement (Important)

GitHub CLI/API can only dispatch workflows that exist on the repository default branch (`main`).

- `macos-build.yml` was added to `main` so this command works:

```bash
gh workflow run macos-build.yml --ref feature/macos-build-stable -f target_arch=both
```

## Required Secrets for macOS Production Build

The `macos-build.yml` workflow expects these repository secrets:

- `APPLE_ID`
- `APPLE_IDENTITY`
- `APPLE_INSTALLER_IDENTITY`
- `APPLE_PASSWORD` (mapped in workflow to `APPLE_APP_SPECIFIC_PASSWORD`)
- `APPLE_TEAM_ID`
- `KEYCHAIN_PASSWORD`
- `MACOS_CERTIFICATE` (base64-encoded `.p12`)
- `MACOS_CERTIFICATE_PWD`

## Standard Run Commands

### Run macOS Production Build

```bash
gh workflow run macos-build.yml --ref feature/macos-build-stable -f target_arch=both
```

Then monitor:

```bash
gh run list --workflow macos-build.yml --limit 5
gh run watch
```

### Run only one architecture

```bash
gh workflow run macos-build.yml --ref feature/macos-build-stable -f target_arch=arm64
gh workflow run macos-build.yml --ref feature/macos-build-stable -f target_arch=intel
```

## Tagging Strategy

- App/macOS release tags: `v*` (example: `v1.7.13-mac-stable`)
- Docker release tags: `docker-v*` (example: `docker-v1.7.13`)

This keeps release pipelines separated.

## Known Troubleshooting

### Error: workflow not found on default branch

Example:

`HTTP 404: workflow macos-build.yml not found on the default branch`

Cause:
- Workflow file is not present on `main`.

Fix:
- Add/cherry-pick the workflow file into `main` and push.

### No "Run workflow" button in UI

Cause:
- Workflow may not support `workflow_dispatch` on default-branch definition
- Or branch/run filters hide results.

Fix:
- Open workflow URL directly:
  - `https://github.com/Talisik/Downlodr/actions/workflows/macos-build.yml`
- Use CLI dispatch command above.

## Operational Notes

- Keep binary-local testing changes (like `yt-dlp_macos`) uncommitted unless explicitly intended for release.
- When committing workflow changes, commit only workflow files to avoid accidental binary pushes.
