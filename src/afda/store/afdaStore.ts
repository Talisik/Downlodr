import { create } from 'zustand';
import {
  ArticleModel,
  ArticleErrorModel,
  fetchArticle,
  isArticleModel,
} from '@/afda/backend/dummy/dummyArticleService';
import { useArticleDownloadStore } from '@/afda/store/articleDownloadStore';

export type FetchState = 'idle' | 'loading' | 'success' | 'error';

interface AfdaStore {
  isOpen: boolean;
  articleUrl: string;
  fetchState: FetchState;
  articleData: ArticleModel | null;
  articleError: ArticleErrorModel | null;
  fetchAndOpen: (url: string) => Promise<void>;
  close: () => void;
}

export const useAfdaStore = create<AfdaStore>((set) => ({
  isOpen: false,
  articleUrl: '',
  fetchState: 'idle',
  articleData: null,
  articleError: null,

  fetchAndOpen: async (url: string) => {
    // A finished download already has the exact article model (images
    // included) that was used to build the file — reuse it instead of
    // re-parsing the URL live, which can return different/fewer images
    // (e.g. a static-only re-parse missing a dynamic site's lazy images).
    const existing = useArticleDownloadStore
      .getState()
      .articleDownloads.find(
        (d) => d.url === url && d.status === 'finished' && d.articleData,
      );

    if (existing?.articleData) {
      set({
        isOpen: true,
        articleUrl: url,
        fetchState: 'success',
        articleData: existing.articleData,
        articleError: null,
      });
      return;
    }

    set({
      isOpen: true,
      articleUrl: url,
      fetchState: 'loading',
      articleData: null,
      articleError: null,
    });

    const result = await fetchArticle(url);

    if (isArticleModel(result)) {
      set({ fetchState: 'success', articleData: result });
    } else {
      set({ fetchState: 'error', articleError: result });
    }
  },

  close: () =>
    set({
      isOpen: false,
      articleUrl: '',
      fetchState: 'idle',
      articleData: null,
      articleError: null,
    }),
}));
