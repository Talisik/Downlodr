import CCToMarkdown from '@/Assets/Images/CCToMarkdown.jpg';
import FormatConverter from '@/Assets/Images/FormatConverter.jpg';
import MetadataScraper from '@/Assets/Images/MetadataScraper.jpg';
import { isSvgString } from './stringHelpers';

// Render icon helper function
export const renderIcon = (
  icon: unknown,
  size: 'sm' | 'md' = 'sm',
  pluginName?: string,
) => {
  const sizeClass = size === 'md' ? 'w-6 h-6' : 'w-5 h-5';

  if (typeof icon === 'string' && isSvgString(icon)) {
    return (
      <>
        {/* TODO: Only adding pluginName parameter for now for demo purposes. This should be added on the plugin item and imported from there */}
        {pluginName === 'Format Converter' && (
          <div className="flex items-center justify-center">
            <img src={FormatConverter} alt="Format Converter Plugin" />
          </div>
        )}

        {pluginName === 'Metadata Exporter' && (
          <div>
            <img src={MetadataScraper} alt="Metadata Exporter Plugin" />
          </div>
        )}

        {pluginName === 'CC to Markdown' && (
          <div>
            <img src={CCToMarkdown} alt="CC To Markdown Plugin" />
          </div>
        )}

        {!pluginName && (
          <div
            dangerouslySetInnerHTML={{ __html: icon }}
            className={`${sizeClass} flex items-center justify-center rounded-sm [&>svg]:w-full [&>svg]:h-full`}
          />
        )}
      </>
    );
  } else if (icon) {
    return <span>{icon as string}</span>;
  } else {
    return (
      <div
        className={`${sizeClass} bg-gray-300 dark:bg-gray-600 rounded-sm flex items-center justify-center`}
      >
        <span className="text-xs font-bold text-gray-600 dark:text-gray-300">
          P
        </span>
      </div>
    );
  }
};
