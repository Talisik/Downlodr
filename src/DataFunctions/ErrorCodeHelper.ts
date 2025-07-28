/**
 * Error Code Helper - Interprets download error codes and provides user-friendly messages
 *
 * This helper maps system error codes, network errors, and HTTP errors to specific
 * error messages that help users understand what went wrong and how to resolve it.
 */

// Error code interpretation based on ytdlp bug codes and system errors
export interface ErrorCodeInfo {
  code: number | string;
  title: string;
  description: string;
  category:
    | 'system'
    | 'network'
    | 'http'
    | 'ytdlp'
    | 'unknown'
    | 'system/network';
  severity: 'low' | 'medium' | 'high';
  canRetry: boolean;
  suggestions: string[];
}

// Comprehensive error code mapping
const ERROR_CODE_MAP: Record<string, ErrorCodeInfo> = {
  // Success
  '0': {
    code: 0,
    title: 'Success',
    description: 'Download completed successfully',
    category: 'system',
    severity: 'low',
    canRetry: false,
    suggestions: [],
  },

  // System Errors (1-99)
  '1': {
    code: 1,
    title: 'Permission Denied/Network Error',
    description:
      'Operation not permitted - Service was unable to connect to the server',
    category: 'system/network',
    severity: 'high',
    canRetry: true,
    suggestions: [
      'Check file/folder permissions',
      'Verify write access to destination folder',
      'Check internet connection',
      'Try a different network',
      'Check if the URL is correct',
    ],
  },
  '2': {
    code: 2,
    title: 'File Not Found',
    description: 'No such file or directory',
    category: 'system',
    severity: 'medium',
    canRetry: true,
    suggestions: [
      'Check if the file path exists',
      'Verify the URL is still valid',
      'Try downloading to a different location',
    ],
  },
  '6': {
    code: 6,
    title: 'Device Error',
    description: 'No such device or address',
    category: 'system',
    severity: 'medium',
    canRetry: true,
    suggestions: [
      'Check network connection',
      'Verify the target device is accessible',
      'Try again in a few moments',
    ],
  },
  '13': {
    code: 13,
    title: 'Access Denied',
    description: 'Permission denied - insufficient access rights',
    category: 'system',
    severity: 'high',
    canRetry: true,
    suggestions: [
      'Check folder permissions',
      'Run with elevated privileges',
      'Choose a different download location',
    ],
  },
  '21': {
    code: 21,
    title: 'Directory Error',
    description: 'Target is a directory, not a file',
    category: 'system',
    severity: 'medium',
    canRetry: true,
    suggestions: [
      'Check the download path',
      'Ensure filename is specified correctly',
      'Remove conflicting directory',
    ],
  },
  '22': {
    code: 22,
    title: 'Invalid Argument',
    description: 'Invalid argument passed to system call',
    category: 'system',
    severity: 'medium',
    canRetry: true,
    suggestions: [
      'Check download parameters',
      'Verify URL format is correct',
      'Try with different settings',
    ],
  },
  '28': {
    code: 28,
    title: 'Disk Full',
    description: 'No space left on device',
    category: 'system',
    severity: 'high',
    canRetry: false,
    suggestions: [
      'Free up disk space',
      'Choose a different download location',
      'Check available storage',
    ],
  },
  '32': {
    code: 32,
    title: 'Broken Pipe',
    description: 'Connection broken by remote end',
    category: 'network',
    severity: 'medium',
    canRetry: true,
    suggestions: [
      'Check network stability',
      'Retry the download',
      'Try with slower connection speed',
    ],
  },
  '35': {
    code: 35,
    title: 'Resource Busy',
    description: 'Resource temporarily unavailable',
    category: 'system',
    severity: 'medium',
    canRetry: true,
    suggestions: [
      'Wait and try again',
      'Check if file is in use',
      'Close other applications using the resource',
    ],
  },
  '36': {
    code: 36,
    title: 'Filename Too Long',
    description: 'File name exceeds maximum length',
    category: 'system',
    severity: 'medium',
    canRetry: true,
    suggestions: [
      'Shorten the filename',
      'Change download location',
      'Use custom naming template',
    ],
  },
  '38': {
    code: 38,
    title: 'Function Not Implemented',
    description: 'Function not implemented in current system',
    category: 'system',
    severity: 'high',
    canRetry: false,
    suggestions: [
      'Update the application',
      'Check system compatibility',
      'Try different format options',
    ],
  },
  '54': {
    code: 54,
    title: 'Connection Reset',
    description: 'Connection reset by peer',
    category: 'network',
    severity: 'medium',
    canRetry: true,
    suggestions: [
      'Check network connection',
      'Retry the download',
      'Try using a VPN if blocked',
    ],
  },
  '60': {
    code: 60,
    title: 'Operation Timeout',
    description: 'Operation timed out',
    category: 'network',
    severity: 'medium',
    canRetry: true,
    suggestions: [
      'Check network speed',
      'Retry with increased timeout',
      'Try downloading at different time',
    ],
  },
  '61': {
    code: 61,
    title: 'Connection Refused',
    description: 'Connection refused by remote server',
    category: 'network',
    severity: 'medium',
    canRetry: true,
    suggestions: [
      'Check if server is online',
      'Verify URL is correct',
      'Try using different network',
    ],
  },
  '63': {
    code: 63,
    title: 'Name Too Long',
    description: 'File name too long for filesystem',
    category: 'system',
    severity: 'medium',
    canRetry: true,
    suggestions: [
      'Use shorter filename',
      'Change file naming template',
      'Select different download location',
    ],
  },
  '99': {
    code: 99,
    title: 'Address In Use',
    description: 'Cannot assign requested address',
    category: 'network',
    severity: 'medium',
    canRetry: true,
    suggestions: [
      'Wait and retry',
      'Check network configuration',
      'Restart application',
    ],
  },
  '101': {
    code: 101,
    title: 'Network Unreachable',
    description: 'Network is unreachable',
    category: 'network',
    severity: 'high',
    canRetry: true,
    suggestions: [
      'Check internet connection',
      'Verify network settings',
      'Try using different network',
    ],
  },
  '104': {
    code: 104,
    title: 'Connection Reset',
    description: 'Connection reset by peer',
    category: 'network',
    severity: 'medium',
    canRetry: true,
    suggestions: [
      'Check network stability',
      'Retry the download',
      'Try different server if available',
    ],
  },
  '110': {
    code: 110,
    title: 'Connection Timeout',
    description: 'Connection timed out',
    category: 'network',
    severity: 'medium',
    canRetry: true,
    suggestions: [
      'Check network speed',
      'Retry with better connection',
      'Try downloading smaller segments',
    ],
  },
  '111': {
    code: 111,
    title: 'Connection Refused',
    description: 'Connection refused by remote host',
    category: 'network',
    severity: 'medium',
    canRetry: true,
    suggestions: [
      'Check if service is running',
      'Verify firewall settings',
      'Try different network',
    ],
  },
  '267': {
    code: 267,
    title: 'Invalid Directory',
    description: 'Directory name is invalid',
    category: 'system',
    severity: 'medium',
    canRetry: true,
    suggestions: [
      'Check directory path',
      'Create directory if missing',
      'Use valid directory name',
    ],
  },

  // Windows-specific errors (10000+)
  '10051': {
    code: 10051,
    title: 'Network Unreachable',
    description: 'Network is unreachable (Windows)',
    category: 'network',
    severity: 'high',
    canRetry: true,
    suggestions: [
      'Check internet connection',
      'Verify Windows network settings',
      'Try using different DNS',
    ],
  },
  '10053': {
    code: 10053,
    title: 'Connection Aborted',
    description: 'Connection aborted by remote host (Windows)',
    category: 'network',
    severity: 'medium',
    canRetry: true,
    suggestions: [
      'Check network stability',
      'Retry the download',
      'Verify firewall settings',
    ],
  },
  '10054': {
    code: 10054,
    title: 'Connection Reset',
    description: 'Connection reset by remote host (Windows)',
    category: 'network',
    severity: 'medium',
    canRetry: true,
    suggestions: [
      'Check network connection',
      'Try different server',
      'Verify proxy settings',
    ],
  },
  '11000': {
    code: 11000,
    title: 'Request Timeout',
    description: 'Request timed out',
    category: 'network',
    severity: 'medium',
    canRetry: true,
    suggestions: [
      'Check network speed',
      'Retry with better connection',
      'Try at different time',
    ],
  },
  '11001': {
    code: 11001,
    title: 'Host Not Found',
    description: 'Host not found in DNS',
    category: 'network',
    severity: 'medium',
    canRetry: true,
    suggestions: [
      'Check URL spelling',
      'Verify DNS settings',
      'Try different DNS server',
    ],
  },
  '11002': {
    code: 11002,
    title: 'Host Not Found',
    description: 'Host not found in DNS resolution',
    category: 'network',
    severity: 'medium',
    canRetry: true,
    suggestions: [
      'Check internet connection',
      'Verify URL is correct',
      'Try different DNS provider',
    ],
  },
  '11003': {
    code: 11003,
    title: 'Non-recoverable Error',
    description: 'Non-recoverable network error',
    category: 'network',
    severity: 'high',
    canRetry: false,
    suggestions: [
      'Check network configuration',
      'Contact network administrator',
      'Try different network',
    ],
  },
  '11004': {
    code: 11004,
    title: 'No Data Record',
    description: 'Valid name, no data record of requested type',
    category: 'network',
    severity: 'medium',
    canRetry: true,
    suggestions: [
      'Check URL format',
      'Verify domain exists',
      'Try alternative URL',
    ],
  },
  '11005': {
    code: 11005,
    title: 'No Route to Host',
    description: 'No route to host',
    category: 'network',
    severity: 'high',
    canRetry: true,
    suggestions: [
      'Check network routing',
      'Verify internet connection',
      'Try different network',
    ],
  },

  // Negative error codes (DNS errors)
  '-2': {
    code: -2,
    title: 'DNS Resolution Failed',
    description: 'Name or service not known',
    category: 'network',
    severity: 'medium',
    canRetry: true,
    suggestions: [
      'Check internet connection',
      'Verify URL is correct',
      'Try different DNS server',
    ],
  },
  '-3': {
    code: -3,
    title: 'DNS Temporary Failure',
    description: 'Temporary failure in name resolution',
    category: 'network',
    severity: 'medium',
    canRetry: true,
    suggestions: [
      'Wait and retry',
      'Check DNS settings',
      'Try different DNS provider',
    ],
  },

  // Windows Error 32 (Special case)
  '32_win': {
    code: 32,
    title: 'File In Use',
    description: 'File is being used by another process',
    category: 'system',
    severity: 'medium',
    canRetry: true,
    suggestions: [
      'Close applications using the file',
      'Wait and retry',
      'Choose different filename',
    ],
  },

  // HTTPS/SSL specific errors
  https_pool_timeout: {
    code: 'HTTPS_POOL_TIMEOUT',
    title: 'HTTPS Connection Pool Timeout',
    description: 'HTTPS connection pool timed out while reading data',
    category: 'network',
    severity: 'medium',
    canRetry: true,
    suggestions: [
      'Check network stability and speed',
      'Retry the download with slower connection',
      'Try downloading at a different time',
      'Consider using a VPN if connection is throttled',
    ],
  },
  https_pool_error: {
    code: 'HTTPS_POOL_ERROR',
    title: 'HTTPS Connection Pool Error',
    description: 'HTTPS connection pool encountered an error',
    category: 'network',
    severity: 'medium',
    canRetry: true,
    suggestions: [
      'Check internet connection stability',
      'Verify DNS settings',
      'Try using different network',
      'Retry the download',
    ],
  },
  ssl_handshake_error: {
    code: 'SSL_HANDSHAKE_ERROR',
    title: 'SSL Handshake Failed',
    description: 'SSL/TLS handshake failed during HTTPS connection',
    category: 'network',
    severity: 'medium',
    canRetry: true,
    suggestions: [
      'Check system date and time',
      'Update certificates or browser',
      'Try using different network',
      'Disable antivirus/firewall temporarily',
    ],
  },
  ssl_certificate_error: {
    code: 'SSL_CERTIFICATE_ERROR',
    title: 'SSL Certificate Error',
    description: 'SSL certificate verification failed',
    category: 'network',
    severity: 'medium',
    canRetry: true,
    suggestions: [
      'Check system date and time',
      'Update system certificates',
      'Try different network or VPN',
      'Contact network administrator',
    ],
  },

  // HTTP Error codes
  '302': {
    code: 302,
    title: 'Temporary Redirect',
    description: 'Resource temporarily moved',
    category: 'http',
    severity: 'low',
    canRetry: true,
    suggestions: [
      'Should automatically follow redirect',
      'Check if URL has changed',
      'Try direct URL if available',
    ],
  },
  '400': {
    code: 400,
    title: 'Bad Request',
    description: 'Server cannot process malformed request',
    category: 'http',
    severity: 'medium',
    canRetry: false,
    suggestions: [
      'Check URL format',
      'Verify request parameters',
      'Try different format options',
    ],
  },
  '401': {
    code: 401,
    title: 'Unauthorized',
    description: 'Authentication required',
    category: 'http',
    severity: 'medium',
    canRetry: false,
    suggestions: [
      'Check login credentials',
      'Verify account permissions',
      'Try different authentication method',
    ],
  },
  '403': {
    code: 403,
    title: 'Forbidden',
    description: 'Access denied to resource',
    category: 'http',
    severity: 'medium',
    canRetry: false,
    suggestions: [
      'Check account permissions',
      'Verify content is publicly available',
      'Try different access method',
    ],
  },
  '404': {
    code: 404,
    title: 'Not Found',
    description: 'Resource not found on server',
    category: 'http',
    severity: 'medium',
    canRetry: false,
    suggestions: [
      'Check URL spelling',
      'Verify content still exists',
      'Try searching for alternative source',
    ],
  },
  '405': {
    code: 405,
    title: 'Method Not Allowed',
    description: 'HTTP method not supported',
    category: 'http',
    severity: 'medium',
    canRetry: false,
    suggestions: [
      'Try different access method',
      'Check API documentation',
      'Contact server administrator',
    ],
  },
  '406': {
    code: 406,
    title: 'Not Acceptable',
    description: 'Server cannot provide requested format',
    category: 'http',
    severity: 'medium',
    canRetry: true,
    suggestions: [
      'Try different format',
      'Check available formats',
      'Modify request headers',
    ],
  },
  '410': {
    code: 410,
    title: 'Gone',
    description: 'Resource permanently removed',
    category: 'http',
    severity: 'high',
    canRetry: false,
    suggestions: [
      'Content no longer available',
      'Look for alternative source',
      'Check if moved to new location',
    ],
  },
  '429': {
    code: 429,
    title: 'Too Many Requests',
    description: 'Rate limit exceeded',
    category: 'http',
    severity: 'medium',
    canRetry: true,
    suggestions: [
      'Wait before retrying',
      'Use slower download rate',
      'Try at different time',
    ],
  },
  '451': {
    code: 451,
    title: 'Unavailable For Legal Reasons',
    description: 'Content blocked due to legal restrictions',
    category: 'http',
    severity: 'high',
    canRetry: false,
    suggestions: [
      'Content legally restricted',
      'Try different region/VPN',
      'Look for alternative source',
    ],
  },
  '472': {
    code: 472,
    title: 'Connection Timed Out',
    description: 'Connection attempt timed out',
    category: 'http',
    severity: 'medium',
    canRetry: true,
    suggestions: [
      'Check network speed',
      'Retry with better connection',
      'Try at different time',
    ],
  },
  '475': {
    code: 475,
    title: 'HTTP Error 475',
    description: 'Specific HTTP error (varies by implementation)',
    category: 'http',
    severity: 'medium',
    canRetry: true,
    suggestions: [
      'Check server documentation',
      'Try different approach',
      'Contact server administrator',
    ],
  },
  '500': {
    code: 500,
    title: 'Internal Server Error',
    description: 'Server encountered an error',
    category: 'http',
    severity: 'medium',
    canRetry: true,
    suggestions: [
      'Server-side issue',
      'Try again later',
      'Contact server administrator',
    ],
  },
  '503': {
    code: 503,
    title: 'Service Unavailable',
    description: 'Server temporarily unavailable',
    category: 'http',
    severity: 'medium',
    canRetry: true,
    suggestions: [
      'Server under maintenance',
      'Try again later',
      'Check server status',
    ],
  },

  // YouTube-specific errors
  youtube_format_unavailable: {
    code: 'YOUTUBE_FORMAT_UNAVAILABLE',
    title: 'Format Not Available',
    description: 'Network was unable to retrieve format information',
    category: 'ytdlp',
    severity: 'medium',
    canRetry: true,
    suggestions: [
      'Try again in a few moments',
      'Network temporarily unable to retrieve format data',
      'Check internet connection stability',
      'Try using different quality settings',
    ],
  },
};

/**
 * Get error information for a specific error code
 */
export function getErrorCodeInfo(errorCode: number | string): ErrorCodeInfo {
  const codeStr = String(errorCode);

  // Check direct match first
  if (ERROR_CODE_MAP[codeStr]) {
    return ERROR_CODE_MAP[codeStr];
  }

  // Check for Windows error 32 special case
  if (codeStr === '32' && process.platform === 'win32') {
    return ERROR_CODE_MAP['32_win'];
  }

  // Default unknown error
  return {
    code: errorCode,
    title: 'Unknown Error',
    description: `Unknown error code: ${errorCode}`,
    category: 'unknown',
    severity: 'medium',
    canRetry: true,
    suggestions: [
      'Check logs for more details',
      'Try again with different settings',
      'Contact support if problem persists',
    ],
  };
}

/**
 * Parse error code from log messages
 */
export function parseErrorCodeFromLog(
  logMessage: string,
): number | string | null {
  // Look for YouTube format errors first (most specific)
  if (
    logMessage.includes('[youtube]') &&
    logMessage.includes('Requested format is not available')
  ) {
    return 'youtube_format_unavailable';
  }

  // Look for HTTPS connection pool errors first (most specific)
  if (logMessage.includes('HTTPSConnectionPool')) {
    if (
      logMessage.includes('Read timed out') ||
      logMessage.includes('timeout')
    ) {
      return 'https_pool_timeout';
    } else {
      return 'https_pool_error';
    }
  }

  // Look for SSL/TLS errors
  if (logMessage.includes('SSL') || logMessage.includes('TLS')) {
    if (logMessage.includes('handshake') || logMessage.includes('HANDSHAKE')) {
      return 'ssl_handshake_error';
    } else if (
      logMessage.includes('certificate') ||
      logMessage.includes('CERTIFICATE')
    ) {
      return 'ssl_certificate_error';
    }
  }

  // Look for exit code pattern
  const exitCodeMatch = logMessage.match(/exited with code[:\s]+(\d+)/i);
  if (exitCodeMatch) {
    return parseInt(exitCodeMatch[1], 10);
  }

  // Look for error code pattern
  const errorCodeMatch = logMessage.match(/error[:\s]+(\d+)/i);
  if (errorCodeMatch) {
    return parseInt(errorCodeMatch[1], 10);
  }

  // Look for errno pattern
  const errnoMatch = logMessage.match(/errno[:\s]+(-?\d+)/i);
  if (errnoMatch) {
    return parseInt(errnoMatch[1], 10);
  }

  // Look for HTTP error pattern
  const httpMatch = logMessage.match(/HTTP[:\s]+(\d{3})/i);
  if (httpMatch) {
    return parseInt(httpMatch[1], 10);
  }

  return null;
}

/**
 * Generate user-friendly error message
 */
export function generateErrorMessage(
  errorCode: number | string,
  logMessage?: string,
): string {
  const errorInfo = getErrorCodeInfo(errorCode);

  let message = `${errorInfo.title}: ${errorInfo.description}`;

  if (errorInfo.suggestions.length > 0) {
    message += `\n\nSuggestions:\n${errorInfo.suggestions
      .map((s) => `• ${s}`)
      .join('\n')}`;
  }

  return message;
}

/**
 * Get error severity color class
 */
export function getErrorSeverityColor(errorCode: number | string): string {
  const errorInfo = getErrorCodeInfo(errorCode);

  switch (errorInfo.severity) {
    case 'low':
      return 'text-yellow-600 dark:text-yellow-400';
    case 'medium':
      return 'text-orange-600 dark:text-orange-400';
    case 'high':
      return 'text-red-600 dark:text-red-400';
    default:
      return 'text-gray-600 dark:text-gray-400';
  }
}

/**
 * Check if error is retryable
 */
export function isRetryableError(errorCode: number | string): boolean {
  const errorInfo = getErrorCodeInfo(errorCode);
  return errorInfo.canRetry;
}
