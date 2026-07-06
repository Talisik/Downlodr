import type { ArticleModel, ArticleSection, ArticleMedia } from '@/afda/backend/schema/articleSchema';
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
export function normalizeArticleRow(row: Record<string, unknown>): ArticleModel {
  const parsedSections: ArticleSection[] = (() => {
    try {
      const raw = row.article_sections;
      if (!raw) return [];
      const arr = typeof raw === 'string' ? JSON.parse(raw) : raw;
      if (!Array.isArray(arr)) return [];
      return arr.map((s: any) => ({ heading: s?.heading ?? null, content: s?.content ?? '' }));
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
      return arr.map((img: any) => ({ url: img?.url ?? '', alt: img?.alt ?? null }));
    } catch {
      return [];
    }
  })();

  return {
    article_title: (row.title as string | null) ?? null,
    article_publish_date: row.published_at ? new Date(row.published_at as string) : null,
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
  ${metaParts.length > 0 ? `<div class="meta">${metaParts.join(' · ')}</div>` : ''}
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

const fetchAsArrayBuffer = async (
  url: string,
): Promise<{ buffer: ArrayBuffer; imageType: SupportedImageType } | null> => {
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const contentType = res.headers.get('content-type') ?? '';
    let imageType: SupportedImageType;
    if (contentType.includes('png')) imageType = 'png';
    else if (contentType.includes('gif')) imageType = 'gif';
    else if (contentType.includes('bmp')) imageType = 'bmp';
    else if (contentType.includes('webp')) return null;
    else imageType = 'jpg';
    const buffer = await res.arrayBuffer();
    return { buffer, imageType };
  } catch {
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
    metaParts.push(
      new Date(article.article_publish_date).toLocaleDateString(),
    );
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
