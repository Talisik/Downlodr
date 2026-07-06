/**
 * Telemetry service
 * Business logic for telemetry collection and reporting
 */

import {
  getTelemetryId,
  useTelemetryStore,
} from '@/core-app/store/telemetryStore';
import {
  AnyValue,
  AppMetadata,
  DeviceInfo,
  HostInfo,
  KeyValue,
  LogRecordInput,
  OtlpLogRecord,
  ResourceInfo,
  TelemetryConfig,
  TelemetryPayload,
  UserInfo,
} from '@/core-app/telemetry/schema/telemetryTypes';
import { sendTelemetryData } from './telemetryAPIService';
import { TelemetryErrorMapper } from './telemetryErrorMapping';

interface PackageInfo {
  version: string;
}

/** Converts a JS primitive into an OTLP AnyValue; returns null for nullish values so callers can drop the key. */
function toAnyValue(value: unknown): AnyValue | null {
  if (value === undefined || value === null || value === '') return null;
  if (typeof value === 'string') return { stringValue: value };
  if (typeof value === 'boolean') return { boolValue: value };
  if (typeof value === 'number') {
    return Number.isInteger(value)
      ? { intValue: value }
      : { doubleValue: value };
  }
  return { stringValue: String(value) };
}

/** Flattens a plain object into an OTLP attributes array, dropping nullish/empty values. */
function toKeyValueList(attributes: Record<string, unknown>): KeyValue[] {
  return Object.entries(attributes).reduce<KeyValue[]>((list, [key, value]) => {
    const anyValue = toAnyValue(value);
    if (anyValue) list.push({ key, value: anyValue });
    return list;
  }, []);
}

/** Converts an ISO-8601 timestamp into a nanosecond-precision Unix epoch string, as required by OTLP. */
function toUnixNano(isoTimestamp: string): string {
  const millis = new Date(isoTimestamp).getTime();
  return `${BigInt(millis) * BigInt(1_000_000)}`;
}

/**
 * Telemetry service for Downlodr
 * Combines error telemetry and general telemetry into one clean API
 */
export class TelemetryService {
  private config: Required<TelemetryConfig>;
  private resource: ResourceInfo | null = null;
  private hostInfo: HostInfo | null = null;
  private deviceInfo: DeviceInfo | null = null;
  private appMetadata: AppMetadata | null = null;
  private userInfo: UserInfo | null = null;
  private packageInfo: PackageInfo = { version: '1.7.2-stable' };

  constructor(config: TelemetryConfig) {
    this.config = {
      apiEndpoint: config.apiEndpoint,
      apiKey: config.apiKey || '',
      batchSize: config.batchSize || 10,
      flushInterval: config.flushInterval || 30000,
      enabled: config.enabled !== false,
      retryAttempts: config.retryAttempts || 3,
    };
  }

  /**
   * Initialize the telemetry service with system information
   */
  public async init(): Promise<void> {
    if (!this.config.enabled) return;

    try {
      this.packageInfo = await this.getPackageJson();
      this.hostInfo = await this.generateHostInfo();
      this.resource = await this.generateResourceInfo();
      this.appMetadata = await this.generateAppMetadata();
      this.userInfo = await this.generateUserInfo();
      this.deviceInfo = await this.generateDeviceInfo();
    } catch (error) {
      console.error('Failed to initialize telemetry:', error);
    }
  }

  /**
   * Send download error telemetry - main use case
   */
  public async sendDownloadError({
    error,
    logMessage,
    downloadContext,
  }: {
    error?: Error;
    logMessage?: string;
    downloadContext: {
      url?: string;
      format?: string;
      quality?: string;
      downloadName?: string;
      downloadId?: string;
      progress?: number;
      location?: string;
      fileExtension?: string;
      sessionDurationSeconds?: number;
    };
  }): Promise<boolean> {
    if (!this.isEnabled()) return false;

    try {
      // Create telemetry attributes using our simplified mapper
      const attributes = TelemetryErrorMapper.createTelemetryAttributes({
        error,
        logMessage,
        ...downloadContext,
        userAction: 'automatic_error_report',
        reportSource: 'application',
        downloadLogSnippet: logMessage,
      });

      const logRecord: LogRecordInput = {
        timestamp: new Date().toISOString(),
        severity_number: 17, // ERROR level
        severity_text: 'ERROR',
        body: `Download failed: ${downloadContext.downloadName || 'Unknown'}`,
        attributes,
      };

      const payload = this.createTelemetryPayload([logRecord]);
      return await sendTelemetryData(payload);
    } catch (error) {
      console.error('Failed to send download error telemetry:', error);
      return false;
    }
  }

  /**
   * Create complete telemetry payload in OTLP/HTTP JSON logs format
   */
  private createTelemetryPayload(
    logRecords: LogRecordInput[],
  ): TelemetryPayload {
    const resource = this.resource || this.getDefaultResourceInfo();
    const host = this.hostInfo;
    const user = this.userInfo;

    const resourceAttributes = toKeyValueList({
      'service.name': resource.service_name,
      'service.version': resource.service_version,
      'service.namespace': resource.service_namespace,
      'service.instance.id': resource.service_instance_id,
      'deployment.environment': resource.deployment_environment,
      'telemetry.sdk.name': resource.telemetry_sdk_name,
      'telemetry.sdk.language': resource.telemetry_sdk_language,
      'telemetry.sdk.version': resource.telemetry_sdk_version,
      'client.application': resource.client_application,
      'client.platform': resource.client_platform,
      'client.language': resource.client_language,
      'client.timezone': resource.client_timezone,
      'browser.name': resource.browser_name,
      'browser.version': resource.browser_version,
      source: 'electron-app',
    });

    const traceId = this.generateTraceId();
    const spanId = this.generateSpanId();

    const otlpLogRecords: OtlpLogRecord[] = logRecords.map((record) => {
      const timeUnixNano = toUnixNano(record.timestamp);
      return {
        timeUnixNano,
        observedTimeUnixNano: timeUnixNano,
        severityNumber: record.severity_number,
        severityText: record.severity_text,
        body: { stringValue: record.body },
        attributes: toKeyValueList({
          ...record.attributes,
          host_name: host?.host_name,
          os_name: host?.os_name,
          user_id: user?.user_id,
        }),
        traceId,
        spanId,
        flags: 1,
      };
    });

    return {
      resourceLogs: [
        {
          resource: { attributes: resourceAttributes },
          scopeLogs: [
            {
              scope: { name: 'downlodr-telemetry', version: '1.0.0' },
              logRecords: otlpLogRecords,
            },
          ],
        },
      ],
    };
  }

  /**
   * Check if telemetry is enabled (both config and user consent)
   */
  private isEnabled(): boolean {
    if (!this.config.enabled) return false;

    return useTelemetryStore.getState().settings.telemetryEnabled === true;
  }

  // System info generation methods
  private async generateUserInfo(): Promise<UserInfo> {
    try {
      const deviceInfo = await window.downlodrFunctions.getHostInfo();
      const telemetryId = getTelemetryId();

      return {
        user_id: telemetryId || null,
        user_name: deviceInfo.user_name,
        user_email: null,
        session_id: null,
      };
    } catch {
      return { user_id: getTelemetryId() || null };
    }
  }

  private async generateResourceInfo(): Promise<ResourceInfo> {
    try {
      const version = this.packageInfo.version || '1.0.0';
      const browserInfo = await window.downlodrFunctions.getBrowserInfo();
      return {
        service_name: 'downlodr-electron-desktop-app',
        service_version: version,
        service_namespace: 'observability',
        service_instance_id: getTelemetryId(),
        deployment_environment: 'prod',
        telemetry_sdk_name: 'downlodr-telemetry',
        telemetry_sdk_language: 'javascript',
        telemetry_sdk_version: '1.0.0',
        client_application: 'Electron',
        client_platform: 'desktop',
        client_language:
          Intl.DateTimeFormat().resolvedOptions().locale || 'en-US',
        client_timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        browser_name: browserInfo.browser_name,
        browser_version: browserInfo.browser_version,
        browser_user_agent: `${browserInfo.browser_name}/${browserInfo.browser_version} (${browserInfo.browser_arch}) Electron/${version}`,
      };
    } catch {
      return this.getDefaultResourceInfo();
    }
  }

  private getDefaultResourceInfo(): ResourceInfo {
    const version = this.packageInfo.version || '1.0.0';
    return {
      service_name: 'downlodr-electron-desktop-app',
      service_version: version,
      service_namespace: 'observability',
      service_instance_id: getTelemetryId(),
      deployment_environment: 'prod',
      telemetry_sdk_name: 'downlodr-telemetry',
      telemetry_sdk_language: 'javascript',
      telemetry_sdk_version: '1.0.0',
      client_application: 'Electron',
      client_platform: 'desktop',
      client_language:
        Intl.DateTimeFormat().resolvedOptions().locale || 'en-US',
      client_timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      browser_name: 'Electron',
      browser_version: 'unknown',
      browser_user_agent: 'Chrome',
    };
  }

  private async generateHostInfo(): Promise<HostInfo> {
    try {
      const hostInfo = await window.downlodrFunctions.getHostInfo();
      const telemetryId = getTelemetryId();

      return {
        host_name: hostInfo.host_name,
        host_id: telemetryId || hostInfo.host_id,
        host_type: hostInfo.host_type,
        host_arch: hostInfo.host_arch,
        os_type: hostInfo.os_type,
        os_description: hostInfo.os_description,
        os_name: hostInfo.os_name,
        os_version: hostInfo.os_version,
        cpu_model: hostInfo.cpu_model,
        cpu_cores: hostInfo.cpu_cores,
        cpu_threads: hostInfo.cpu_threads,
        memory_total_gb: hostInfo.memory_total_gb,
        memory_available_gb: hostInfo.memory_available_gb,
      };
    } catch {
      return {
        host_name: 'unknown',
        host_id: getTelemetryId() || 'unknown',
        host_type: 'desktop',
        host_arch: 'x64',
        os_type: 'unknown',
        os_name: 'unknown',
      };
    }
  }

  private async generateDeviceInfo(): Promise<DeviceInfo> {
    const telemetryId = getTelemetryId();
    return {
      device_id: telemetryId || null,
      device_manufacturer: null,
      screen_width: null,
      screen_height: null,
      screen_density: null,
      screen_resolution: null,
      screen_color_depth: null,
    };
  }

  private async generateAppMetadata(): Promise<AppMetadata> {
    const version = this.packageInfo.version || '1.0.0';
    return {
      app_version: version,
      build_number: '07/25/2025',
      build_date: '07/25/2025',
      git_commit: 'Build',
      feature_flags: {
        telemetry_enabled: true,
        error_reporting: true,
      },
    };
  }

  private async getPackageJson(): Promise<PackageInfo> {
    try {
      const currentVersion = await window.updateAPI.getCurrentVersion();
      return { version: currentVersion };
    } catch {
      return { version: '1.7.2' };
    }
  }

  private generateTraceId(): string {
    return Array.from({ length: 32 }, () =>
      Math.floor(Math.random() * 16).toString(16),
    ).join('');
  }

  private generateSpanId(): string {
    return Array.from({ length: 16 }, () =>
      Math.floor(Math.random() * 16).toString(16),
    ).join('');
  }

  // Getter methods for backward compatibility
  public getResource(): ResourceInfo {
    return this.resource || this.getDefaultResourceInfo();
  }

  public getHostInfo(): HostInfo | null {
    return this.hostInfo;
  }

  public getUser(): UserInfo | null {
    return this.userInfo;
  }

  public getDeviceInfo(): DeviceInfo | null {
    return this.deviceInfo;
  }

  public getAppMetadata(): AppMetadata | null {
    return this.appMetadata;
  }
}

// Global instance helper
let globalTelemetry: TelemetryService | null = null;

export const initializeTelemetry = async (
  config: TelemetryConfig,
): Promise<TelemetryService> => {
  globalTelemetry = new TelemetryService(config);
  await globalTelemetry.init();
  return globalTelemetry;
};

export const getTelemetry = (): TelemetryService | null => {
  return globalTelemetry;
};

export default TelemetryService;
