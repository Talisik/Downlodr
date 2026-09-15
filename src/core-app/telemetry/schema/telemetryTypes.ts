// OpenTelemetry OTLP-compatible telemetry types for Downlodr
// Wire format follows the OTLP/HTTP JSON logs shape (resourceLogs -> scopeLogs -> logRecords)

export interface TelemetryConfig {
  apiEndpoint: string;
  apiKey?: string;
  batchSize?: number;
  flushInterval?: number;
  enabled?: boolean;
  retryAttempts?: number;
}

export interface ResourceInfo {
  service_name: string;
  service_version: string;
  service_namespace: string;
  service_instance_id?: string | null;
  deployment_environment: string;
  telemetry_sdk_name: string;
  telemetry_sdk_language: string;
  telemetry_sdk_version: string;
  client_application: string;
  client_platform: string;
  client_language?: string;
  client_timezone?: string;
  browser_name?: string;
  browser_version?: string;
  browser_user_agent?: string;
}

export interface HostInfo {
  host_name: string;
  host_id?: string;
  host_type: string;
  host_arch: string;
  os_type: string;
  os_description?: string;
  os_name: string;
  os_version?: string;
  cpu_model?: string;
  cpu_cores?: number;
  cpu_threads?: number;
  memory_total_gb?: number;
  memory_available_gb?: number;
}

export interface UserInfo {
  user_id?: string | null;
  user_name?: string;
  user_email?: string | null;
  session_id?: string | null;
}

export interface DeviceInfo {
  device_id?: string | null;
  device_manufacturer?: string | null;
  screen_width?: number | null;
  screen_height?: number | null;
  screen_density?: number | null;
  screen_resolution?: string | null;
  screen_color_depth?: number | null;
}

export interface AppMetadata {
  app_version: string;
  build_number?: string;
  build_date?: string;
  git_commit?: string;
  feature_flags?: Record<string, boolean>;
}

// Intermediate, pre-OTLP representation of a single log entry. Built by
// TelemetryService and converted into an OtlpLogRecord before it's sent.
export interface LogRecordInput {
  timestamp: string;
  severity_number: number;
  severity_text: 'DEBUG' | 'INFO' | 'WARN' | 'ERROR' | 'FATAL';
  body: string;
  attributes?: Record<string, unknown>;
}

export enum LogLevel {
  DEBUG = 5,
  INFO = 9,
  WARN = 13,
  ERROR = 17,
  FATAL = 21,
}

export interface TelemetryEvent {
  level: LogLevel;
  message: string;
  error?: Error;
  attributes?: Record<string, any>;
}

// ---- OTLP/HTTP JSON wire format ----
// https://github.com/open-telemetry/opentelemetry-proto/blob/main/opentelemetry/proto/logs/v1/logs.proto

export interface AnyValue {
  stringValue?: string;
  intValue?: number;
  doubleValue?: number;
  boolValue?: boolean;
}

export interface KeyValue {
  key: string;
  value: AnyValue;
}

export interface OtlpLogRecord {
  timeUnixNano: string;
  observedTimeUnixNano: string;
  severityNumber: number;
  severityText: 'DEBUG' | 'INFO' | 'WARN' | 'ERROR' | 'FATAL';
  body: { stringValue: string };
  attributes: KeyValue[];
  traceId: string;
  spanId: string;
  flags: number;
}

export interface ScopeLogs {
  scope: {
    name: string;
    version: string;
  };
  logRecords: OtlpLogRecord[];
}

export interface ResourceLogs {
  resource: {
    attributes: KeyValue[];
  };
  scopeLogs: ScopeLogs[];
}

export interface TelemetryPayload {
  resourceLogs: ResourceLogs[];
}
