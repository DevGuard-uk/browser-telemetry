export interface DevGuardWebTelemetryOptions {
  projectId: string;
  /** Preferred publishable project SDK key (dg_sdk_*). Never use the account Master Secret in the browser. */
  sdkKey?: string | null;
  /** Legacy fallback when sdkKey is unset. */
  apiKey?: string | null;
  endpoint?: string;
  sampleRate?: number;
  enableBreadcrumbs?: boolean;
  maxBreadcrumbs?: number;
  deviceId?: string;
  appVersion?: string;
  beforeSend?: (report: WebCrashReport) => WebCrashReport | null;
}

export interface WebBreadcrumb {
  timestamp: string;
  category: string;
  message: string;
  data?: Record<string, unknown>;
}

export interface WebCrashReport {
  projectId: string;
  apiKey?: string | null;
  deviceId?: string;
  errorName: string;
  errorMessage: string;
  stackTrace: string;
  crashType: 'js_error' | 'unhandled_rejection' | 'sdk_internal' | 'vault_error';
  isFatal: boolean;
  platform: 'web';
  sdkRuntime: 'web';
  hostPlatform: 'web';
  appVersion: string;
  browser: string;
  userAgent: string;
  url: string;
  breadcrumbs: WebBreadcrumb[];
  clientMeta?: Record<string, unknown>;
  occurredAt: string;
}

export interface WebUserLogInput {
  screen: string;
  widget?: string;
  className?: string;
  action?: string;
  extras?: Record<string, unknown>;
  timestamp?: string;
}

export function initDevGuardWebTelemetry(options: DevGuardWebTelemetryOptions): boolean;
export function init(options: DevGuardWebTelemetryOptions): boolean;
export function captureException(error: unknown, options?: { isFatal?: boolean; crashType?: string; clientMeta?: Record<string, unknown>; force?: boolean }): WebCrashReport | undefined;
export function recordUserLog(log: WebUserLogInput): unknown;
export function addBreadcrumb(breadcrumb: { category?: string; message: string; data?: Record<string, unknown>; timestamp?: string }): void;
export function scrubString(val: string): string;
export function scrubObject<T extends object>(obj: T, depth?: number): T;
export function getState(): Record<string, unknown>;
export function resetForTesting(): void;
