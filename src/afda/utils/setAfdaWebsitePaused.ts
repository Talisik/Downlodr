import type { WebsiteListItem } from '@/afda/store/afdaWebsitesStore';

/**
 * Canonical pause/resume for an AFDA website: social sources are scheduled
 * per-source, regular websites per-section. Errors are logged, never thrown,
 * so bulk callers can fan out without one failure aborting the rest.
 */
export async function setAfdaWebsitePaused(
  website: WebsiteListItem,
  paused: boolean,
  updateWebsite: (website: WebsiteListItem) => void,
): Promise<void> {
  const bridge =
    typeof window !== 'undefined' ? (window as any).afdaBridge : undefined;
  if (!bridge) return;

  try {
    if (website.kind === 'social' && website.socialId != null) {
      if (paused) {
        await bridge.social.schedule.pause({ id: website.socialId });
      } else {
        await bridge.social.schedule.resume({ id: website.socialId });
      }
      // No hydrated Website to fetch for social sources.
      updateWebsite({ ...website, status: paused ? 'paused' : 'active' });
      return;
    }

    await Promise.allSettled(
      website.sections.map((s) =>
        paused
          ? bridge.schedule.pause({ section_id: parseInt(s.id) })
          : bridge.schedule.resume({ section_id: parseInt(s.id) }),
      ),
    );
    const result = await bridge.websites.update({
      id: parseInt(website.id),
      patch: { status: paused ? 'paused' : 'active' },
    });
    if (result?.website) updateWebsite(result.website);
  } catch (err) {
    console.error('[afda] website pause/resume failed:', err);
  }
}
