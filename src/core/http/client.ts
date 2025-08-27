/**
 * Base HTTP client for making authenticated API requests
 */

import type { HttpClientConfig, HttpResponse, Logger, LogLevel, RequestOptions } from './types.js'

/**
 * Abstract base HTTP client class
 * Provides core functionality for making HTTP requests with authentication,
 * logging, and response parsing
 */
export abstract class BaseHttpClient {
  protected readonly baseUrl: string
  protected readonly defaultHeaders: Record<string, string>
  protected readonly timeout: number
  protected readonly logLevel: LogLevel
  protected readonly logger?: Logger

  constructor(config: HttpClientConfig, logger?: Logger) {
    this.baseUrl = config.baseUrl
    this.defaultHeaders = config.defaultHeaders || {}
    this.timeout = config.timeout || 30000 // 30 seconds default
    this.logLevel = config.logLevel || 'info'
    this.logger = logger
  }

  /**
   * Flatten nested parameters for query string (bracket notation support)
   * Handles complex nested structures like roomTypes[0].Id and guest_breakdown[adults]
   */
  protected flattenParams(params: Record<string, unknown>, prefix = ''): Record<string, string> {
    const flattened: Record<string, string> = {}

    for (const [key, value] of Object.entries(params)) {
      const newKey = prefix ? `${prefix}[${key}]` : key

      if (value === null || value === undefined) {
        continue
      }

      if (typeof value === 'object' && !Array.isArray(value)) {
        Object.assign(flattened, this.flattenParams(value as Record<string, unknown>, newKey))
      } else if (Array.isArray(value)) {
        value.forEach((item, index) => {
          if (typeof item === 'object' && item !== null) {
            Object.assign(
              flattened,
              this.flattenParams(item as Record<string, unknown>, `${newKey}[${index}]`),
            )
          } else {
            flattened[`${newKey}[${index}]`] = String(item)
          }
        })
      } else {
        flattened[newKey] = String(value)
      }
    }

    return flattened
  }

  /**
   * Build full URL with query parameters
   */
  protected buildUrl(path: string, params?: Record<string, unknown>): string {
    let url = `${this.baseUrl}${path}`

    if (params && Object.keys(params).length > 0) {
      const flattened = this.flattenParams(params)
      const queryString = new URLSearchParams(flattened).toString()
      url = `${url}?${queryString}`
    }

    return url
  }

  /**
   * Log message with appropriate level
   */
  protected log(level: LogLevel, message: string, data?: unknown): void {
    if (!this.logger) return

    const levels: Record<LogLevel, number> = {
      error: 0,
      warn: 1,
      info: 2,
      debug: 3,
    }

    const currentLevel = levels[this.logLevel]
    const messageLevel = levels[level]

    if (messageLevel <= currentLevel) {
      const sanitizedData = data ? this.sanitizeLogData(data) : undefined

      switch (level) {
        case 'error':
          this.logger.error(message, sanitizedData)
          break
        case 'warn':
          this.logger.warn(message, sanitizedData)
          break
        case 'info':
          this.logger.info(message, sanitizedData)
          break
        case 'debug':
          this.logger.debug(message, sanitizedData)
          break
      }
    }
  }

  /**
   * Sanitize log data to prevent credential exposure
   */
  protected sanitizeLogData(data: unknown): unknown {
    if (typeof data !== 'object' || data === null) {
      return data
    }

    if (Array.isArray(data)) {
      return data.map((item) => this.sanitizeLogData(item))
    }

    const sanitized: Record<string, unknown> = {}
    for (const [key, value] of Object.entries(data)) {
      // Never log API keys, passwords, or other sensitive data
      if (
        key.toLowerCase().includes('key') ||
        key.toLowerCase().includes('password') ||
        key.toLowerCase().includes('token') ||
        key.toLowerCase().includes('secret') ||
        key.toLowerCase().includes('auth')
      ) {
        sanitized[key] = '[REDACTED]'
      } else if (typeof value === 'object') {
        sanitized[key] = this.sanitizeLogData(value)
      } else {
        sanitized[key] = value
      }
    }
    return sanitized
  }

  /**
   * Make an HTTP request
   */
  protected async makeRequest<T = unknown>(
    method: string,
    path: string,
    options?: RequestOptions,
  ): Promise<HttpResponse<T>> {
    const url = this.buildUrl(path, options?.params)

    // Secure debug logging
    if (process.env.DEBUG_HTTP === '1') {
      this.log('debug', `HTTP Request: ${method} ${path}`, {
        headers: options?.headers,
        body: options?.body,
      })
    }

    const response = await fetch(url, {
      method,
      headers: {
        ...this.defaultHeaders,
        ...options?.headers,
      },
      body: options?.body ? JSON.stringify(options.body) : undefined,
      signal: AbortSignal.timeout(this.timeout),
    })

    // Secure debug logging for responses
    if (process.env.DEBUG_HTTP === '1') {
      this.log('debug', `HTTP Response: ${response.status} ${response.statusText}`, {
        headers: Object.fromEntries(response.headers.entries()),
      })
    }

    // Parse response body
    let data: T
    const contentType = response.headers.get('content-type')

    if (contentType?.includes('application/json')) {
      data = (await response.json()) as T
    } else {
      // For non-JSON responses, return text as data
      data = (await response.text()) as T
    }

    return {
      status: response.status,
      statusText: response.statusText,
      headers: response.headers,
      data,
    }
  }

  /**
   * Abstract method for making authenticated requests
   * Subclasses should implement this with their specific auth and retry logic
   */
  abstract request<T = unknown>(method: string, path: string, options?: RequestOptions): Promise<T>
}
