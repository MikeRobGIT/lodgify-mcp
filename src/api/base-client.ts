/**
 * Base API Client Architecture
 * Provides foundation for all API modules with common patterns
 */

import { ErrorHandler, ReadOnlyModeError } from '../core/errors/index.js'
import { BaseHttpClient } from '../core/http/index.js'
import type { Logger, RequestOptions } from '../core/http/types.js'
import { createLodgifyRateLimiter, type RateLimiter } from '../core/rate-limiter/index.js'
import { ExponentialBackoffRetry } from '../core/retry/index.js'

/**
 * Common API response types
 */
export interface ListResponse<T> {
  data: T[]
  count?: number
  pagination?: {
    limit: number
    offset: number
    total: number
  }
}

export interface SingleResponse<T> {
  data: T
}

/**
 * Common API request options
 */
export interface ApiRequestOptions extends RequestOptions {
  apiVersion?: 'v1' | 'v2'
  skipRateLimit?: boolean
  skipRetry?: boolean
}

/**
 * API module interface - all API modules must implement this
 */
export interface ApiModule {
  readonly name: string
  readonly version: 'v1' | 'v2' | 'both'
}

/**
 * Common CRUD operations interface
 */
export interface CrudOperations<T, CreateInput = unknown, UpdateInput = unknown> {
  list(params?: Record<string, unknown>): Promise<ListResponse<T>>
  get(id: string): Promise<T>
  create?(data: CreateInput): Promise<T>
  update?(id: string, data: UpdateInput): Promise<T>
  delete?(id: string): Promise<void>
}

/**
 * Base API Client
 * Extends core HTTP client with API-specific functionality
 */
export abstract class BaseApiClient extends BaseHttpClient {
  protected readonly rateLimiter: RateLimiter
  protected readonly errorHandler: ErrorHandler
  protected readonly retryHandler: ExponentialBackoffRetry
  protected readonly apiKey: string
  protected readonly defaultVersion: 'v1' | 'v2'
  protected readonly readOnly: boolean

  constructor(
    apiKey: string,
    defaultVersion: 'v1' | 'v2' = 'v2',
    baseUrl = 'https://api.lodgify.com',
    logger?: Logger,
    readOnly = false,
  ) {
    if (!apiKey) {
      throw new Error('API key is required')
    }

    // Initialize base HTTP client
    super(
      {
        baseUrl,
        defaultHeaders: {
          'X-ApiKey': apiKey,
          'Content-Type': 'application/json',
        },
        logLevel: (process.env.LOG_LEVEL as 'error' | 'warn' | 'info' | 'debug') || 'info',
      },
      logger,
    )

    this.apiKey = apiKey
    this.defaultVersion = defaultVersion
    this.readOnly = readOnly
    this.rateLimiter = createLodgifyRateLimiter()
    this.errorHandler = new ErrorHandler()
    this.retryHandler = new ExponentialBackoffRetry({
      maxRetries: 5,
      maxRetryDelay: 30000,
      shouldRetry: (status: number) => {
        return status === 429 || (status >= 500 && status < 600)
      },
    })
  }

  /**
   * Build versioned API path
   */
  protected buildPath(path: string, version?: 'v1' | 'v2'): string {
    const apiVersion = version || this.defaultVersion
    // Remove any existing version prefix and leading slash
    const cleanPath = path.replace(/^\/?(v1|v2)\//, '').replace(/^\//, '')
    return `/${apiVersion}/${cleanPath}`
  }

  /**
   * Core request method with rate limiting and retry logic
   */
  async request<T = unknown>(
    method: string,
    path: string,
    options?: ApiRequestOptions,
  ): Promise<T> {
    const { apiVersion, skipRateLimit, skipRetry, ...requestOptions } = options || {}

    // Build versioned path
    const versionedPath = this.buildPath(path, apiVersion)

    // Check read-only mode for write operations
    const writeOperations = ['POST', 'PUT', 'PATCH', 'DELETE']
    if (this.readOnly && writeOperations.includes(method.toUpperCase())) {
      throw ReadOnlyModeError.forApiOperation(
        method.toUpperCase(),
        versionedPath,
        `${method.toUpperCase()} ${versionedPath}`,
      )
    }

    // Check rate limit unless skipped
    if (!skipRateLimit) {
      if (!this.rateLimiter.checkLimit()) {
        this.log('warn', 'Rate limit exceeded, waiting before request')
        await this.sleep(1000)
      }
    }

    // Execute with retry unless skipped
    const executeRequest = async () => {
      // Record request for rate limiting
      if (!skipRateLimit) {
        if (!this.rateLimiter.checkLimit()) {
          throw this.errorHandler.createRateLimitError(versionedPath, 60)
        }
        this.rateLimiter.recordRequest()
      }

      // Make the HTTP request
      const response = await this.makeRequest<T>(method, versionedPath, requestOptions)

      // Check for errors
      if (response.status >= 400) {
        const error = await this.errorHandler.formatHttpError(
          new Response(JSON.stringify(response.data), {
            status: response.status,
            statusText: response.statusText,
            headers: response.headers,
          }),
          versionedPath,
        )
        throw error
      }

      return response.data
    }

    if (skipRetry) {
      return executeRequest()
    }

    // Use retry handler
    const result = await this.retryHandler.executeOrThrow<T>(executeRequest, (error: unknown) => {
      // Extract Retry-After header if available
      if (
        error &&
        typeof error === 'object' &&
        'status' in error &&
        (error as { status: number }).status === 429 &&
        'detail' in error &&
        (error as { detail?: { retryAfter?: string | number } }).detail?.retryAfter
      ) {
        return String((error as { detail: { retryAfter: string | number } }).detail.retryAfter)
      }
      return undefined
    })

    return result
  }

  /**
   * Common list operation pattern
   */
  protected async list<T>(
    endpoint: string,
    params?: Record<string, unknown>,
    version?: 'v1' | 'v2',
  ): Promise<ListResponse<T>> {
    const result = await this.request<unknown>('GET', endpoint, {
      params,
      apiVersion: version,
    })

    // Normalize response format
    if (Array.isArray(result)) {
      return {
        data: result,
        count: result.length,
      }
    }

    if (result && typeof result === 'object') {
      if ('data' in result) {
        return result as ListResponse<T>
      }
      if ('items' in result && Array.isArray((result as { items: unknown }).items)) {
        const itemsResult = result as { items: T[]; count?: number; pagination?: unknown }
        return {
          data: itemsResult.items,
          count: itemsResult.count || itemsResult.items.length,
          pagination: itemsResult.pagination as
            | { limit: number; offset: number; total: number }
            | undefined,
        }
      }
    }

    // Wrap single object in array
    return {
      data: [result as T],
      count: 1,
    }
  }

  /**
   * Common get operation pattern
   */
  protected async getById<T>(endpoint: string, id: string, version?: 'v1' | 'v2'): Promise<T> {
    if (!id) {
      throw this.errorHandler.createValidationError(endpoint, 'ID is required')
    }

    // Sanitize ID to prevent path traversal
    const sanitizedId = encodeURIComponent(id)
    const path = `${endpoint}/${sanitizedId}`

    return this.request<T>('GET', path, { apiVersion: version })
  }

  /**
   * Common create operation pattern
   */
  protected async create<T, Input>(
    endpoint: string,
    data: Input,
    version?: 'v1' | 'v2',
  ): Promise<T> {
    if (!data) {
      throw this.errorHandler.createValidationError(endpoint, 'Request body is required')
    }

    return this.request<T>('POST', endpoint, {
      body: data as unknown as Record<string, unknown>,
      apiVersion: version,
    })
  }

  /**
   * Common update operation pattern
   */
  protected async update<T, Input>(
    endpoint: string,
    id: string,
    data: Input,
    version?: 'v1' | 'v2',
  ): Promise<T> {
    if (!id) {
      throw this.errorHandler.createValidationError(endpoint, 'ID is required')
    }
    if (!data) {
      throw this.errorHandler.createValidationError(endpoint, 'Request body is required')
    }

    const sanitizedId = encodeURIComponent(id)
    const path = `${endpoint}/${sanitizedId}`

    return this.request<T>('PUT', path, {
      body: data as unknown as Record<string, unknown>,
      apiVersion: version,
    })
  }

  /**
   * Common delete operation pattern
   */
  protected async deleteById<T = void>(
    endpoint: string,
    id: string,
    version?: 'v1' | 'v2',
  ): Promise<T> {
    if (!id) {
      throw this.errorHandler.createValidationError(endpoint, 'ID is required')
    }

    const sanitizedId = encodeURIComponent(id)
    const path = `${endpoint}/${sanitizedId}`

    return this.request<T>('DELETE', path, { apiVersion: version })
  }

  /**
   * Sleep utility for rate limiting
   */
  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms))
  }

  /**
   * Validate response format matches expected type
   */
  protected validateResponse<T>(
    response: unknown,
    validator: (data: unknown) => data is T,
    errorMessage = 'Invalid response format',
  ): T {
    if (!validator(response)) {
      throw this.errorHandler.createValidationError('', errorMessage, response)
    }
    return response
  }

  /**
   * Build query parameters with proper encoding
   */
  protected buildQuery(params: Record<string, unknown>): string {
    const flattened = this.flattenParams(params)
    const searchParams = new URLSearchParams(flattened)
    return searchParams.toString()
  }
}

/**
 * Factory function for creating API modules
 */
export function createApiModule<T extends ApiModule>(
  ModuleClass: new (client: BaseApiClient) => T,
  client: BaseApiClient,
): T {
  return new ModuleClass(client)
}

/**
 * Type guard for list response
 */
export function isListResponse<T>(response: unknown): response is ListResponse<T> {
  return (
    typeof response === 'object' &&
    response !== null &&
    'data' in response &&
    Array.isArray((response as { data: unknown }).data)
  )
}

/**
 * Type guard for single response
 */
export function isSingleResponse<T>(response: unknown): response is SingleResponse<T> {
  return (
    typeof response === 'object' &&
    response !== null &&
    'data' in response &&
    !Array.isArray((response as { data: unknown }).data)
  )
}
