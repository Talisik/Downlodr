#!/bin/bash

# Refresh the static x64 FFmpeg/ffprobe binaries for macOS (targets 8.0+).
#
# evermeet.cx's "getrelease" endpoint only serves x86_64 static builds
# (verified: `file` on the downloaded binary reports "Mach-O 64-bit
# executable x86_64", not arm64) — despite older naming in this repo that
# implied otherwise. binaries/ffmpeg-arm64 is a genuinely native arm64
# static build from a separate source and is committed to the repo; this
# script does NOT touch it, since overwriting it with a mislabeled x64
# binary would silently downgrade every Apple Silicon build to running
# ffmpeg under Rosetta 2. It only refreshes the *-x64 binaries, which are
# correctly sourced from evermeet. Apple Silicon machines fall back to the
# x64 build (via Rosetta 2) for any tool with no native arm64 build
# available (see ensureFfmpegOnPath() in ytdlpHandler.ts) — notably
# ffprobe, for which no arm64 static build is committed to this repo.
#
# Resilient by design: if a download fails (e.g. network/CI hiccup), the
# previously committed x64 binary for that tool is restored and the script
# exits 0 so the core build still succeeds with whatever is already in
# binaries/. FFmpeg and ffprobe are independent — a failure fetching one
# does not block the other.

set -u

FFMPEG_URL="https://evermeet.cx/ffmpeg/getrelease/ffmpeg/zip"
FFPROBE_URL="https://evermeet.cx/ffmpeg/getrelease/ffprobe/zip"

mkdir -p binaries

# fetch_x64_tool <tool-name> <url>
# Downloads a single evermeet.cx static (x86_64) binary and installs it as
# binaries/<tool>-x64. Backs up and restores the previously committed
# binary on any failure so a bad fetch never leaves binaries/ in a
# half-updated state.
fetch_x64_tool() {
  local tool="$1"
  local url="$2"
  local x64_path="binaries/${tool}-x64"
  local zip_path="/tmp/${tool}-x64.zip"
  local extract_dir="/tmp/${tool}-x64-extract"

  echo ""
  echo "📦 Downloading static ${tool} (x86_64) for macOS (target 8.0+)..."

  [ -f "$x64_path" ] && cp "$x64_path" "${x64_path}.backup"

  restore_backup() {
    echo "⚠️  Falling back to existing committed ${tool}-x64 binary."
    [ -f "${x64_path}.backup" ] && mv -f "${x64_path}.backup" "$x64_path"
    chmod +x "$x64_path" 2>/dev/null || true
  }

  if ! curl -fL "$url" -o "$zip_path"; then
    echo "❌ Download failed."
    restore_backup
    return 0
  fi

  if ! unzip -o -q "$zip_path" -d "$extract_dir"; then
    echo "❌ Unzip failed."
    rm -f "$zip_path"
    restore_backup
    return 0
  fi

  # evermeet zips contain a bare binary named after the tool.
  if [ ! -f "$extract_dir/$tool" ]; then
    echo "❌ Extracted archive did not contain a ${tool} binary."
    rm -rf "$zip_path" "$extract_dir"
    restore_backup
    return 0
  fi

  local arch
  arch=$(file -b "$extract_dir/$tool" 2>/dev/null || true)
  if [[ "$arch" != *x86_64* ]]; then
    echo "❌ Downloaded ${tool} is not x86_64 as expected (got: ${arch}) — refusing to install it under the -x64 name."
    rm -rf "$zip_path" "$extract_dir"
    restore_backup
    return 0
  fi

  mv -f "$extract_dir/$tool" "$x64_path"
  rm -rf "$zip_path" "$extract_dir"
  chmod +x "$x64_path"

  echo "Verifying ${tool}-x64..."
  local version_line
  version_line=$("./$x64_path" -version 2>/dev/null | head -1 || true)
  echo "  $version_line"
  local major
  major=$(echo "$version_line" | sed -nE "s/.*${tool} version ([0-9]+).*/\\1/p")
  if [ -n "$major" ] && [ "$major" -lt 8 ]; then
    echo "⚠️  Downloaded ${tool} is older than 8.0 — some features may be limited."
  fi

  rm -f "${x64_path}.backup"
}

fetch_x64_tool ffmpeg "$FFMPEG_URL"
fetch_x64_tool ffprobe "$FFPROBE_URL"

echo ""
echo "File sizes:"
ls -lh binaries/ffmpeg-* binaries/ffprobe-* 2>/dev/null

echo ""
echo "✅ Static x64 FFmpeg/ffprobe binaries refreshed. arm64 ffmpeg is untouched (committed native build); arm64 ffprobe has no committed native build and falls back to ffprobe-x64 under Rosetta 2 at runtime."
