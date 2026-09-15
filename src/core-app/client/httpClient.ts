/**
 * Base HTTP client for API requests
 * Provides a centralized axios instance with default configuration
 */

import type { AxiosRequestConfig, AxiosResponse } from 'axios';
import axios from 'axios';

// Create axios instance with default configuration
const httpClient = axios.create({
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json',
  },
});

/**
 * Sends a GET request using the HTTP client
 */
export const GET = async <T = any>(
  url: string,
  config?: AxiosRequestConfig,
): Promise<AxiosResponse<T>> => {
  return httpClient.get<T>(url, config);
};

/**
 * Sends a POST request using the HTTP client
 */
export const POST = async <T = any>(
  url: string,
  data?: any,
  config?: AxiosRequestConfig,
): Promise<AxiosResponse<T>> => {
  return httpClient.post<T>(url, data, config);
};

/**
 * Sends a PUT request using the HTTP client
 */
export const PUT = async <T = any>(
  url: string,
  data?: any,
  config?: AxiosRequestConfig,
): Promise<AxiosResponse<T>> => {
  return httpClient.put<T>(url, data, config);
};

/**
 * Sends a DELETE request using the HTTP client
 */
export const DELETE = async <T = any>(
  url: string,
  config?: AxiosRequestConfig,
): Promise<AxiosResponse<T>> => {
  return httpClient.delete<T>(url, config);
};

/**
 * Sends a PATCH request using the HTTP client
 */
export const PATCH = async <T = any>(
  url: string,
  data?: any,
  config?: AxiosRequestConfig,
): Promise<AxiosResponse<T>> => {
  return httpClient.patch<T>(url, data, config);
};

export { httpClient };
export default httpClient;
