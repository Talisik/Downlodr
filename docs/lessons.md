# Lessons Learned

## Batch Transcript Toolbar Implementation

[2026-04-12] Batch transcript toolbar:
- selectedDownloads store holds minimal data; full transcript fields (transcriptLocation, transcriptionStatus, etc.) must be read from finishedDownloads by id
- isTranscriptMissing helper: name inner variables clearly to avoid shadowing outer useLocation() result
- transcriptActions should be hoisted outside for...of loops — reconstructing it per iteration is wasteful
- redownloadTranscript exported as unbound static — call directly (not via .call(null,...)) for consistency with TranscrptButton.tsx
