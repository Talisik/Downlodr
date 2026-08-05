// Section IDs currently running their initial post-subscription scrape.
// useAfdaArticleSync skips these so the handleSave listener is the only
// one adding articles during initial setup.
export const initialScrapeGuard = new Set<number>();
