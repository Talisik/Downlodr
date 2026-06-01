#!/bin/bash

# Download static FFmpeg binaries for macOS (targets FFmpeg 8.0+).
# These are dependency-free static builds that can be bundled with the app.
#
# Resilient by design: if the download fails (e.g. network/CI hiccup), the
# previously committed binaries are restored and the script exits 0 so the
# core build still succeeds with whatever FFmpeg is already in binaries/.

set -u

# evermeet.cx "getrelease" always serves the latest stable FFmpeg (currently 8.x).
FFMPEG_URL="https://evermeet.cx/ffmpeg/getrelease/ffmpeg/zip"

echo "📦 Downloading static FFmpeg binaries for macOS (target 8.0+)..."

mkdir -p binaries

# Backup existing (committed) binaries so we can fall back on failure.
[ -f "binaries/ffmpeg-arm64" ] && cp binaries/ffmpeg-arm64 binaries/ffmpeg-arm64.backup
[ -f "binaries/ffmpeg-x64" ] && cp binaries/ffmpeg-x64 binaries/ffmpeg-x64.backup

restore_backup() {
  echo "⚠️  Falling back to existing committed FFmpeg binaries."
  [ -f "binaries/ffmpeg-arm64.backup" ] && mv -f binaries/ffmpeg-arm64.backup binaries/ffmpeg-arm64
  [ -f "binaries/ffmpeg-x64.backup" ] && mv -f binaries/ffmpeg-x64.backup binaries/ffmpeg-x64
  chmod +x binaries/ffmpeg-arm64 binaries/ffmpeg-x64 2>/dev/null || true
  exit 0
}

echo ""
echo "Downloading FFmpeg for Apple Silicon (arm64) from evermeet.cx..."
if ! curl -fL "$FFMPEG_URL" -o /tmp/ffmpeg-arm64.zip; then
  echo "❌ Download failed."
  restore_backup
fi

if ! unzip -o -q /tmp/ffmpeg-arm64.zip -d /tmp/ffmpeg-extract; then
  echo "❌ Unzip failed."
  rm -f /tmp/ffmpeg-arm64.zip
  restore_backup
fi

# evermeet zips contain a bare `ffmpeg` binary.
if [ ! -f /tmp/ffmpeg-extract/ffmpeg ]; then
  echo "❌ Extracted archive did not contain an ffmpeg binary."
  rm -rf /tmp/ffmpeg-arm64.zip /tmp/ffmpeg-extract
  restore_backup
fi

mv -f /tmp/ffmpeg-extract/ffmpeg binaries/ffmpeg-arm64
rm -rf /tmp/ffmpeg-arm64.zip /tmp/ffmpeg-extract

# evermeet.cx provides arm64 static builds; Intel Macs run it via Rosetta 2.
echo ""
echo "For Intel (x64): reusing the arm64 static build (runs under Rosetta 2)."
cp -f binaries/ffmpeg-arm64 binaries/ffmpeg-x64

chmod +x binaries/ffmpeg-arm64 binaries/ffmpeg-x64

# Verify version; warn (non-fatal) if older than 8.0.
echo ""
echo "Verifying FFmpeg..."
VERSION_LINE=$(./binaries/ffmpeg-arm64 -version 2>/dev/null | head -1 || true)
echo "  $VERSION_LINE"
MAJOR=$(echo "$VERSION_LINE" | sed -nE 's/.*ffmpeg version ([0-9]+).*/\1/p')
if [ -n "$MAJOR" ] && [ "$MAJOR" -lt 8 ]; then
  echo "⚠️  Downloaded FFmpeg is older than 8.0 — transcription (Whisper) may be limited."
fi

# Clean up backups on success.
rm -f binaries/ffmpeg-arm64.backup binaries/ffmpeg-x64.backup

echo ""
echo "File sizes:"
ls -lh binaries/ffmpeg-* 2>/dev/null

echo ""
echo "✅ Static FFmpeg binaries ready."
