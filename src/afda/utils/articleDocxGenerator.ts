import type {
  ArticleModel,
  ArticleSection,
  ArticleMedia,
} from '@/afda/backend/schema/articleSchema';
import {
  Document,
  HeadingLevel,
  ImageRun,
  Packer,
  Paragraph,
  TextRun,
} from 'docx';
import { formatArticleSections } from './articleFormatter';

/**
 * Converts a raw ArticleRow returned by bridge.articles.get() into ArticleModel
 * for use with generateArticleDocx / generateArticleHtml.
 */
export function normalizeArticleRow(
  row: Record<string, unknown>,
): ArticleModel {
  const parsedSections: ArticleSection[] = (() => {
    try {
      const raw = row.article_sections;
      if (!raw) return [];
      const arr = typeof raw === 'string' ? JSON.parse(raw) : raw;
      if (!Array.isArray(arr)) return [];
      return arr.map((s: any) => ({
        heading: s?.heading ?? null,
        content: s?.content ?? '',
      }));
    } catch {
      return [];
    }
  })();

  const parsedImages: ArticleMedia[] = (() => {
    try {
      const raw = row.article_images;
      if (!raw) return [];
      const arr = typeof raw === 'string' ? JSON.parse(raw) : raw;
      if (!Array.isArray(arr)) return [];
      return arr.map((img: any) => ({
        url: img?.url ?? '',
        alt: img?.alt ?? null,
      }));
    } catch {
      return [];
    }
  })();

  return {
    article_title: (row.title as string | null) ?? null,
    article_publish_date: row.published_at
      ? new Date(row.published_at as string)
      : null,
    article_authors: row.author ? [{ name: String(row.author) }] : [],
    article_sections: parsedSections,
    article_content: (row.body_text as string | null) ?? null,
    article_videos: [],
    article_images: parsedImages,
    article_status: 'Done',
    article_error_status: null,
    is_published_date_correct: Boolean(row.is_published_date_correct),
    updated_by: 'Parser Microservice',
    date_updated: new Date(),
    date_parsed: new Date(),
    raw_html: null,
  };
}

/** Minimal shape of a social post (subset of social.posts.list rows). */
export interface SocialPostLike {
  url: string;
  author: string | null;
  content: string | null;
  image_url?: string | null;
  images?: string[] | null;
  published_at: string | null;
}

/**
 * Builds an ArticleModel from a social post so the existing docx/pdf pipeline
 * can export it exactly like a scraped article. Social posts already carry
 * their full text (post.content), so no refetch/parse step is needed.
 */
export function socialPostToArticleModel(post: SocialPostLike): ArticleModel {
  const text = (post.content ?? '').trim();
  const title = text
    ? text.length > 100
      ? `${text.slice(0, 100)}…`
      : text
    : post.author ?? post.url;

  const images: ArticleMedia[] = [];
  if (post.image_url) images.push({ url: post.image_url, alt: null });
  for (const url of post.images ?? []) {
    if (url && !images.some((i) => i.url === url)) {
      images.push({ url, alt: null });
    }
  }

  return {
    article_title: title,
    article_publish_date: post.published_at
      ? new Date(post.published_at)
      : null,
    article_authors: post.author ? [{ name: String(post.author) }] : [],
    article_sections: [],
    article_content: text || null,
    article_videos: [],
    article_images: images,
    article_status: 'Done',
    article_error_status: null,
    is_published_date_correct: Boolean(post.published_at),
    updated_by: 'Social Feed',
    date_updated: new Date(),
    date_parsed: new Date(),
    raw_html: null,
  };
}

/**
 * Builds an ArticleModel for a social post download row
 * (`social-post-<postId>`, subscriptionId `social-<sourceId>`) so it exports to
 * docx/pdf like an article. Re-reads the post from social.posts.list since the
 * download store only keeps a title/thumbnail, not the full post body.
 */
export async function fetchSocialPostModel(
  rowId: string,
  subscriptionId: string | undefined,
): Promise<ArticleModel> {
  const postId = parseInt(rowId.replace('social-post-', ''), 10);
  const sourceId = parseInt((subscriptionId ?? '').replace('social-', ''), 10);
  if (isNaN(postId) || isNaN(sourceId)) {
    throw new Error('Invalid social post reference');
  }

  const bridge =
    typeof window !== 'undefined'
      ? (
          window as unknown as {
            afdaBridge?: {
              social?: {
                posts: {
                  list: (p: {
                    id: number;
                    limit?: number;
                    offset?: number;
                  }) => Promise<{
                    posts?: (SocialPostLike & { id: number })[];
                  }>;
                };
              };
            };
          }
        ).afdaBridge
      : undefined;
  if (!bridge?.social?.posts?.list) throw new Error('Bridge unavailable');

  const res = await bridge.social.posts.list({
    id: sourceId,
    limit: 500,
    offset: 0,
  });
  const post = (res?.posts ?? []).find((p) => p.id === postId);
  if (!post) throw new Error('Post not found');
  return socialPostToArticleModel(post);
}

/** Generates a styled HTML string from an ArticleModel for PDF rendering. */
export function generateArticleHtml(article: ArticleModel): string {
  const title = article.article_title ?? 'Article';
  const metaParts: string[] = [];
  if (article.article_publish_date) {
    metaParts.push(new Date(article.article_publish_date).toLocaleDateString());
  }
  if (article.article_authors.length > 0) {
    metaParts.push(article.article_authors.map((a) => a.name).join(', '));
  }

  const heroUrl = article.article_images[0]?.url ?? null;

  const sections = formatArticleSections(article);
  const sectionsHtml = sections
    .map((s) => {
      const heading = s.heading ? `<h2>${s.heading}</h2>` : '';
      const paras = s.paragraphs.map((p) => `<p>${p}</p>`).join('');
      return `<div class="section">${heading}${paras}</div>`;
    })
    .join('');

  return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<style>
  body { font-family: Georgia, serif; max-width: 720px; margin: 40px auto; color: #222; line-height: 1.6; }
  h1 { font-size: 2em; margin: 0 0 0.2em 0; }
  h2 { font-size: 1.3em; font-weight: 600; margin: 0 0 1em 0; }
  .meta { color: #888; font-size: 0.9em; margin: 0 0 1.2em 0; }
  img { max-width: 100%; height: auto; margin: 1em 0; }
  p { margin: 0 0 1em 0; }
  .section { margin-bottom: 1em; }
  .section > *:last-child { margin-bottom: 0; }
</style>
</head>
<body>
  <h1>${title}</h1>
  ${
    metaParts.length > 0
      ? `<div class="meta">${metaParts.join(' · ')}</div>`
      : ''
  }
  ${heroUrl ? `<img src="${heroUrl}" alt="">` : ''}
  ${sectionsHtml}
</body>
</html>`;
}

export const sanitizeFilename = (title: string | null): string => {
  const safe = (title ?? 'article')
    .slice(0, 20)
    .replace(/[^a-zA-Z0-9]/g, '_')
    .replace(/^_+|_+$/g, '');
  return safe || 'article';
};

const sanitizeFilenameSegment = (value: string, maxLen = 60): string => {
  const safe = value
    .replace(/[\\/:*?"<>|]/g, '_')
    .replace(/\s+/g, '_')
    .slice(0, maxLen)
    .replace(/^_+|_+$/g, '');
  return safe;
};

/**
 * Fills a user-configured naming template (e.g. "{channel}_{title}_{date}",
 * from AfdaSettings' File Naming Format field) with the article's channel
 * name, title, and add date. Falls back to sanitizeFilename(title) if the
 * template is empty or resolves to nothing usable.
 */
export const buildArticleFilename = (
  template: string | null | undefined,
  parts: {
    channel: string | null | undefined;
    title: string | null | undefined;
    date: string | null | undefined;
  },
): string => {
  if (!template?.trim()) return sanitizeFilename(parts.title ?? null);

  const channel = sanitizeFilenameSegment(parts.channel || 'website');
  const title = sanitizeFilenameSegment(parts.title || 'article');
  const parsedDate = parts.date ? new Date(parts.date) : new Date();
  const date = isNaN(parsedDate.getTime())
    ? ''
    : parsedDate.toISOString().slice(0, 10);

  const filled = template
    .replace(/\{channel\}/gi, channel)
    .replace(/\{title\}/gi, title)
    .replace(/\{date\}/gi, date)
    .trim()
    .replace(/[\\/:*?"<>|]/g, '_');

  return filled || sanitizeFilename(parts.title ?? null);
};

export const fetchAsDataUrl = async (url: string): Promise<string | null> => {
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const blob = await res.blob();
    return new Promise<string | null>((resolve) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = () => resolve(null);
      reader.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
};

type SupportedImageType = 'jpg' | 'png' | 'gif' | 'bmp';

/** Re-encodes an image blob to PNG via canvas (used for formats docx can't embed directly, e.g. webp). */
const reencodeToPng = (blob: Blob): Promise<ArrayBuffer | null> =>
  new Promise((resolve) => {
    const objectUrl = URL.createObjectURL(blob);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(objectUrl);
      const canvas = document.createElement('canvas');
      canvas.width = img.naturalWidth;
      canvas.height = img.naturalHeight;
      const ctx = canvas.getContext('2d');
      if (!ctx) return resolve(null);
      ctx.drawImage(img, 0, 0);
      canvas.toBlob(async (pngBlob) => {
        if (!pngBlob) return resolve(null);
        resolve(await pngBlob.arrayBuffer());
      }, 'image/png');
    };
    img.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      resolve(null);
    };
    img.src = objectUrl;
  });

const fetchAsArrayBuffer = async (
  url: string,
): Promise<{ buffer: ArrayBuffer; imageType: SupportedImageType } | null> => {
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const contentType = res.headers.get('content-type') ?? '';
    if (contentType.includes('webp')) {
      const blob = await res.blob();
      const pngBuffer = await reencodeToPng(blob);
      return pngBuffer ? { buffer: pngBuffer, imageType: 'png' } : null;
    }
    let imageType: SupportedImageType;
    if (contentType.includes('png')) imageType = 'png';
    else if (contentType.includes('gif')) imageType = 'gif';
    else if (contentType.includes('bmp')) imageType = 'bmp';
    else imageType = 'jpg';
    const buffer = await res.arrayBuffer();
    return { buffer, imageType };
  } catch (error) {
    console.warn(
      '[articleDocxGenerator] Failed to fetch article image:',
      url,
      error,
    );
    return null;
  }
};

export const generateArticleDocx = async (
  article: ArticleModel,
): Promise<Uint8Array> => {
  const sections = formatArticleSections(article);

  const thumbnailUrl = article.article_images[0]?.url ?? null;
  const thumbnailResult = thumbnailUrl
    ? await fetchAsArrayBuffer(thumbnailUrl)
    : null;

  const metaParts: string[] = [];
  if (article.article_publish_date) {
    metaParts.push(new Date(article.article_publish_date).toLocaleDateString());
  }
  if (article.article_authors.length > 0) {
    metaParts.push(article.article_authors.map((a) => a.name).join(', '));
  }

  const children: Paragraph[] = [];

  children.push(
    new Paragraph({
      text: article.article_title ?? 'Article',
      heading: HeadingLevel.HEADING_1,
    }),
  );

  if (metaParts.length > 0) {
    children.push(
      new Paragraph({
        children: [
          new TextRun({ text: metaParts.join(' · '), color: '888888' }),
        ],
      }),
    );
  }

  if (thumbnailResult) {
    children.push(
      new Paragraph({
        children: [
          new ImageRun({
            data: thumbnailResult.buffer,
            transformation: { width: 400, height: 225 },
            type: thumbnailResult.imageType,
          }),
        ],
        spacing: { before: 240, after: 240 },
      }),
    );
  }

  // 240 twips ≈ 16px, matching the panel's gap-4 spacing between all items
  const GAP = 240;

  for (const section of sections) {
    if (section.heading) {
      children.push(
        new Paragraph({
          text: section.heading,
          heading: HeadingLevel.HEADING_2,
          spacing: { before: 0, after: GAP },
        }),
      );
    }
    for (const para of section.paragraphs) {
      children.push(
        new Paragraph({
          children: [new TextRun(para)],
          spacing: { before: 0, after: GAP },
        }),
      );
    }
  }

  const doc = new Document({ sections: [{ children }] });
  const blob = await Packer.toBlob(doc);
  const arrayBuffer = await blob.arrayBuffer();
  return new Uint8Array(arrayBuffer);
};
