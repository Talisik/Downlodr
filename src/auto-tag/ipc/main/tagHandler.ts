// STUB — see src/auto-tag/README.md.
// Real IPC handler (registers the channels window.autoTagBridge.run() would
// call) was never committed upstream. Registers nothing; logs once so the
// gap is visible in the main-process console instead of silently missing.

let warned = false;

export function autoTagHandler(): void {
  if (!warned) {
    warned = true;
    console.warn(
      '[auto-tag] stub handler active — real module missing, see src/auto-tag/README.md',
    );
  }
}
