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
