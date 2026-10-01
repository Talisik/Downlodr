import { beforeEach, describe, expect, it } from 'vitest';
import { renderHook } from '@testing-library/react';
import {
  useAfdaWebsitesStore,
  type WebsiteListItem,
} from './afdaWebsitesStore';
import {
  useAfdaWebsiteDisplay,
  useAfdaWebsiteMetaCache,
} from './afdaWebsiteMetaCache';

const article = {
  id: '7',
  name: 'Example News',
  url: 'https://example.com',
  kind: 'website',
} as WebsiteListItem;
const social = {
  id: 'social-3',
  name: 'Foo',
  url: 'https://x.com/foo',
  kind: 'social',
} as WebsiteListItem;

beforeEach(() => {
  useAfdaWebsitesStore.setState({ websites: [] });
  useAfdaWebsiteMetaCache.setState({ meta: {} });
});

describe('afdaWebsiteMetaCache', () => {
  it('caches display info whenever the live store is hydrated', () => {
    useAfdaWebsitesStore.getState().hydrate([article]);
    useAfdaWebsitesStore.getState().hydrateSocial([social]);

    expect(useAfdaWebsiteMetaCache.getState().meta).toEqual({
      '7': { name: 'Example News', url: 'https://example.com', kind: 'website' },
      'social-3': { name: 'Foo', url: 'https://x.com/foo', kind: 'social' },
    });
  });

  it('keeps entries when websites leave the live store', () => {
    useAfdaWebsitesStore.getState().hydrate([article]);
    useAfdaWebsitesStore.getState().removeWebsite('7');

    expect(useAfdaWebsiteMetaCache.getState().meta['7']?.name).toBe(
      'Example News',
    );
  });

  it('picks up renames', () => {
    useAfdaWebsitesStore.getState().hydrate([article]);
    useAfdaWebsitesStore
      .getState()
      .updateWebsite({ ...article, name: 'Renamed' } as WebsiteListItem);

    expect(useAfdaWebsiteMetaCache.getState().meta['7']?.name).toBe('Renamed');
  });
});

describe('useAfdaWebsiteDisplay', () => {
  it('falls back to the cache while the live store is empty (worker not ready)', () => {
    useAfdaWebsiteMetaCache.setState({
      meta: { 'social-3': { name: 'Foo', url: 'https://x.com/foo', kind: 'social' } },
    });

    const { result } = renderHook(() => useAfdaWebsiteDisplay('social-3'));

    expect(result.current).toEqual({
      name: 'Foo',
      url: 'https://x.com/foo',
      kind: 'social',
    });
  });

  it('prefers the live entry over a stale cached one', () => {
    useAfdaWebsiteMetaCache.setState({
      meta: { '7': { name: 'Old', url: 'https://old.example', kind: 'website' } },
    });
    useAfdaWebsitesStore.setState({ websites: [article] });

    const { result } = renderHook(() => useAfdaWebsiteDisplay('7'));

    expect(result.current?.name).toBe('Example News');
  });

  it('returns undefined for a website never seen', () => {
    const { result } = renderHook(() => useAfdaWebsiteDisplay('99'));
    expect(result.current).toBeUndefined();
  });
});
