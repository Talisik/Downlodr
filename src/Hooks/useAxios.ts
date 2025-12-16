/**
 * Backward compatibility wrapper for useAxios
 *
 * DEPRECATED: Use @/services/api/httpClient instead
 *
 * This file re-exports the new HTTP client to maintain backward compatibility.
 */

export { POST, httpClient as instance } from '@/services/api/httpClient';
