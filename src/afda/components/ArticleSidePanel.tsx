import { useAfdaStore } from '@/afda/store/afdaStore';
import { formatArticleSections } from '@/afda/utils/articleFormatter';
import React from 'react';
import { IoPersonCircleSharp } from 'react-icons/io5';
import { LuCopy, LuDot } from 'react-icons/lu';
import { FaFacebook } from 'react-icons/fa';
import { FaXTwitter } from 'react-icons/fa6';

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
  const articleUrl = useAfdaStore((state) => state.articleUrl);
  const close = useAfdaStore((state) => state.close);

  const handleClose = () => {
    close();
    onClose();
  };

  const getSiteName = (url: string) => {
    try {
      const { hostname } = new URL(url);
      const parts = hostname.replace(/^www\./, '').split('.');
      const name = parts.length > 1 ? parts[parts.length - 2] : parts[0];
      return name.length <= 4
        ? name.toUpperCase()
        : name.charAt(0).toUpperCase() + name.slice(1);
    } catch {
      return 'Article Installer';
    }
  };

  const truncateAtSlash = (url: string, min = 25) => {
    if (url.length <= min) return url;
    const next = url.indexOf('/', min);
    return next === -1 ? url.slice(0, min) + '…' : url.slice(0, next + 1) + '…';
  };

  if (!isOpen) return null;

  return (
    <div
      className="rounded-md flex-shrink-0 bg-white dark:bg-darkMode flex flex-col border-l-2 border-[#F9F9F9] dark:border-darkModeCompliment"
      style={{ width: '600px' }}
    >
      {/* Header */}
      <div className="bg-[#F9F9F9] dark:bg-darkModeDropdown px-3 py-1 pt-[11px] flex items-center justify-between">
        <div className="flex items-center gap-1.5 flex-1 min-w-0">
          {articleUrl &&
            (() => {
              try {
                const { hostname } = new URL(articleUrl);
                return (
                  <img
                    src={`https://www.google.com/s2/favicons?domain=${hostname}&sz=32`}
                    alt=""
                    className="w-4 h-4 shrink-0"
                    onError={(e) => {
                      (e.currentTarget as HTMLImageElement).style.display =
                        'none';
                    }}
                  />
                );
              } catch {
                return null;
              }
            })()}
          <span className="text-black dark:text-white font-semibold text-md leading-6 truncate">
            {articleUrl ? getSiteName(articleUrl) : 'Article Installer'}
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
          <div className="flex flex-col gap-3 py-4 px-8">
            {/* Thumbnail */}
            <div className="flex flex-col gap-3 px-3 pb-3">
              {/* Title */}
              <div className="flex flex-row items-center gap-2.5">
                <div className="flex items-center w-30 h-30 shrink-0">
                  {articleData.article_images?.length > 0 &&
                  articleData.article_images[0]?.url ? (
                    <img
                      src={articleData.article_images[0].url}
                      alt={articleData.article_images[0].alt ?? ''}
                      className="w-28 h-28 object-cover self-center mt-3 rounded-md shadow-lg"
                      onError={(e) => {
                        (e.currentTarget as HTMLImageElement).style.display =
                          'none';
                      }}
                    />
                  ) : (
                    <div className="w-28 h-28 bg-gray-100 dark:bg-gray-800 rounded-md" />
                  )}
                </div>
                <div className="flex flex-col gap-1">
                  <p
                    className="text-[21px] font-black text-[#474747] dark:text-gray-100 leading-snug"
                    style={{
                      fontFamily: 'Roboto, sans-serif',
                      fontWeight: 950,
                      WebkitTextStroke: '0.3px currentColor',
                    }}
                  >
                    {articleData.article_title ?? '—'}
                  </p>

                  <div className="flex flex-col gap-0.5">
                    {articleData.article_publish_date && (
                      <div className="flex flex-row items-center">
                        <p className="text-[11.5px] text-[#808080] dark:text-gray-500">
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
                        {articleUrl && (
                          <>
                            <LuDot className="text-[#808080]" />
                            <a
                              href={articleUrl}
                              target="_blank"
                              rel="noreferrer"
                              className="text-[11px] text-[#808080] dark:text-gray-400"
                              title={articleUrl}
                            >
                              {truncateAtSlash(articleUrl)}
                            </a>
                          </>
                        )}
                      </div>
                    )}
                  </div>
                  <div className="flex flex-row gap-1.5 items-center">
                    <IoPersonCircleSharp
                      className="flex item-center text-[#808080]"
                      size={18}
                    />
                    {articleData.article_authors.length > 0 && (
                      <p className="text-[11px] text-[#808080] dark:text-gray-400">
                        {articleData.article_authors
                          .map((a) => a.name)
                          .join(', ')}
                      </p>
                    )}
                    <button
                      onClick={() => navigator.clipboard.writeText(articleUrl)}
                      title="Copy link"
                      className="text-[#808080] hover:text-[#474747] dark:hover:text-gray-200"
                    >
                      <LuCopy size={13} />
                    </button>
                    <a
                      href={`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(
                        articleUrl,
                      )}`}
                      target="_blank"
                      rel="noreferrer"
                      title="Share on Facebook"
                      className="text-blue-600 hover:text-[#1877F2]"
                    >
                      <FaFacebook size={13} />
                    </a>
                    <a
                      href={`https://twitter.com/intent/tweet?url=${encodeURIComponent(
                        articleUrl,
                      )}`}
                      target="_blank"
                      rel="noreferrer"
                      title="Share on X"
                      className="text-black hover:text-black dark:hover:text-white"
                    >
                      <FaXTwitter size={13} />
                    </a>
                  </div>
                </div>
              </div>

              {/* Sections */}
              {(() => {
                const sections = formatArticleSections(articleData);
                if (sections.length === 0) {
                  return (
                    <p className="text-xs text-gray-400 dark:text-gray-500">
                      Article content not available
                    </p>
                  );
                }
                return (
                  <div className="flex flex-col gap-4 mt-1">
                    {sections.map((section, i) => (
                      <div key={i} className="flex flex-col gap-4">
                        {section.heading && (
                          <p className="text-[13px] font-semibold text-[#474747] dark:text-gray-300">
                            {section.heading}
                          </p>
                        )}
                        {section.paragraphs.map((para, j) => (
                          <p
                            key={j}
                            className="text-[13px] text-[#5B5B5B] dark:text-gray-400 leading-relaxed font-[400]"
                          >
                            {para}
                          </p>
                        ))}
                      </div>
                    ))}
                  </div>
                );
              })()}
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
