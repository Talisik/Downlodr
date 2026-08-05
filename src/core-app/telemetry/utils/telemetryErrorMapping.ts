import {
    getErrorCodeInfo,
    parseErrorCodeFromLog,
} from '@/downlodr/utils/error/errorCodeHelper';

/**
 * Simple telemetry error mapper - ONE function, ONE clean return
 */
export class TelemetryErrorMapper {
  /**
   * Create complete telemetry attributes in one clean return
   */
  public static createTelemetryAttributes({
    error,
    logMessage,
    errorCode,
    // Download context
    format,
    quality,
    downloadName,
    downloadId,
    progress,
    location,
    fileExtension,
    // Session context
    sessionDurationSeconds,
    userAction,
    reportSource = 'application',
    downloadLogSnippet,
  }: {
    error?: Error;
    logMessage?: string;
    errorCode?: number | string;
    // Download context (optional)
    format?: string;
    quality?: string;
    downloadName?: string;
    downloadId?: string;
    progress?: number;
    location?: string;
    fileExtension?: string;
    // Session context (optional)
    sessionDurationSeconds?: number;
    userAction?: string;
    reportSource?: string;
    downloadLogSnippet?: string;
  }) {
    // Determine error code from multiple sources
    let detectedErrorCode: number | string | null = null;

    // Priority 1: Explicit error code
    if (errorCode !== undefined) {
      detectedErrorCode = errorCode;
    }
    // Priority 2: Parse from log message
    else if (logMessage) {
      detectedErrorCode = parseErrorCodeFromLog(logMessage);
    }
    // Priority 3: Parse from error message
    else if (error?.message) {
      detectedErrorCode = parseErrorCodeFromLog(error.message);
    }

    // Get error info if we have a code
    let errorInfo = null;
    if (detectedErrorCode !== null) {
      errorInfo = getErrorCodeInfo(detectedErrorCode);
    }

    // Return ONLY the specified attributes
    return {
      component: 'downlodr_core',
      error_stack: error?.stack || undefined,
      error_code: errorInfo?.code || detectedErrorCode || undefined,
      error_description: errorInfo?.description || undefined,
      format: format || undefined,
      quality: quality || undefined,
      download_name: downloadName || undefined,
      download_id: downloadId || undefined,
      progress: progress,
      location: location || undefined,
      file_extension: fileExtension || undefined,
      session_duration_seconds: sessionDurationSeconds,
      user_action: userAction || undefined,
      report_source: reportSource,
      download_log_snippet:
        extractErrorMessages(downloadLogSnippet) || undefined,
    };
  }
}

/**
 * Simple utility functions for common error scenarios
 */
export const TelemetryErrorUtils = {
  downloadFailed: (
    params: Parameters<
      typeof TelemetryErrorMapper.createTelemetryAttributes
    >[0],
  ) => TelemetryErrorMapper.createTelemetryAttributes(params),

  networkError: (
    params: Parameters<
      typeof TelemetryErrorMapper.createTelemetryAttributes
    >[0],
  ) => TelemetryErrorMapper.createTelemetryAttributes(params),

  systemError: (
    params: Parameters<
      typeof TelemetryErrorMapper.createTelemetryAttributes
    >[0],
  ) => TelemetryErrorMapper.createTelemetryAttributes(params),

  ytdlpError: (
    params: Parameters<
      typeof TelemetryErrorMapper.createTelemetryAttributes
    >[0],
  ) => TelemetryErrorMapper.createTelemetryAttributes(params),
};

export default TelemetryErrorMapper;

/**
 * Usage examples - Clean and focused
 */
export const TelemetryErrorMappingExamples = {
  /**
   * Complete example with all specified attributes
   */
  fullExample: () => {
    const attributes = TelemetryErrorMapper.createTelemetryAttributes({
      error: new Error('Network timeout'),
      logMessage:
        "HTTPSConnectionPool(host='www.youtube.com', port=443): Read timed out.",
      format: 'mp4',
      quality: '720p',
      downloadName: 'My Video',
      downloadId: 'abc123',
      progress: 45,
      location: '/downloads/',
      fileExtension: 'mp4',
      sessionDurationSeconds: 120,
      userAction: 'download_start',
      downloadLogSnippet: 'Starting download...',
    });

    console.log('Complete Telemetry Attributes:', attributes);
    /*
    Returns exactly what you specified:
    {
      component: 'downlodr_core',
      error_stack: '...',
      error_code: 'HTTPS_POOL_TIMEOUT',
      error_description: 'HTTPS connection pool timed out while reading data',
      format: 'mp4',
      quality: '720p',
      download_name: 'My Video',
      download_id: 'abc123',
      progress: 45,
      location: '/downloads/',
      file_extension: 'mp4',
      session_duration_seconds: 120,
      user_action: 'download_start',
      report_source: 'application',
      download_log_snippet: 'Starting download...'
    }
    */

    return attributes;
  },

  /**
   * Simple error code example
   */
  simpleExample: () => {
    const attributes = TelemetryErrorMapper.createTelemetryAttributes({
      errorCode: 404,
      format: 'mp4',
    });

    console.log('Simple Telemetry Attributes:', attributes);
    return attributes;
  },

  /**
   * Using utility functions
   */
  utilityExample: () => {
    const attributes = TelemetryErrorUtils.downloadFailed({
      error: new Error('Permission denied'),
      logMessage: 'Process exited with code: 13',
      downloadName: 'Test Video',
      progress: 10,
    });

    console.log('Download Failed Attributes:', attributes);
    return attributes;
  },
};

/**
 * Extract error messages from logs for better telemetry context
 */
export const extractErrorMessages = (logContent: string): string => {
  if (!logContent) return 'No logs available';
  const lines = logContent.split('\n');
  const errorLines: string[] = [];
  const errorKeywords = [
    'ERROR:',
    'Error:',
    'error:',
    'FAILED:',
    'Failed:',
    'failed:',
    'EXCEPTION:',
    'Exception:',
    'exception:',
  ];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (errorKeywords.some((keyword) => line.includes(keyword))) {
      console.log(line);
      errorLines.push(line);
    }
  }

  // If no specific errors found, look for warnings
  if (errorLines.length === 0) {
    const warningKeywords = [
      'WARNING:',
      'Warning:',
      'warning:',
      'WARN:',
      'Warn:',
      'warn:',
    ];
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (warningKeywords.some((keyword) => line.includes(keyword))) {
        errorLines.push(line);
      }
    }
  }

  // If still no errors found, return last few lines that might contain relevant info
  if (errorLines.length === 0) {
    const lastLines = lines.slice(-5).filter((line) => line.trim());
    return lastLines.length > 0
      ? lastLines.join('\n')
      : 'No specific error messages found in logs';
  }

  return errorLines.join('\n');
};
