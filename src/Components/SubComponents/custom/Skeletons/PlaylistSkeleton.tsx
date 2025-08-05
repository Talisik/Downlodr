import { Skeleton } from '@/Components/SubComponents/shadcn/components/ui/skeleton';

const PlaylistSkeleton = () => {
  return (
    <div className="flex flex-col gap-2 w-full">
      <Skeleton className="h-4 w-full rounded-[3px]" />

      <div className="mt-3 space-y-3">
        <Skeleton className="h-10 w-full rounded-[3px]" />
        <Skeleton className="h-10 w-full rounded-[3px]" />
        <Skeleton className="h-10 w-full rounded-[3px]" />
      </div>
    </div>
  );
};

export default PlaylistSkeleton;
