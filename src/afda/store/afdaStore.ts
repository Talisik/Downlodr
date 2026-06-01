import { create } from 'zustand';
import {
  ArticleModel,
  ArticleErrorModel,
  fetchArticle,
  isArticleModel,
} from '@/afda/backend/dummy/dummyArticleService';

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
    set({ isOpen: true, articleUrl: url, fetchState: 'loading', articleData: null, articleError: null });

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
