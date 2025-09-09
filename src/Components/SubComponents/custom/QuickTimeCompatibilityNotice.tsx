/**
 * QuickTime Compatibility Notice Component
 * Displays information about QuickTime Player compatibility improvements
 */

import React from 'react';
import { CheckCircle, Info, AlertTriangle } from 'lucide-react';

interface QuickTimeCompatibilityNoticeProps {
  isVisible: boolean;
  compatibilityStatus: 'compatible' | 'warning' | 'info';
  message?: string;
  details?: string[];
  suggestions?: string[];
  onDismiss?: () => void;
}

export const QuickTimeCompatibilityNotice: React.FC<
  QuickTimeCompatibilityNoticeProps
> = ({
  isVisible,
  compatibilityStatus,
  message,
  details = [],
  suggestions = [],
  onDismiss,
}) => {
  if (!isVisible) return null;

  const getStatusConfig = () => {
    switch (compatibilityStatus) {
      case 'compatible':
        return {
          icon: <CheckCircle className="w-5 h-5 text-green-500" />,
          bgColor: 'bg-green-50 dark:bg-green-900/20',
          borderColor: 'border-green-200 dark:border-green-800',
          textColor: 'text-green-800 dark:text-green-200',
          title: 'QuickTime Compatible',
        };
      case 'warning':
        return {
          icon: <AlertTriangle className="w-5 h-5 text-yellow-500" />,
          bgColor: 'bg-yellow-50 dark:bg-yellow-900/20',
          borderColor: 'border-yellow-200 dark:border-yellow-800',
          textColor: 'text-yellow-800 dark:text-yellow-200',
          title: 'Limited Compatibility',
        };
      case 'info':
      default:
        return {
          icon: <Info className="w-5 h-5 text-blue-500" />,
          bgColor: 'bg-blue-50 dark:bg-blue-900/20',
          borderColor: 'border-blue-200 dark:border-blue-800',
          textColor: 'text-blue-800 dark:text-blue-200',
          title: 'Compatibility Information',
        };
    }
  };

  const statusConfig = getStatusConfig();

  return (
    <div
      className={`
      p-4 rounded-lg border-l-4 
      ${statusConfig.bgColor} 
      ${statusConfig.borderColor} 
      ${statusConfig.textColor}
      mb-4
    `}
    >
      <div className="flex items-start space-x-3">
        <div className="flex-shrink-0">{statusConfig.icon}</div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between">
            <h4 className="font-medium text-sm">{statusConfig.title}</h4>

            {onDismiss && (
              <button
                onClick={onDismiss}
                className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                aria-label="Dismiss notification"
              >
                <svg
                  className="w-4 h-4"
                  fill="currentColor"
                  viewBox="0 0 20 20"
                >
                  <path
                    fillRule="evenodd"
                    d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
                    clipRule="evenodd"
                  />
                </svg>
              </button>
            )}
          </div>

          {message && <p className="text-sm mt-1">{message}</p>}

          {details.length > 0 && (
            <div className="mt-2">
              <p className="text-xs font-medium mb-1">Issues:</p>
              <ul className="text-xs space-y-1">
                {details.map((detail, index) => (
                  <li key={index} className="flex items-start">
                    <span className="mr-2">•</span>
                    <span>{detail}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {suggestions.length > 0 && (
            <div className="mt-2">
              <p className="text-xs font-medium mb-1">Suggestions:</p>
              <ul className="text-xs space-y-1">
                {suggestions.map((suggestion, index) => (
                  <li key={index} className="flex items-start">
                    <span className="mr-2">💡</span>
                    <span>{suggestion}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {compatibilityStatus === 'compatible' && (
            <div className="mt-2">
              <p className="text-xs">
                This format uses H.264 video and AAC audio, which are fully
                supported by QuickTime Player and most media players.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default QuickTimeCompatibilityNotice;
