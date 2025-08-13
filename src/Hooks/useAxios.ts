import type { AxiosResponse } from 'axios';
import axios from 'axios';

// Create axios instance
const instance = axios.create({
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json',
  },
});

/**
 * Sends a POST request using the Axios instance.
 *
 * @param {Object} args - The arguments for the POST request.
 * @returns {Promise<AxiosResponse<R>>} The response from the server.
 */
const POST = async <R>(args: any): Promise<AxiosResponse<R>> => {
  return instance({
    ...args,
    method: 'POST',
  });
};

export { instance, POST };
// eslint-disable-next-line prettier/prettier

