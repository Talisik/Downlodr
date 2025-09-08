import React, { useState, useEffect } from 'react';
import { Badge } from '@/Components/SubComponents/shadcn/components/ui/badge';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/Components/SubComponents/shadcn/components/ui/tooltip';

interface FfmpegStatusInfo {
  available: boolean;
  version?: string;
  path?: string;
  architecture?: string;
  error?: string;
}

interface FfmpegStatusProps {
  className?: string; 
  showDetails?: boolean;
}

export const FfmpegStatus: React.FC<FfmpegStatusProps> = ({
  className = '',
  showDetails = false,
}) => {
  const [status, setStatus] = useState<FfmpegStatusInfo>({ available: false });
  const [loading, setLoading] = useState(true);
  const [isPackaged, setIsPackaged] = useState(true);

  useEffect(() => {
    checkFfmpegStatus();
  }, []);

  const checkFfmpegStatus = async () => {
    try {
      setLoading(true);

      // Check if app is packaged (production mode)
      const packaged = await (
        window as any
      ).downlodrFunctions.checkAppPackaged();
      setIsPackaged(packaged);

      const result = await (
        window as any
      ).downlodrFunctions.checkFfmpegStatus();
      setStatus(result);
    } catch (error) {
      console.error('Failed to check FFmpeg status:', error);
      setStatus({ available: false, error: 'Failed to check status' });
    } finally {
      setLoading(false);
    }
  };

  const getStatusBadge = () => {
    if (loading) {
      return (
        <Badge variant="secondary" className={`animate-pulse ${className}`}>
          Checking...
        </Badge>
      );
    }

    if (status.available) {
      return (
        <Badge
          variant="default"
          className={`bg-green-500 hover:bg-green-600 ${className}`}
        >
          ✅ FFmpeg Ready
        </Badge>
      );
    }

    return (
      <Badge variant="destructive" className={className}>
        ⚠️ FFmpeg Missing
      </Badge>
    );
  };

  const getTooltipContent = () => {
    if (loading) return 'Checking FFmpeg status...';

    if (status.available) {
      return (
        <div className="space-y-1">
          <div className="font-semibold">✅ FFmpeg Available</div>
          {status.version && <div className="text-xs">{status.version}</div>}
          {status.architecture && (
            <div className="text-xs">Architecture: {status.architecture}</div>
          )}
          {status.path && (
            <div className="text-xs opacity-75">Path: {status.path}</div>
          )}
          <div className="text-xs text-green-400 mt-2">
            All video processing features are available
          </div>
        </div>
      );
    }

    return (
      <div className="space-y-1">
        <div className="font-semibold">⚠️ FFmpeg Not Available</div>
        <div className="text-xs text-yellow-400">
          Some video processing features may be limited
        </div>
        <div className="text-xs text-blue-400 mt-2">
          💡 Install via: brew install ffmpeg
        </div>
        {status.error && (
          <div className="text-xs text-red-400 mt-1">Error: {status.error}</div>
        )}
      </div>
    );
  };

  // Don't show FFmpeg badge in production (packaged app)
  if (isPackaged) {
    return null;
  }

  const badge = getStatusBadge();

  if (showDetails && !loading) {
    return (
      <div className={`space-y-2 ${className}`}>
        {badge}
        {status.available ? (
          <div className="text-xs space-y-1 text-green-600 dark:text-green-400">
            <div>✅ All video processing features available</div>
            {status.architecture && <div>📱 {status.architecture}</div>}
            {status.version && <div>🔧 {status.version.split(' ')[2]}</div>}
          </div>
        ) : (
          <div className="text-xs space-y-1 text-yellow-600 dark:text-yellow-400">
            <div>⚠️ Limited video processing capabilities</div>
            <div className="text-blue-600 dark:text-blue-400">
              💡 Install FFmpeg for full functionality
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <div className="cursor-help">{badge}</div>
        </TooltipTrigger>
        <TooltipContent side="bottom" className="max-w-xs">
          {getTooltipContent()}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
};

export default FfmpegStatus;
