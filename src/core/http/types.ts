/**
 * Core HTTP types for the base HTTP client
 */

/**
 * Options for HTTP requests
 */
export interface RequestOptions {
  headers?: Record<string, string>
  body?: unknown
  params?: Record<string, unknown>
}

/**
 * HTTP client configuration
 */
export interface HttpClientConfig {
  baseUrl: string
  defaultHeaders?: Record<string, string>
  timeout?: number
  logLevel?: LogLevel
}

/**
 * HTTP response with parsed body
 */
export interface HttpResponse<T = unknown> {
  status: number
  statusText: string
  headers: Headers
  data: T
}

/**
 * Log levels for HTTP client
 */
export type LogLevel = 'error' | 'warn' | 'info' | 'debug'

/**
 * Logger interface for HTTP client
 */
export interface Logger {
  error(message: string, data?: unknown): void
  warn(message: string, data?: unknown): void
  info(message: string, data?: unknown): void
  debug(message: string, data?: unknown): void
}
