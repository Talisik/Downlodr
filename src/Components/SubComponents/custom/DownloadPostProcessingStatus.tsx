/**
 * Download Post-Processing Status Component
 * Shows status for QuickTime compatibility validation and fixing
 */

import React from 'react';
import {
  CheckCircle,
  AlertTriangle,
  Loader2,
  Info,
  AlertCircle,
} from 'lucide-react';

interface PostProcessingStatusProps {
  status:
    | 'fixing_compatibility'
    | 'compatibility_fixed'
    | 'compatibility_warning'
    | 'compatibility_verified'
    | 'compatibility_check_failed';
  message: string;
  issues?: string[];
  error?: string;
  compatibleFile?: string;
}

export const DownloadPostProcessingStatus: React.FC<
  PostProcessingStatusProps
> = ({ status, message, issues = [], error, compatibleFile }) => {
  const getStatusConfig = () => {
    switch (status) {
      case 'fixing_compatibility':
        return {
          icon: <Loader2 className="w-4 h-4 animate-spin text-blue-500" />,
          bgColor: 'bg-blue-50 dark:bg-blue-900/20',
          borderColor: 'border-l-blue-400',
          textColor: 'text-blue-800 dark:text-blue-200',
          showSpinner: true,
        };

      case 'compatibility_fixed':
        return {
          icon: <CheckCircle className="w-4 h-4 text-green-500" />,
          bgColor: 'bg-green-50 dark:bg-green-900/20',
          borderColor: 'border-l-green-400',
          textColor: 'text-green-800 dark:text-green-200',
          showSpinner: false,
        };

      case 'compatibility_verified':
        return {
          icon: <CheckCircle className="w-4 h-4 text-green-500" />,
          bgColor: 'bg-green-50 dark:bg-green-900/20',
          borderColor: 'border-l-green-400',
          textColor: 'text-green-800 dark:text-green-200',
          showSpinner: false,
        };

      case 'compatibility_warning':
        return {
          icon: <AlertTriangle className="w-4 h-4 text-yellow-500" />,
          bgColor: 'bg-yellow-50 dark:bg-yellow-900/20',
          borderColor: 'border-l-yellow-400',
          textColor: 'text-yellow-800 dark:text-yellow-200',
          showSpinner: false,
        };

      case 'compatibility_check_failed':
        return {
          icon: <AlertCircle className="w-4 h-4 text-red-500" />,
          bgColor: 'bg-red-50 dark:bg-red-900/20',
          borderColor: 'border-l-red-400',
          textColor: 'text-red-800 dark:text-red-200',
          showSpinner: false,
        };

      default:
        return {
          icon: <Info className="w-4 h-4 text-gray-500" />,
          bgColor: 'bg-gray-50 dark:bg-gray-900/20',
          borderColor: 'border-l-gray-400',
          textColor: 'text-gray-800 dark:text-gray-200',
          showSpinner: false,
        };
    }
  };

  const statusConfig = getStatusConfig();

  return (
    <div
      className={`
      px-3 py-2 rounded-md border-l-4 text-xs
      ${statusConfig.bgColor} 
      ${statusConfig.borderColor} 
      ${statusConfig.textColor}
      mt-1
    `}
    >
      <div className="flex items-start space-x-2">
        <div className="flex-shrink-0 mt-0.5">{statusConfig.icon}</div>

        <div className="flex-1 min-w-0">
          <p className="font-medium">{message}</p>

          {/* Show issues if any */}
          {issues.length > 0 && (
            <div className="mt-1">
              <p className="text-xs opacity-80 mb-1">Issues detected:</p>
              <ul className="text-xs opacity-70 space-y-0.5">
                {issues.map((issue, index) => (
                  <li key={index} className="flex items-start">
                    <span className="mr-1">•</span>
                    <span>{issue}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Show compatible file path if created */}
          {compatibleFile && status === 'compatibility_fixed' && (
            <div className="mt-1">
              <p className="text-xs opacity-80">
                ✅ QuickTime-compatible file: {compatibleFile.split('/').pop()}
              </p>
            </div>
          )}

          {/* Show error if any */}
          {error && (
            <div className="mt-1">
              <p className="text-xs opacity-70">Error: {error}</p>
            </div>
          )}

          {/* Helpful tips based on status */}
          {status === 'compatibility_fixed' && (
            <div className="mt-1">
              <p className="text-xs opacity-70">
                💡 The original file has been preserved. Use the
                QuickTime-compatible version for better playback.
              </p>
            </div>
          )}

          {status === 'compatibility_verified' && (
            <div className="mt-1">
              <p className="text-xs opacity-70">
                🎬 This file uses H.264 video and AAC audio, fully supported by
                QuickTime Player.
              </p>
            </div>
          )}

          {status === 'compatibility_warning' && (
            <div className="mt-1">
              <p className="text-xs opacity-70">
                💡 Try using VLC Media Player or other universal players if
                QuickTime has issues.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default DownloadPostProcessingStatus;
