/**
 * Canonical delete for an AFDA website: calls the bridge then removes from the
 * local store. Errors from the bridge are logged but never block the local
 * removal so the UI stays consistent even when the backend is unavailable.
 */
export async function deleteAfdaWebsite(
  websiteId: string,
  removeWebsite: (id: string) => void,
): Promise<void> {
  const bridge =
    typeof window !== 'undefined' ? (window as any).afdaBridge : undefined;
  if (bridge) {
    try {
      await bridge.websites.delete({ id: parseInt(websiteId) });
    } catch (err) {
      console.error('[afda] website delete failed:', err);
    }
  }
  removeWebsite(websiteId);
}
