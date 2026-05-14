import { useAfdaStore } from '@/afda/store/afdaStore';
import React from 'react';
import { IoPersonCircleSharp } from 'react-icons/io5';

interface ArticleSidePanelProps {
  isOpen: boolean;
  onClose: () => void;
}

const ArticleSidePanel: React.FC<ArticleSidePanelProps> = ({
  isOpen,
  onClose,
}) => {
  const fetchState = useAfdaStore((state) => state.fetchState);
  const articleData = useAfdaStore((state) => state.articleData);
  const articleError = useAfdaStore((state) => state.articleError);
  const close = useAfdaStore((state) => state.close);

  const handleClose = () => {
    close();
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div
      className="rounded-md flex-shrink-0 bg-white dark:bg-darkMode shadow-lg flex flex-col border-l-2 border-[#F3F3F3] dark:border-darkModeCompliment"
      style={{ width: '300px' }}
    >
      {/* Header */}
      <div className="bg-titleBar dark:bg-darkModeDropdown px-2 py-1 pt-[11px] flex items-center justify-between">
        <div className="flex items-center flex-1 min-w-0">
          <span className="text-black dark:text-white font-semibold text-md leading-6 truncate">
            {fetchState === 'success' && articleData?.article_title
              ? articleData.article_title
              : 'Article Installer'}
          </span>
        </div>
        <button
          onClick={handleClose}
          className="text-black dark:text-white hover:text-red-500 ml-2 p-1 flex-shrink-0"
        >
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            <path d="m18 6-12 12M6 6l12 12" />
          </svg>
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto flex flex-col gap-4">
        {/* Loading */}
        {fetchState === 'loading' && (
          <div className="flex items-center justify-center py-8">
            <p className="text-xs text-gray-400 dark:text-gray-500">
              Parsing article…
            </p>
          </div>
        )}

        {/* Success: article preview */}
        {fetchState === 'success' && articleData && (
          <div className="flex flex-col gap-3 overflow-hidden">
            {/* Thumbnail */}
            <div className="flex flex-col gap-2 px-3 pb-3">
              {/* Title */}
              <div className="flex flex-row justify-between items-center gap-2">
                <div className="flex items-center w-30 h-30">
                  <img
                    src={articleData.article_images[0].url}
                    alt={articleData.article_images[0].alt ?? ''}
                    className="w-24 h-24 object-cover self-center mt-3 rounded-md"
                    onError={(e) => {
                      (e.currentTarget as HTMLImageElement).style.display =
                        'none';
                    }}
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <p className="text-md font-semibold text-gray-800 dark:text-gray-100 leading-snug">
                    {articleData.article_title ?? '—'}
                  </p>

                  <div className="flex flex-col gap-0.5">
                    {articleData.article_publish_date && (
                      <p className="text-xs text-gray-400 dark:text-gray-500">
                        Published{' '}
                        {articleData.article_publish_date.toLocaleDateString(
                          undefined,
                          {
                            year: 'numeric',
                            month: 'short',
                            day: 'numeric',
                          },
                        )}
                        {!articleData.is_published_date_correct && (
                          <span className="ml-1 text-yellow-500">
                            (date uncertain)
                          </span>
                        )}
                      </p>
                    )}
                  </div>

                  {/* Authors + date */}
                  <div className="flex flex-row gap-0.5 items-center">
                    <IoPersonCircleSharp
                      className="flex item-center"
                      size={18}
                    />
                    {articleData.article_authors.length > 0 && (
                      <p className="text-[11px] text-gray-500 dark:text-gray-400">
                        {articleData.article_authors
                          .map((a) => a.name)
                          .join(', ')}
                      </p>
                    )}
                  </div>
                </div>
              </div>

              {/* Sections */}
              {articleData.article_sections.length > 0 && (
                <div className="flex flex-col gap-2 mt-1">
                  {articleData.article_sections.map((section, i) => (
                    <div key={i} className="flex flex-col gap-0.5">
                      {section.heading && (
                        <p className="text-xs font-medium text-gray-700 dark:text-gray-300">
                          {section.heading}
                        </p>
                      )}
                      <p className="text-xs text-gray-500 dark:text-gray-400 leading-relaxed line-clamp-3">
                        {section.content}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Error state */}
        {fetchState === 'error' && articleError && (
          <div className="flex flex-col gap-1 border border-red-200 dark:border-red-900 rounded p-3 bg-red-50 dark:bg-red-950">
            <p className="text-xs font-semibold text-red-600 dark:text-red-400">
              Parse error
            </p>
            <p className="text-xs text-red-500 dark:text-red-300">
              {articleError.article_error_status ?? 'Unknown error'}
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

export default ArticleSidePanel;
