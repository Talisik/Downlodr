import { useAfdaStore } from '@/afda/store/afdaStore';
import React from 'react';
import ArticleSidePanel from './ArticleSidePanel';

const ArticleSidePanelManager: React.FC = () => {
  const isOpen = useAfdaStore((state) => state.isOpen);
  const close = useAfdaStore((state) => state.close);

  return <ArticleSidePanel isOpen={isOpen} onClose={close} />;
};

export default ArticleSidePanelManager;
