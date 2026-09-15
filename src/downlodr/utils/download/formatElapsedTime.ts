// format elapsed time
export function formatElapsedTime(elapsedSeconds: number | undefined): string {
  if (!elapsedSeconds || elapsedSeconds < 60) {
    if (elapsedSeconds == 0) {
      return '< 1s';
    }
    return elapsedSeconds ? `${Math.floor(elapsedSeconds)}s` : '';
  }

  const minutes = Math.floor(elapsedSeconds / 60);
  const hours = Math.floor(minutes / 60);

  if (hours > 0) {
    return `${hours}h ${minutes % 60}m`;
  } else {
    return `${minutes}m ${Math.floor(elapsedSeconds % 60)}s`;
  }
}
