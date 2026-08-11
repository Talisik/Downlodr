import { isValidElement, type ReactNode } from 'react';
import { isSvgString } from '@/core-app/utils/stringHelper';

/**
 * Renders a plugin-supplied icon, which can be any of:
 *  - an inline SVG string (`<svg …></svg>`)
 *  - an image URL / data: URI (Vite-bundled asset path, http(s), or data:)
 *  - a React element (icons supplied by in-app extension points)
 *  - nothing, in which case a neutral "P" placeholder is shown.
 *
 * The image-URL case is the one that used to be missing: call sites tested
 * only for an SVG string and otherwise fell through to `<span>{icon}</span>`,
 * which renders a URL *as literal text*. In a packaged build a bundled asset
 * resolves to an absolute path, so the plugin detail header printed
 * "…/Resources/app.asar/…/assets/CCToMarkdown-<hash>.jpg" across the page
 * instead of an icon. Anything string-shaped that isn't an SVG is treated as
 * an image source here.
 *
 * @param icon      the plugin's icon value
 * @param size      preset wrapper size; ignored when `className` is given
 * @param pluginName used as the image's alt text — never the raw src, so a
 *                   failed load degrades to a readable name rather than a path
 * @param className overrides the wrapper classes when a call site needs its
 *                  own sizing/colour (context menus, side panels)
 */
export const renderIcon = (
 icon: unknown,
 size: 'sm' | 'md' | 'lg' = 'sm',
 pluginName?: string,
 className?: string,
) => {
 const sizeClass =
  className ??
  (size === 'lg' ? 'w-12 h-12' : size === 'md' ? 'w-6 h-6' : 'w-5 h-5');

 if (typeof icon === 'string' && icon.trim()) {
  if (isSvgString(icon)) {
   return (
    <div
     dangerouslySetInnerHTML={{ __html: icon }}
     className={`${sizeClass} flex items-center justify-center rounded-sm [&>svg]:w-full [&>svg]:h-full`}
    />
   );
  }

  // Image URL (Vite-bundled asset path, http(s), or data: URI)
  return (
   <div className={`${sizeClass} flex items-center justify-center`}>
    <img
     src={icon}
     alt={pluginName ?? 'Plugin icon'}
     className="w-full h-full object-contain rounded-sm"
    />
   </div>
  );
 }

 // React element supplied directly by an in-app extension point.
 if (isValidElement(icon)) {
  return (
   <span className={`${sizeClass} inline-flex items-center justify-center`}>
    {icon as ReactNode}
   </span>
  );
 }

 return (
  <div
   className={`${sizeClass} bg-gray-300 dark:bg-gray-600 rounded-sm flex items-center justify-center`}
  >
   <span className="text-xs font-bold text-gray-600 dark:text-gray-300">
    P
   </span>
  </div>
 );
};
