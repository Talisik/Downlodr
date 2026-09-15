/** Hostname without a leading "www.", or '' for an unparseable URL. */
export function extractFqdn(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return '';
  }
}
