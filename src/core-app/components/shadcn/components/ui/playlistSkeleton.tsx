import { Skeleton } from '@/core-app/components/shadcn/components/ui/skeleton';

const PlaylistSkeleton = () => {
  const rowHeight = 52; // 40px height + 12px spacing
  const skeletonCount = Math.ceil(window.innerHeight / rowHeight);
  return (
    <div className="flex flex-col gap-2 w-full">
      <Skeleton className="h-4 w-full rounded-[3px]" />

      <div className="mt-3 space-y-3">
        {Array.from({ length: skeletonCount }).map((_, index) => (
          <Skeleton key={index} className="h-10 w-full rounded-[3px]" />
        ))}
      </div>
    </div>
  );
};

export default PlaylistSkeleton;
