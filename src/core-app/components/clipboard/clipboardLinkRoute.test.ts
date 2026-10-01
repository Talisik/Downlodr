import { describe, expect, it } from 'vitest';
import { clipboardLinkRoute } from './clipboardLinkRoute';

describe('clipboardLinkRoute', () => {
  it.each([
    'https://medium.com/@example-author/an-example-post-0123456789ab',
    'https://writer.substack.com/p/some-post',
    'https://www.inquirer.net/some/story',
  ])('sends article links to the article list: %s', (url) => {
    expect(clipboardLinkRoute(url)).toBe('article');
  });

  it('keeps YouTube channel pages out of the queue', () => {
    expect(clipboardLinkRoute('https://www.youtube.com/@ExampleChannel')).toBe(
      'channel',
    );
  });

  it.each([
    'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
    'https://vimeo.com/1084537',
  ])('queues everything else as a video: %s', (url) => {
    expect(clipboardLinkRoute(url)).toBe('video');
  });
});
