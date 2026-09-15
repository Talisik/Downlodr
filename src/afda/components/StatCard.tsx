import { RiBookShelfLine } from 'react-icons/ri';
import { ReactNode } from 'react';
import TooltipWrapper from '@/core-app/components/wrapper/TooltipWrapper';

interface StatCardProps {
  value: string;
  label: string;
  icon?: ReactNode;
  className?: string;
  smallValue?: string;
}

export default function StatCard({
  value,
  label,
  icon,
  className,
  smallValue,
}: StatCardProps) {
  return (
    <TooltipWrapper content={label} side="bottom">
      <div
        className={`p-2 rounded-md bg-[#F9F9F9] dark:bg-darkModeCompliment flex xl:w-36 flex-row items-center justify-center gap-2 ${
          className ?? ''
        }`}
      >
        <div className="flex flex-row gap-2">
          <div className="flex items-center justify-center">
            {icon ?? <RiBookShelfLine size={27} className="text-primary" />}
          </div>
          <div className="hidden xl:flex flex-1 flex-col items-start justify-center min-w-0">
            <span className="text-[13.5px] font-semibold text-gray-900 dark:text-gray-100 leading-tight truncate w-full">
              {value}
            </span>
            <span className="text-[11.5px] text-gray-500 dark:text-gray-400 truncate w-full">
              {label}
            </span>
          </div>
          <div className="xl:hidden flex flex-col items-start justify-center max-w-[80px]">
            <span className="text-[13.5px] font-semibold text-gray-900 dark:text-gray-100 leading-tight truncate whitespace-nowrap w-full">
              {smallValue ?? value}
            </span>
          </div>
        </div>
      </div>
    </TooltipWrapper>
  );
}
