/**
 * Backward compatibility wrapper for useAxios
 *
 * DEPRECATED: Use @/services/api/httpClient instead
 *
 * This file re-exports the new HTTP client to maintain backward compatibility.
 */

export { httpClient as instance, POST } from '@/services/api/httpClient';

