import TooltipWrapper from '@/core-app/components/wrapper/TooltipWrapper';
import React from 'react';
import { LuEye } from 'react-icons/lu';

interface ArticleViewButtonProps {
  onClick: (e: React.MouseEvent) => void;
}

const ArticleViewButton: React.FC<ArticleViewButtonProps> = ({ onClick }) => (
  <TooltipWrapper content="View article" side="bottom">
    <button onClick={onClick}>
      <LuEye
        size={20}
        className="text-green-600 hover:text-green-400 transition-colors duration-200"
      />
    </button>
  </TooltipWrapper>
);

export default ArticleViewButton;
