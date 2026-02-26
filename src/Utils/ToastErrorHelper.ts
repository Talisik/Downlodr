/**
 * Toast Error Helper - Generates detailed error explanations for toast notifications
 *
 * This helper extracts error information from download logs and provides
 * user-friendly error messages for toast notifications, similar to the
 * ActivityHelper logic but optimized for toast display.
 */

import { SearchableDownload } from '@/Store/taskbarDownloadStore';
import { getErrorCodeInfo, parseErrorCodeFromLog } from './ErrorCodeHelper';

/**
 * Generate error message for toast notifications (without suggestions)
 * Returns only the error title and description, optimized for toast display
 */
export function generateErrorMessageForToast(
  errorCode: number | string,
): string {
  const errorInfo = getErrorCodeInfo(errorCode);
  return `${errorInfo.title}: ${errorInfo.description}`;
}

/**
 * Generate detailed error explanation for toast notifications
 * Extracts error information from download logs and creates user-friendly messages
 */
export function generateErrorExplanation(download: SearchableDownload): string {
  if (!download.log) {
    return 'Download failed - check logs for details';
  }

  let errorMessage = 'Download failed - check logs for details';
  let errorCode: number | string | undefined;

  // Try to extract error code from logs
  const parsedErrorCode = parseErrorCodeFromLog(download.log);
  if (parsedErrorCode !== null) {
    errorCode = parsedErrorCode;
    errorMessage = generateErrorMessageForToast(errorCode);
  } else {
    // Try to extract more specific error from logs even without error code
    const logLines = download.log.split('\n');
    const errorLine = logLines.find(
      (line) =>
        line.includes('ERROR') ||
        line.includes('Failed') ||
        line.includes('Error') ||
        line.includes('[youtube]') ||
        line.includes('HTTP Error') ||
        line.includes('URLError') ||
        line.includes('ConnectionError') ||
        line.includes('HTTPSConnectionPool') ||
        line.includes('SSL') ||
        line.includes('TLS'),
    );

    if (errorLine) {
      errorMessage = errorLine.trim();

      // Check for YouTube format errors first (most specific)
      if (
        errorLine.includes('[youtube]') &&
        errorLine.includes('Requested format is not available')
      ) {
        errorCode = 'youtube_format_unavailable';
        errorMessage = generateErrorMessageForToast(errorCode);
      } else if (errorLine.includes('HTTPSConnectionPool')) {
        if (
          errorLine.includes('Read timed out') ||
          errorLine.includes('timeout')
        ) {
          errorCode = 'https_pool_timeout';
          errorMessage = generateErrorMessageForToast(errorCode);
        } else {
          errorCode = 'https_pool_error';
          errorMessage = generateErrorMessageForToast(errorCode);
        }
      } else if (errorLine.includes('SSL') || errorLine.includes('TLS')) {
        // Handle SSL/TLS errors
        if (
          errorLine.includes('handshake') ||
          errorLine.includes('HANDSHAKE')
        ) {
          errorCode = 'ssl_handshake_error';
          errorMessage = generateErrorMessageForToast(errorCode);
        } else if (
          errorLine.includes('certificate') ||
          errorLine.includes('CERTIFICATE')
        ) {
          errorCode = 'ssl_certificate_error';
          errorMessage = generateErrorMessageForToast(errorCode);
        }
      } else if (errorLine.includes('HTTP Error')) {
        const httpMatch = errorLine.match(/HTTP Error (\d{3})/);
        if (httpMatch) {
          errorCode = parseInt(httpMatch[1], 10);
          errorMessage = generateErrorMessageForToast(errorCode);
        }
      } else if (errorLine.includes('URLError')) {
        // Handle URLError patterns
        if (errorLine.includes('Name or service not known')) {
          errorCode = -2;
          errorMessage = generateErrorMessageForToast(errorCode);
        } else if (errorLine.includes('Temporary failure in name resolution')) {
          errorCode = -3;
          errorMessage = generateErrorMessageForToast(errorCode);
        }
      } else if (errorLine.includes('Connection')) {
        // Handle connection errors
        if (errorLine.includes('Connection refused')) {
          errorCode = 61;
          errorMessage = generateErrorMessageForToast(errorCode);
        } else if (errorLine.includes('Connection reset')) {
          errorCode = 54;
          errorMessage = generateErrorMessageForToast(errorCode);
        } else if (errorLine.includes('Connection timed out')) {
          errorCode = 110;
          errorMessage = generateErrorMessageForToast(errorCode);
        }
      }
    }
  }

  return errorMessage;
}
