/**
 * Formats a duration in seconds to a human-readable string (e.g. "1:23" or "1:23:45")
 */
export const formatDuration = (secs: number): string =>
  Math.floor(secs / 3600) > 0
    ? `${Math.floor(secs / 3600)}:${String(
        Math.floor((secs % 3600) / 60),
      ).padStart(2, '0')}:${String(Math.floor(secs % 60)).padStart(2, '0')}`
    : `${Math.floor(secs / 60)}:${String(Math.floor(secs % 60)).padStart(
        2,
        '0',
      )}`;
