import React from 'react';

const LoadingSkeleton = () => {
  return (
    <div className="animate-pulse space-y-4 p-4">
      {/* Title skeleton */}
      <div className="h-6 bg-gray-200 rounded w-3/4"></div>

      {/* Format options skeleton */}
      <div className="space-y-3">
        <div className="h-4 bg-gray-200 rounded w-1/2"></div>
        <div className="h-4 bg-gray-200 rounded w-2/3"></div>
        <div className="h-4 bg-gray-200 rounded w-1/2"></div>
      </div>

      {/* Download options skeleton */}
      <div className="space-y-3 mt-6">
        <div className="h-10 bg-gray-200 rounded"></div>
        <div className="h-10 bg-gray-200 rounded"></div>
      </div>
    </div>
  );
};

export default LoadingSkeleton;
