import { describe, expect, it } from 'vitest';
import { matchesDownloadSearch } from './matchesDownloadSearch';

const download = {
  name: 'dQw4w9WgXcQ_original_title',
  displayName: 'Never Gonna Give You Up',
  extractorKey: 'Youtube',
  status: 'finished',
  tags: ['music'],
  category: ['80s'],
};

describe('matchesDownloadSearch', () => {
  it('matches the name shown in the list', () => {
    expect(matchesDownloadSearch(download, 'never gonna give you up')).toBe(
      true,
    );
  });

  it('still matches the original title', () => {
    expect(matchesDownloadSearch(download, 'original_title')).toBe(true);
  });

  it.each(['youtube', 'finish', 'MUSIC', '80s'])(
    'matches source, status, tags and categories (%s)',
    (query) => {
      expect(matchesDownloadSearch(download, query)).toBe(true);
    },
  );

  it('ignores surrounding whitespace in the query', () => {
    expect(matchesDownloadSearch(download, '  gonna  ')).toBe(true);
  });

  it('does not match unrelated text', () => {
    expect(matchesDownloadSearch(download, 'rickroll')).toBe(false);
  });

  it('copes with a download that has no display name', () => {
    expect(
      matchesDownloadSearch({ ...download, displayName: undefined }, 'gonna'),
    ).toBe(false);
  });
});
