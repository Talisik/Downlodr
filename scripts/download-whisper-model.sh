#!/bin/bash

# Fetches the Whisper model used by FFmpeg's whisper audio filter for
# closed-caption transcription (see src/core-app/ipc/main/transcriptHandler.ts
# and src/downlodr/utils/transcription/ffmpegWhisperTranscriber.ts).
#
# Unlike the committed ffmpeg/ffprobe static binaries, ggml-small.bin is not
# tracked in git (see .gitignore: *.bin) because of its size, so it must be
# fetched at build time on every platform, including macOS. This script was
# missing entirely for macOS builds — forge.config.ts's darwin extraResource
# list never bundled ggml-small.bin, and no build step ever fetched it —
# so every packaged macOS build shipped with no Whisper model at all and
# transcription unconditionally failed with "Whisper model not found".
#
# URL and sha256 are read from package.json's downlodrBinaries.whisper-model
# entry so there is a single source of truth for the pinned model version.
#
# Idempotent: skips the download if a file matching the pinned sha256
# already exists at the destination. Hard-fails (non-zero exit) on any
# download/verification problem — unlike the ffmpeg refresh script, there
# is no previously committed fallback to restore, so a silent failure here
# would just reproduce this exact bug again.

set -euo pipefail

MODEL_FILE="ggml-small.bin"
DEST_PATH="./${MODEL_FILE}"

MODEL_URL=$(node -p "require('./package.json').downlodrBinaries['whisper-model'].url")
EXPECTED_SHA256=$(node -p "require('./package.json').downlodrBinaries['whisper-model'].sha256")

if [ -z "$MODEL_URL" ] || [ "$MODEL_URL" = "undefined" ]; then
  echo "❌ Could not read downlodrBinaries.whisper-model.url from package.json"
  exit 1
fi
if [ -z "$EXPECTED_SHA256" ] || [ "$EXPECTED_SHA256" = "undefined" ]; then
  echo "❌ Could not read downlodrBinaries.whisper-model.sha256 from package.json"
  exit 1
fi

sha256_of() {
  shasum -a 256 "$1" | awk '{print $1}'
}

echo "🎙️  Checking Whisper model (${MODEL_FILE})..."

if [ -f "$DEST_PATH" ]; then
  existing_sha256=$(sha256_of "$DEST_PATH")
  if [ "$existing_sha256" = "$EXPECTED_SHA256" ]; then
    echo "✅ ${MODEL_FILE} already present and verified — skipping download."
    exit 0
  fi
  echo "⚠️  Existing ${MODEL_FILE} does not match the pinned checksum — re-downloading."
  rm -f "$DEST_PATH"
fi

echo "📥 Downloading ${MODEL_FILE} from ${MODEL_URL}..."
TMP_PATH="$(mktemp -t ggml-small-download).bin"
if ! curl -fL --retry 3 "$MODEL_URL" -o "$TMP_PATH"; then
  echo "❌ Download failed."
  rm -f "$TMP_PATH"
  exit 1
fi

downloaded_sha256=$(sha256_of "$TMP_PATH")
if [ "$downloaded_sha256" != "$EXPECTED_SHA256" ]; then
  echo "❌ Checksum mismatch for ${MODEL_FILE}."
  echo "   expected: ${EXPECTED_SHA256}"
  echo "   got:      ${downloaded_sha256}"
  rm -f "$TMP_PATH"
  exit 1
fi

mv -f "$TMP_PATH" "$DEST_PATH"
echo "✅ ${MODEL_FILE} downloaded and verified ($(du -h "$DEST_PATH" | cut -f1))."
