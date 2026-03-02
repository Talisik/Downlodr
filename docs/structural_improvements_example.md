# Structural Improvements - Implementation Example

## Example: Service Layer Refactoring

This document shows a concrete example of how to refactor the current code structure into a cleaner service layer.

### Current State

**File: `src/DataServices/sendErrorLog.ts`**
```typescript
import { POST } from '@/Hooks/useAxios';
import { TelemetryPayload } from '@/Utils/Telemetry/telemetryTypes';
import { config } from '../config';

const useSendErrorLog = async (payload: TelemetryPayload): Promise<boolean> => {
  const response = await POST({
    headers: {
      'Content-Type': 'application/json',
    },
    url: config.telemetry.endpoint,
    data: payload,
  });
  return true;
};

export default useSendErrorLog;
```

**Issues:**
1. Named like a hook but not a hook (`use*` prefix)
2. No error handling
3. Always returns `true` regardless of success
4. Mixed concerns (API call + business logic)

### Refactored State

#### Step 1: Create Base HTTP Client

**File: `src/services/api/httpClient.ts`**
```typescript
import axios, { AxiosInstance, AxiosRequestConfig, AxiosResponse } from 'axios';

export interface HttpClientConfig {
  baseURL?: string;
  timeout?: number;
  headers?: Record<string, string>;
}

export class HttpClient {
  private client: AxiosInstance;

  constructor(config: HttpClientConfig = {}) {
    this.client = axios.create({
      baseURL: config.baseURL,
      timeout: config.timeout || 30000,
      headers: {
        'Content-Type': 'application/json',
        ...config.headers,
      },
    });

    this.setupInterceptors();
  }

  private setupInterceptors(): void {
    // Request interceptor
    this.client.interceptors.request.use(
      (config) => {
        // Add auth tokens, logging, etc.
        return config;
      },
      (error) => Promise.reject(error),
    );

    // Response interceptor
    this.client.interceptors.response.use(
      (response) => response,
      (error) => {
        // Handle common errors, retries, etc.
        return Promise.reject(error);
      },
    );
  }

  async get<T = unknown>(
    url: string,
    config?: AxiosRequestConfig,
  ): Promise<AxiosResponse<T>> {
    return this.client.get<T>(url, config);
  }

  async post<T = unknown>(
    url: string,
    data?: unknown,
    config?: AxiosRequestConfig,
  ): Promise<AxiosResponse<T>> {
    return this.client.post<T>(url, data, config);
  }

  async put<T = unknown>(
    url: string,
    data?: unknown,
    config?: AxiosRequestConfig,
  ): Promise<AxiosResponse<T>> {
    return this.client.put<T>(url, data, config);
  }

  async delete<T = unknown>(
    url: string,
    config?: AxiosRequestConfig,
  ): Promise<AxiosResponse<T>> {
    return this.client.delete<T>(url, config);
  }
}
```

#### Step 2: Create Telemetry API Service

**File: `src/services/api/telemetryApiService.ts`**
```typescript
import { HttpClient } from './httpClient';
import { TelemetryPayload } from '@/types/telemetry';
import { config } from '@/config';

export interface TelemetryApiResponse {
  success: boolean;
  messageId?: string;
  error?: string;
}

export class TelemetryApiService {
  private client: HttpClient;

  constructor() {
    this.client = new HttpClient({
      baseURL: config.telemetry.endpoint,
      timeout: config.telemetry.timeout,
    });
  }

  async sendTelemetry(
    payload: TelemetryPayload,
  ): Promise<TelemetryApiResponse> {
    try {
      const response = await this.client.post<TelemetryApiResponse>(
        '/telemetry',
        payload,
      );

      return {
        success: true,
        messageId: response.data.messageId,
      };
    } catch (error) {
      console.error('Failed to send telemetry:', error);
      
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  async sendBatchTelemetry(
    payloads: TelemetryPayload[],
  ): Promise<TelemetryApiResponse> {
    try {
      const response = await this.client.post<TelemetryApiResponse>(
        '/telemetry/batch',
        { events: payloads },
      );

      return {
        success: true,
        messageId: response.data.messageId,
      };
    } catch (error) {
      console.error('Failed to send batch telemetry:', error);
      
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }
}

// Singleton instance
export const telemetryApiService = new TelemetryApiService();
```

#### Step 3: Create Telemetry Business Logic Service

**File: `src/services/telemetry/telemetryService.ts`**
```typescript
import { telemetryApiService } from '@/services/api/telemetryApiService';
import { TelemetryService as TelemetryCoreService } from '@/Utils/Telemetry/telemetryService';
import { TelemetryPayload } from '@/types/telemetry';

export class TelemetryService {
  private coreService: TelemetryCoreService;
  private apiService = telemetryApiService;
  private queue: TelemetryPayload[] = [];
  private flushInterval: NodeJS.Timeout | null = null;

  constructor(config: TelemetryConfig) {
    this.coreService = new TelemetryCoreService(config);
    this.startBatchProcessor();
  }

  async initialize(): Promise<void> {
    await this.coreService.init();
  }

  async sendDownloadError(params: {
    error?: Error;
    logMessage?: string;
    downloadContext: DownloadContext;
  }): Promise<boolean> {
    try {
      const payload = this.coreService.createTelemetryPayload(
        this.coreService.createErrorLogRecord(params),
      );

      // Add to queue for batch processing
      this.queue.push(payload);

      // Flush if queue is full
      if (this.queue.length >= 10) {
        await this.flushQueue();
      }

      return true;
    } catch (error) {
      console.error('Failed to queue telemetry:', error);
      return false;
    }
  }

  private async flushQueue(): Promise<void> {
    if (this.queue.length === 0) return;

    const batch = [...this.queue];
    this.queue = [];

    const result = await this.apiService.sendBatchTelemetry(batch);
    
    if (!result.success) {
      // Re-queue failed items (with retry logic)
      console.warn('Failed to send telemetry batch:', result.error);
      // Implement retry logic here
    }
  }

  private startBatchProcessor(): void {
    // Flush queue every 30 seconds
    this.flushInterval = setInterval(() => {
      this.flushQueue();
    }, 30000);
  }

  destroy(): void {
    if (this.flushInterval) {
      clearInterval(this.flushInterval);
    }
    // Flush remaining items
    this.flushQueue();
  }
}
```

#### Step 4: Update Usage

**Before:**
```typescript
import useSendErrorLog from '@/DataServices/sendErrorLog';

// In component
await useSendErrorLog(payload);
```

**After:**
```typescript
import { telemetryService } from '@/services/telemetry/telemetryService';

// In component or store
await telemetryService.sendDownloadError({
  error,
  logMessage,
  downloadContext,
});
```

### Benefits of This Refactoring

1. **Clear Separation**: API layer separate from business logic
2. **Error Handling**: Proper error handling and retry logic
3. **Testability**: Easy to mock `HttpClient` and `TelemetryApiService`
4. **Reusability**: `HttpClient` can be used for other API calls
5. **Type Safety**: Better TypeScript support
6. **Maintainability**: Easier to modify and extend

### Testing Example

**File: `src/services/api/__tests__/telemetryApiService.test.ts`**
```typescript
import { TelemetryApiService } from '../telemetryApiService';
import { HttpClient } from '../httpClient';

jest.mock('../httpClient');

describe('TelemetryApiService', () => {
  let service: TelemetryApiService;
  let mockHttpClient: jest.Mocked<HttpClient>;

  beforeEach(() => {
    mockHttpClient = new HttpClient() as jest.Mocked<HttpClient>;
    service = new TelemetryApiService();
  });

  it('should send telemetry successfully', async () => {
    const payload = { /* test payload */ };
    mockHttpClient.post.mockResolvedValue({
      data: { success: true, messageId: '123' },
    });

    const result = await service.sendTelemetry(payload);

    expect(result.success).toBe(true);
    expect(result.messageId).toBe('123');
  });

  it('should handle errors gracefully', async () => {
    const payload = { /* test payload */ };
    mockHttpClient.post.mockRejectedValue(new Error('Network error'));

    const result = await service.sendTelemetry(payload);

    expect(result.success).toBe(false);
    expect(result.error).toBe('Network error');
  });
});
```

## Migration Checklist

- [ ] Create new service structure
- [ ] Implement base `HttpClient`
- [ ] Create API service layer
- [ ] Create business logic service layer
- [ ] Update imports across codebase
- [ ] Remove old `DataServices` files
- [ ] Add tests for new services
- [ ] Update documentation

