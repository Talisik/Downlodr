// OpenTelemetry-compatible telemetry types for Downlodr

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
  service_instance_id: string;
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

export interface ProcessInfo {
  process_pid: number;
  process_parent_pid?: number;
  process_executable_name: string;
  process_executable_path?: string;
  process_command?: string;
  process_command_args?: string[];
  process_owner?: string;
}

export interface HostInfo {
  host_name: string;
  host_id?: string;
  host_type: string;
  host_arch: string;
  host_image_name?: string;
  host_image_id?: string;
  host_image_version?: string;
  os_type: string;
  os_description?: string;
  os_name: string;
  os_version?: string;
  cpu_model?: string;
  cpu_cores?: number;
  cpu_threads?: number;
  memory_total_gb?: number;
  memory_available_gb?: number;
  gpu_model?: string;
  storage_total_gb?: number;
  storage_available_gb?: number;
  network_interface?: string;
  network_speed_mbps?: number;
}

export interface UserInfo {
  user_id?: string;
  user_name?: string;
  user_email?: string;
  user_roles?: string[];
  session_id?: string;
  session_previous_id?: string;
}

export interface DeviceInfo {
  device_id?: string;
  device_manufacturer?: string;
  screen_width?: number;
  screen_height?: number;
  screen_density?: number;
  screen_resolution?: string;
  screen_color_depth?: number;
}

export interface CodeInfo {
  code_function?: string;
  code_namespace?: string;
  code_filepath?: string;
  code_lineno?: number;
  code_column?: number;
  code_stacktrace?: string;
}

export interface ThreadInfo {
  thread_id: string;
  thread_name?: string;
}

export interface AppMetadata {
  app_version: string;
  build_number?: string;
  build_date?: string;
  git_commit?: string;
  feature_flags?: Record<string, boolean>;
  performance_metrics?: {
    startup_time_ms?: number;
    memory_usage_mb?: number;
    cpu_usage_percent?: number;
  };
}

export interface LogRecord {
  timestamp: string;
  severity_number: number;
  severity_text: 'DEBUG' | 'INFO' | 'WARN' | 'ERROR' | 'FATAL';
  body: string;
  attributes?: Record<string, any>;
}

export interface ScopeInfo {
  scope_name: string;
  scope_version: string;
  scope_schema_url?: string;
}

export interface TelemetryPayload {
  resource: ResourceInfo;
  log_records: LogRecord[];
  scope_name: string;
  scope_version: string;
  scope_schema_url?: string;
  process?: ProcessInfo;
  host?: HostInfo;
  user?: UserInfo | null;
  device?: DeviceInfo;
  code?: CodeInfo;
  thread?: ThreadInfo;
  app_metadata?: AppMetadata;
  trace_id?: string;
  span_id?: string;
  trace_flags?: number;
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
  codeInfo?: Partial<CodeInfo>;
}
