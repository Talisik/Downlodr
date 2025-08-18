import React, { useState, useEffect } from 'react';
import { Badge } from '@/Components/SubComponents/shadcn/components/ui/badge';
import { Button } from '@/Components/SubComponents/shadcn/components/ui/button';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/Components/SubComponents/shadcn/components/ui/tooltip';
import {
  Alert,
  AlertDescription,
} from '@/Components/SubComponents/shadcn/components/ui/alert';

interface BinaryStatusInfo {
  available: boolean;
  version?: string;
  path?: string;
  architecture?: string;
  error?: string;
  details?: any;
}

interface BinaryStatusProps {
  className?: string;
  showDetails?: boolean;
}

export const BinaryStatus: React.FC<BinaryStatusProps> = ({
  className = '',
  showDetails = false,
}) => {
  const [ffmpegStatus, setFfmpegStatus] = useState<BinaryStatusInfo>({
    available: false,
  });
  const [ytdlpStatus, setYtdlpStatus] = useState<BinaryStatusInfo>({
    available: false,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    checkBinaryStatus();
  }, []);

  const checkBinaryStatus = async () => {
    try {
      setLoading(true);

      // Check FFmpeg status
      const ffmpegResult = await (
        window as any
      ).downlodrFunctions.checkFfmpegStatus();
      setFfmpegStatus(ffmpegResult);

      // Check yt-dlp status by trying to get info for a test URL
      try {
        const testResult = await (window as any).ytdlp.getInfo(
          'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
        );
        if (testResult && testResult.ok !== false) {
          setYtdlpStatus({ available: true });
        } else {
          setYtdlpStatus({
            available: false,
            error: testResult?.error || 'Unknown error',
            details: testResult?.details,
          });
        }
      } catch (ytdlpError) {
        setYtdlpStatus({
          available: false,
          error: ytdlpError.message || 'Failed to test yt-dlp',
        });
      }
    } catch (error) {
      console.error('Failed to check binary status:', error);
      setFfmpegStatus({ available: false, error: 'Failed to check status' });
      setYtdlpStatus({ available: false, error: 'Failed to check status' });
    } finally {
      setLoading(false);
    }
  };

  const getStatusBadge = (name: string, status: BinaryStatusInfo) => {
    if (loading) {
      return (
        <Badge variant="secondary" className="animate-pulse">
          {name}: Checking...
        </Badge>
      );
    }

    if (status.available) {
      return (
        <Badge variant="default" className="bg-green-500 hover:bg-green-600">
          ✅ {name}
        </Badge>
      );
    }

    return <Badge variant="destructive">⚠️ {name}</Badge>;
  };

  const getTooltipContent = (name: string, status: BinaryStatusInfo) => {
    if (loading) return `Checking ${name} status...`;

    if (status.available) {
      return (
        <div className="space-y-1">
          <div className="font-semibold">✅ {name} Available</div>
          {status.version && <div className="text-xs">{status.version}</div>}
          {status.architecture && (
            <div className="text-xs">Architecture: {status.architecture}</div>
          )}
          {status.path && (
            <div className="text-xs opacity-75">Path: {status.path}</div>
          )}
        </div>
      );
    }

    return (
      <div className="space-y-1">
        <div className="font-semibold">⚠️ {name} Not Available</div>
        {status.error && (
          <div className="text-xs text-red-400 mt-1">Error: {status.error}</div>
        )}
        {status.details && (
          <div className="text-xs text-yellow-400 mt-1">
            <div>Path: {status.details.path}</div>
            <div>Exists: {status.details.exists ? 'Yes' : 'No'}</div>
            <div>Executable: {status.details.executable ? 'Yes' : 'No'}</div>
            {status.details.packaged !== undefined && (
              <div>Packaged: {status.details.packaged ? 'Yes' : 'No'}</div>
            )}
          </div>
        )}
      </div>
    );
  };

  if (showDetails && !loading) {
    return (
      <div className={`space-y-4 ${className}`}>
        <div className="flex gap-2 flex-wrap">
          {getStatusBadge('FFmpeg', ffmpegStatus)}
          {getStatusBadge('yt-dlp', ytdlpStatus)}
        </div>

        {(!ffmpegStatus.available || !ytdlpStatus.available) && (
          <Alert className="border-yellow-500">
            <AlertDescription>
              <div className="space-y-2">
                <div className="font-semibold">
                  Binary Status Issues Detected
                </div>
                {!ffmpegStatus.available && (
                  <div className="text-sm">
                    <strong>FFmpeg:</strong>{' '}
                    {ffmpegStatus.error || 'Not available'}
                    <div className="text-xs text-blue-600 dark:text-blue-400 mt-1">
                      💡 Install via: brew install ffmpeg
                    </div>
                  </div>
                )}
                {!ytdlpStatus.available && (
                  <div className="text-sm">
                    <strong>yt-dlp:</strong>{' '}
                    {ytdlpStatus.error || 'Not available'}
                    {ytdlpStatus.details && (
                      <div className="text-xs mt-1 space-y-1">
                        <div>Binary Path: {ytdlpStatus.details.path}</div>
                        <div>
                          File Exists:{' '}
                          {ytdlpStatus.details.exists ? '✅' : '❌'}
                        </div>
                        <div>
                          Executable:{' '}
                          {ytdlpStatus.details.executable ? '✅' : '❌'}
                        </div>
                        {ytdlpStatus.details.packaged !== undefined && (
                          <div>
                            App Packaged:{' '}
                            {ytdlpStatus.details.packaged ? '✅' : '❌'}
                          </div>
                        )}
                        {ytdlpStatus.details.accessError && (
                          <div className="text-red-400">
                            Access Error: {ytdlpStatus.details.accessError}
                          </div>
                        )}
                        {ytdlpStatus.details.chmodError && (
                          <div className="text-red-400">
                            Permission Error: {ytdlpStatus.details.chmodError}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}
                <Button
                  variant="outline"
                  size="sm"
                  onClick={checkBinaryStatus}
                  className="mt-2"
                >
                  🔄 Recheck Status
                </Button>
              </div>
            </AlertDescription>
          </Alert>
        )}

        {ffmpegStatus.available && ytdlpStatus.available && (
          <div className="text-sm text-green-600 dark:text-green-400">
            ✅ All required binaries are available and working
          </div>
        )}
      </div>
    );
  }

  return (
    <TooltipProvider>
      <div className="flex gap-2">
        <Tooltip>
          <TooltipTrigger asChild>
            <div className="cursor-help">
              {getStatusBadge('FFmpeg', ffmpegStatus)}
            </div>
          </TooltipTrigger>
          <TooltipContent side="bottom" className="max-w-xs">
            {getTooltipContent('FFmpeg', ffmpegStatus)}
          </TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger asChild>
            <div className="cursor-help">
              {getStatusBadge('yt-dlp', ytdlpStatus)}
            </div>
          </TooltipTrigger>
          <TooltipContent side="bottom" className="max-w-xs">
            {getTooltipContent('yt-dlp', ytdlpStatus)}
          </TooltipContent>
        </Tooltip>
      </div>
    </TooltipProvider>
  );
};

export default BinaryStatus;
