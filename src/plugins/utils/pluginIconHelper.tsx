import { isSvgString } from '@/core-app/utils/stringHelper';

/**
 * True when a plugin icon string is an image to load (data URL, http(s) URL,
 * bundled asset path, or a file name with an image extension) rather than an
 * icon name or emoji to show as text.
 */
export const looksLikeImageSource = (value: string): boolean =>
  /^data:image\//i.test(value) ||
  /^https?:\/\//i.test(value) ||
  /^\.{0,2}\//.test(value) ||
  /\.(png|jpe?g|gif|webp|svg|ico|bmp|avif)(\?.*)?$/i.test(value);

export const renderIcon = (
  icon: unknown,
  size: 'sm' | 'md' | 'lg' = 'sm',
  pluginName?: string,
) => {
  const sizeClass = size === 'lg' ? 'w-12 h-12' : size === 'md' ? 'w-6 h-6' : 'w-5 h-5';

  if (typeof icon !== 'string' || !icon) {
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

  // The bundled plugin artwork is opaque light-background imagery, so an
  // inline manifest SVG has to supply that chip itself - otherwise a bare
  // currentColor glyph stretches edge to edge and inherits the dark card
  // surface behind it, reading as broken next to the image-backed icons.
  if (isSvgString(icon)) {
    return (
      <div
        dangerouslySetInnerHTML={{ __html: icon }}
        className={`${sizeClass} flex items-center justify-center rounded-sm bg-gray-100 text-gray-700 p-[15%] [&>svg]:w-full [&>svg]:h-full`}
      />
    );
  }

  // Image URL (Vite-bundled asset path or data: URL)
  return (
    <div className={`${sizeClass} flex items-center justify-center`}>
      <img
        src={icon}
        alt={pluginName ?? 'Plugin icon'}
        className="w-full h-full object-contain rounded-sm"
      />
    </div>
  );
};
