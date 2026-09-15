import React from 'react';

interface FakeProgressBarProps {
  progress: number;
  color?: 'green' | 'primary';
  className?: string;
}

const FakeProgressBar: React.FC<FakeProgressBarProps> = ({
  progress,
  color = 'green',
  className = '',
}) => {
  const fillClass = color === 'primary' ? 'bg-primary' : 'bg-green-500';

  return (
    <div
      className={`w-full h-1.5 rounded-full bg-[#E8E8E8] dark:bg-darkModeDarkGray overflow-hidden ${className}`}
    >
      <div
        className={`h-full rounded-full transition-all duration-100 ${fillClass}`}
        style={{ width: `${progress}%` }}
      />
    </div>
  );
};

export default FakeProgressBar;
