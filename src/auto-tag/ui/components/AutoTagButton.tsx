/**
 * AutoTagButton — triggers auto-tagging for selected (or all eligible) downloads.
 *
 * Drop this into a toolbar/context menu. When `selectedIds` is provided it tags
 * just those; otherwise it tags all finished + history downloads.
 */

import React from 'react';
import { useAutoTag } from '../hooks/useAutoTag';

interface AutoTagButtonProps {
  selectedIds?: string[];
  className?: string;
}

const AutoTagButton: React.FC<AutoTagButtonProps> = ({
  selectedIds,
  className,
}) => {
  const { state, error, tagDownloads } = useAutoTag();
  const running = state === 'running';

  return (
    <button
      type="button"
      className={className}
      disabled={running}
      title={
        error ??
        'Generate descriptive tags from metadata (and transcript when available)'
      }
      onClick={() => void tagDownloads(selectedIds)}
    >
      {running ? 'Tagging…' : 'Auto-tag'}
    </button>
  );
};

export default AutoTagButton;
