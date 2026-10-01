import { describe, expect, it } from 'vitest';
import { isArticleSiteUrl } from './articleSiteDetection';

describe('isArticleSiteUrl', () => {
  it.each([
    'https://medium.com/@example-author/an-example-post-0123456789ab',
    'https://someone.medium.com/a-post-123abc',
    'https://www.substack.com/home',
    'https://writer.substack.com/p/some-post',
  ])('treats blog-platform posts as articles: %s', (url) => {
    expect(isArticleSiteUrl(url)).toBe(true);
  });

  it('still recognises the existing news sites', () => {
    expect(isArticleSiteUrl('https://www.inquirer.net/some/story')).toBe(true);
  });

  it.each([
    'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
    'https://notmedium.com/post',
    'https://medium.com.evil.example/post',
    'not a url',
  ])('does not treat %s as an article site', (url) => {
    expect(isArticleSiteUrl(url)).toBe(false);
  });
});
