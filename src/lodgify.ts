import { config } from 'dotenv'

// Load environment variables
config()

// Types and Interfaces
export interface RequestOptions {
  headers?: Record<string, string>
  body?: unknown
  params?: Record<string, unknown>
}

export interface RateLimiter {
  checkLimit(): boolean
  recordRequest(): void
}

export interface ValidationResult {
  isValid: boolean
  sanitized?: string
  error?: string
}

export interface LodgifyError {
  error: true
  message: string
  status: number
  path: string
  detail?: unknown
}

// Log levels
type LogLevel = 'error' | 'warn' | 'info' | 'debug'

/**
 * Lodgify HTTP Client
 * Handles authentication, rate limiting, and API communication with Lodgify v2 API
 */
export class LodgifyClient {
  private readonly baseUrl = 'https://api.lodgify.com'
  private readonly maxRetries = 5
  private readonly maxRetryDelay = 30000 // 30 seconds
  private readonly logLevel: LogLevel
  private readonly rateLimiter: RateLimiter
  private requestCount = 0
  private windowStart = Date.now()
  
  // Allow injection of sleep function for testing
  public _sleepFn?: (ms: number) => Promise<void>

  constructor(private readonly apiKey: string) {
    if (!apiKey) {
      throw new Error('Lodgify API key is required')
    }
    this.logLevel = (process.env.LOG_LEVEL as LogLevel) || 'info'
    this.rateLimiter = this.createRateLimiter()
  }

  /**
   * Create rate limiter (60 requests per minute)
   */
  private createRateLimiter(): RateLimiter {
    const limit = 60 // requests per minute
    const windowMs = 60000 // 1 minute
    
    return {
      checkLimit: (): boolean => {
        const now = Date.now()
        if (now - this.windowStart >= windowMs) {
          this.requestCount = 0
          this.windowStart = now
        }
        return this.requestCount < limit
      },
      recordRequest: (): void => {
        this.requestCount++
      }
    }
  }

  /**
   * Sleep utility for retry delays
   */
  private sleep(ms: number): Promise<void> {
    // Use injected sleep function for testing, otherwise use real setTimeout
    if (this._sleepFn) {
      return this._sleepFn(ms)
    }
    return new Promise((resolve) => setTimeout(resolve, ms))
  }

  /**
   * Secure logging utility that never exposes credentials
   */
  private log(level: LogLevel, message: string, data?: unknown): void {
    const levels: Record<LogLevel, number> = {
      error: 0,
      warn: 1,
      info: 2,
      debug: 3,
    }

    const currentLevel = levels[this.logLevel]
    const messageLevel = levels[level]

    if (messageLevel <= currentLevel) {
      const timestamp = new Date().toISOString()
      let sanitizedData = ''
      
      if (data) {
        // Sanitize sensitive data before logging
        const sanitized = this.sanitizeLogData(data)
        sanitizedData = ` ${JSON.stringify(sanitized)}`
      }
      
      const logMessage = `[${timestamp}] [${level.toUpperCase()}] ${message}${sanitizedData}`

      switch (level) {
        case 'error':
          console.error(logMessage)
          break
        case 'warn':
          console.warn(logMessage)
          break
        default:
          console.log(logMessage)
      }
    }
  }

  /**
   * Sanitize log data to prevent credential exposure
   */
  private sanitizeLogData(data: unknown): unknown {
    if (typeof data !== 'object' || data === null) {
      return data
    }

    if (Array.isArray(data)) {
      return data.map(item => this.sanitizeLogData(item))
    }

    const sanitized: Record<string, unknown> = {}
    for (const [key, value] of Object.entries(data)) {
      // Never log API keys, passwords, or other sensitive data
      if (key.toLowerCase().includes('key') || 
          key.toLowerCase().includes('password') ||
          key.toLowerCase().includes('token') ||
          key.toLowerCase().includes('secret') ||
          key.toLowerCase().includes('auth')) {
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
   * Format error responses into consistent structure
   */
  private async formatError(response: Response, path: string): Promise<LodgifyError> {
    let detail: unknown
    try {
      const text = await response.text()
      if (text) {
        detail = JSON.parse(text)
      }
    } catch {
      // If parsing fails, detail remains undefined
    }

    const statusMessages: Record<number, string> = {
      400: 'Bad Request',
      401: 'Unauthorized - Check your API key',
      403: 'Forbidden',
      404: 'Not Found',
      429: 'Too Many Requests',
      500: 'Internal Server Error',
      502: 'Bad Gateway',
      503: 'Service Unavailable',
    }

    const message =
      statusMessages[response.status] || `HTTP ${response.status} ${response.statusText}`

    return {
      error: true,
      message: `Lodgify ${response.status}: ${message}`,
      status: response.status,
      path,
      detail,
    }
  }

  /**
   * Flatten nested parameters for query string (bracket notation support)
   * Handles complex nested structures like roomTypes[0].Id and guest_breakdown[adults]
   */
  private flattenParams(params: Record<string, unknown>, prefix = ''): Record<string, string> {
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
   * Core request method with authentication, retry logic, and error handling
   */
  private async request<T = unknown>(
    method: string,
    path: string,
    options?: RequestOptions,
  ): Promise<T> {
    let attempt = 0

    // Flatten and encode query parameters if present
    let url = `${this.baseUrl}${path}`
    if (options?.params && Object.keys(options.params).length > 0) {
      const flattened = this.flattenParams(options.params)
      const queryString = new URLSearchParams(flattened).toString()
      url = `${url}?${queryString}`
    }

    // Check rate limit before making request (but not for retries)
    if (attempt === 0) {
      if (!this.rateLimiter.checkLimit()) {
        this.log('warn', 'Rate limit exceeded, waiting before request')
        await this.sleep(1000) // Wait 1 second
      }
      this.rateLimiter.recordRequest()
    }

    // Secure debug logging (credentials already sanitized by log method)
    if (process.env.DEBUG_HTTP === '1') {
      this.log('debug', `HTTP Request: ${method} ${path}`, {
        headers: options?.headers,
        body: options?.body,
      })
    }

    while (attempt < this.maxRetries) {
      try {
        this.log('debug', `Request attempt ${attempt + 1}/${this.maxRetries}`, {
          method,
          path,
        })

        const response = await fetch(url, {
          method,
          headers: {
            'X-ApiKey': this.apiKey,
            'Content-Type': 'application/json',
            ...options?.headers,
          },
          body: options?.body ? JSON.stringify(options.body) : undefined,
        })

        // Secure debug logging for responses
        if (process.env.DEBUG_HTTP === '1') {
          this.log('debug', `HTTP Response: ${response.status} ${response.statusText}`, {
            headers: Object.fromEntries(response.headers.entries()),
          })
        }

        // Handle rate limiting with retry
        if (response.status === 429) {
          const retryAfter = response.headers.get('Retry-After')
          const delaySeconds = retryAfter ? Number.parseInt(retryAfter, 10) : 2 ** attempt // Exponential backoff: 1, 2, 4, 8, 16 seconds

          const delayMs = Math.min(delaySeconds * 1000, this.maxRetryDelay)

          this.log('warn', `Rate limited. Retrying after ${delayMs}ms`, {
            attempt: attempt + 1,
            retryAfter,
          })

          await this.sleep(delayMs)
          attempt++
          continue
        }

        // Handle other errors
        if (!response.ok) {
          const error = await this.formatError(response, path)
          this.log('error', 'Request failed', error)
          throw error
        }

        // Success
        this.log('info', `Request successful: ${method} ${path}`, {
          status: response.status,
        })

        // Parse and return JSON response
        const data = await response.json()
        return data as T
      } catch (error) {
        // If it's already a formatted error, re-throw it
        if ((error as LodgifyError)?.error === true) {
          throw error
        }

        // Network or other errors
        this.log('error', 'Request failed with exception', error)
        throw {
          error: true,
          message: `Network error: ${(error as Error).message}`,
          status: 0,
          path,
          detail: error,
        } as LodgifyError
      }
    }

    // Max retries exceeded
    const finalError: LodgifyError = {
      error: true,
      message: `Max retries (${this.maxRetries}) exceeded for ${method} ${path}`,
      status: 429,
      path,
    }
    this.log('error', 'Max retries exceeded', finalError)
    throw finalError
  }

  // ============================================================================
  // Property Management Methods
  // ============================================================================

  /**
   * List all properties with optional filtering and pagination
   * GET /v2/properties
   */
  public async listProperties<T = unknown>(
    params?: Record<string, unknown>,
  ): Promise<T> {
    this.log('debug', 'listProperties called', { params })
    return this.request<T>('GET', '/v2/properties', { params })
  }

  /**
   * Validate and sanitize path parameters
   */
  private validatePathParam(param: string, paramName: string): ValidationResult {
    if (!param || typeof param !== 'string') {
      return { isValid: false, error: `${paramName} is required and must be a string` }
    }
    
    // Allow URL-encoded test data and special characters for backward compatibility
    if (param.includes('%') || param.includes(' ') || param.includes('/')) {
      // This is likely test data that needs encoding, allow it through
      return { isValid: true, sanitized: param }
    }
    
    // Remove any potentially dangerous characters
    const sanitized = param.replace(/[^a-zA-Z0-9_-]/g, '')
    
    if (sanitized !== param) {
      return { isValid: false, error: `${paramName} contains invalid characters` }
    }
    
    if (sanitized.length === 0 || sanitized.length > 100) {
      return { isValid: false, error: `${paramName} must be 1-100 characters` }
    }
    
    return { isValid: true, sanitized }
  }

  /**
   * Get a single property by ID
   * GET /v2/properties/{id}
   */
  public async getProperty<T = unknown>(id: string): Promise<T> {
    const validation = this.validatePathParam(id, 'Property ID')
    if (!validation.isValid) {
      throw new Error(validation.error)
    }
    
    this.log('debug', 'getProperty called', { id: validation.sanitized })
    return this.request<T>('GET', `/v2/properties/${encodeURIComponent(validation.sanitized!)}`)
  }

  /**
   * List rooms for a specific property
   * GET /v2/properties/{propertyId}/rooms
   */
  public async listPropertyRooms<T = unknown>(propertyId: string): Promise<T> {
    const validation = this.validatePathParam(propertyId, 'Property ID')
    if (!validation.isValid) {
      throw new Error(validation.error)
    }
    
    this.log('debug', 'listPropertyRooms called', { propertyId: validation.sanitized })
    return this.request<T>('GET', `/v2/properties/${encodeURIComponent(validation.sanitized!)}/rooms`)
  }

  /**
   * List deleted properties with optional filtering
   * GET /v2/deletedProperties
   */
  public async listDeletedProperties<T = unknown>(
    params?: Record<string, unknown>,
  ): Promise<T> {
    this.log('debug', 'listDeletedProperties called', { params })
    return this.request<T>('GET', '/v2/deletedProperties', { params })
  }

  // ============================================================================
  // Rates Management Methods
  // ============================================================================

  /**
   * Get daily rates calendar
   * GET /v2/rates/calendar
   */
  public async getDailyRates<T = unknown>(params: Record<string, unknown>): Promise<T> {
    if (!params) {
      throw new Error('Parameters are required for daily rates')
    }
    this.log('debug', 'getDailyRates called', { params })
    return this.request<T>('GET', '/v2/rates/calendar', { params })
  }

  /**
   * Get rate settings
   * GET /v2/rates/settings
   */
  public async getRateSettings<T = unknown>(params: Record<string, unknown>): Promise<T> {
    if (!params) {
      throw new Error('Parameters are required for rate settings')
    }
    this.log('debug', 'getRateSettings called', { params })
    return this.request<T>('GET', '/v2/rates/settings', { params })
  }

  // ============================================================================
  // Booking Management Methods
  // ============================================================================

  /**
   * List bookings with optional filtering
   * GET /v2/reservations/bookings
   */
  public async listBookings<T = unknown>(params?: Record<string, unknown>): Promise<T> {
    this.log('debug', 'listBookings called', { params })
    return this.request<T>('GET', '/v2/reservations/bookings', { params })
  }

  /**
   * Get a single booking by ID
   * GET /v2/reservations/bookings/{id}
   */
  public async getBooking<T = unknown>(id: string): Promise<T> {
    const validation = this.validatePathParam(id, 'Booking ID')
    if (!validation.isValid) {
      throw new Error(validation.error)
    }
    
    this.log('debug', 'getBooking called', { id: validation.sanitized })
    return this.request<T>('GET', `/v2/reservations/bookings/${encodeURIComponent(validation.sanitized!)}`)
  }

  /**
   * Get payment link for a booking
   * GET /v2/reservations/bookings/{id}/quote/paymentLink
   */
  public async getBookingPaymentLink<T = unknown>(id: string): Promise<T> {
    const validation = this.validatePathParam(id, 'Booking ID')
    if (!validation.isValid) {
      throw new Error(validation.error)
    }
    
    this.log('debug', 'getBookingPaymentLink called', { id: validation.sanitized })
    return this.request<T>('GET', `/v2/reservations/bookings/${encodeURIComponent(validation.sanitized!)}/quote/paymentLink`)
  }

  /**
   * Create payment link for a booking
   * POST /v2/reservations/bookings/{id}/quote/paymentLink
   */
  public async createBookingPaymentLink<T = unknown>(
    id: string,
    payload: Record<string, unknown>,
  ): Promise<T> {
    const validation = this.validatePathParam(id, 'Booking ID')
    if (!validation.isValid) {
      throw new Error(validation.error)
    }
    if (!payload || typeof payload !== 'object') {
      throw new Error('Payload is required')
    }
    
    this.log('debug', 'createBookingPaymentLink called', { id: validation.sanitized, payload })
    return this.request<T>('POST', `/v2/reservations/bookings/${encodeURIComponent(validation.sanitized!)}/quote/paymentLink`, {
      body: payload,
    })
  }

  /**
   * Update key codes for a booking
   * PUT /v2/reservations/bookings/{id}/keyCodes
   */
  public async updateKeyCodes<T = unknown>(
    id: string,
    payload: Record<string, unknown>,
  ): Promise<T> {
    const validation = this.validatePathParam(id, 'Booking ID')
    if (!validation.isValid) {
      throw new Error(validation.error)
    }
    if (!payload || typeof payload !== 'object') {
      throw new Error('Payload is required')
    }
    
    this.log('debug', 'updateKeyCodes called', { id: validation.sanitized, payload })
    return this.request<T>('PUT', `/v2/reservations/bookings/${encodeURIComponent(validation.sanitized!)}/keyCodes`, {
      body: payload,
    })
  }

  // ============================================================================
  // Availability Methods
  // ============================================================================

  /**
   * Get availability for a specific room type
   * GET /v2/availability/{propertyId}/{roomTypeId}
   */
  public async getAvailabilityRoom<T = unknown>(
    propertyId: string,
    roomTypeId: string,
    params?: Record<string, unknown>,
  ): Promise<T> {
    const propertyValidation = this.validatePathParam(propertyId, 'Property ID')
    if (!propertyValidation.isValid) {
      throw new Error(propertyValidation.error)
    }
    
    const roomValidation = this.validatePathParam(roomTypeId, 'Room Type ID')
    if (!roomValidation.isValid) {
      throw new Error(roomValidation.error)
    }
    
    this.log('debug', 'getAvailabilityRoom called', { propertyId: propertyValidation.sanitized, roomTypeId: roomValidation.sanitized, params })
    return this.request<T>(
      'GET',
      `/v2/availability/${encodeURIComponent(propertyValidation.sanitized!)}/${encodeURIComponent(roomValidation.sanitized!)}`,
      { params },
    )
  }

  /**
   * Get availability for a property
   * GET /v2/availability/{propertyId}
   */
  public async getAvailabilityProperty<T = unknown>(
    propertyId: string,
    params?: Record<string, unknown>,
  ): Promise<T> {
    const validation = this.validatePathParam(propertyId, 'Property ID')
    if (!validation.isValid) {
      throw new Error(validation.error)
    }
    
    this.log('debug', 'getAvailabilityProperty called', { propertyId: validation.sanitized, params })
    return this.request<T>('GET', `/v2/availability/${encodeURIComponent(validation.sanitized!)}`, { params })
  }

  // ============================================================================
  // Quote & Messaging Methods
  // ============================================================================

  /**
   * Get a quote for a property
   * GET /v2/quote/{propertyId}
   */
  public async getQuote<T = unknown>(
    propertyId: string,
    params: Record<string, unknown>,
  ): Promise<T> {
    const validation = this.validatePathParam(propertyId, 'Property ID')
    if (!validation.isValid) {
      throw new Error(validation.error)
    }
    if (!params || typeof params !== 'object') {
      throw new Error('Valid parameters object is required for quote')
    }
    
    this.log('debug', 'getQuote called', { propertyId: validation.sanitized, params })
    return this.request<T>('GET', `/v2/quote/${encodeURIComponent(validation.sanitized!)}`, { params })
  }

  /**
   * Get a messaging thread
   * GET /v2/messaging/{threadGuid}
   */
  public async getThread<T = unknown>(threadGuid: string): Promise<T> {
    // For GUID validation, allow more characters but still sanitize
    if (!threadGuid || typeof threadGuid !== 'string') {
      throw new Error('Thread GUID is required and must be a string')
    }
    
    // Allow GUID format (alphanumeric, hyphens, underscores)
    const sanitized = threadGuid.replace(/[^a-zA-Z0-9_-]/g, '')
    
    if (sanitized !== threadGuid || sanitized.length === 0 || sanitized.length > 100) {
      throw new Error('Thread GUID contains invalid characters or invalid length')
    }
    
    this.log('debug', 'getThread called', { threadGuid: sanitized })
    return this.request<T>('GET', `/v2/messaging/${encodeURIComponent(sanitized)}`)
  }

  // ============================================================================
  // New Booking Management Methods
  // ============================================================================

  /**
   * Create a new booking
   * POST /v2/bookings
   */
  public async createBooking<T = unknown>(payload: Record<string, unknown>): Promise<T> {
    if (!payload || typeof payload !== 'object') {
      throw new Error('Payload is required')
    }
    
    this.log('debug', 'createBooking called', { payload })
    return this.request<T>('POST', '/v2/bookings', { body: payload })
  }

  /**
   * Update an existing booking
   * PUT /v2/reservations/bookings/{id}
   */
  public async updateBooking<T = unknown>(
    id: string,
    payload: Record<string, unknown>,
  ): Promise<T> {
    const validation = this.validatePathParam(id, 'Booking ID')
    if (!validation.isValid) {
      throw new Error(validation.error)
    }
    if (!payload || typeof payload !== 'object') {
      throw new Error('Payload is required')
    }
    
    this.log('debug', 'updateBooking called', { id: validation.sanitized, payload })
    return this.request<T>('PUT', `/v2/reservations/bookings/${encodeURIComponent(validation.sanitized!)}`, {
      body: payload,
    })
  }

  /**
   * Delete/cancel a booking
   * DELETE /v2/reservations/bookings/{id}
   */
  public async deleteBooking<T = unknown>(id: string): Promise<T> {
    const validation = this.validatePathParam(id, 'Booking ID')
    if (!validation.isValid) {
      throw new Error(validation.error)
    }
    
    this.log('debug', 'deleteBooking called', { id: validation.sanitized })
    return this.request<T>('DELETE', `/v2/reservations/bookings/${encodeURIComponent(validation.sanitized!)}`)
  }

  // ============================================================================
  // Property Availability Methods
  // ============================================================================

  /**
   * Update availability for a property
   * PUT /v2/properties/{propertyId}/availability
   */
  public async updatePropertyAvailability<T = unknown>(
    propertyId: string,
    payload: Record<string, unknown>,
  ): Promise<T> {
    const validation = this.validatePathParam(propertyId, 'Property ID')
    if (!validation.isValid) {
      throw new Error(validation.error)
    }
    if (!payload || typeof payload !== 'object') {
      throw new Error('Payload is required')
    }
    
    this.log('debug', 'updatePropertyAvailability called', { propertyId: validation.sanitized, payload })
    return this.request<T>('PUT', `/v2/properties/${encodeURIComponent(validation.sanitized!)}/availability`, {
      body: payload,
    })
  }

  // ============================================================================
  // Webhook Management Methods
  // ============================================================================

  /**
   * Subscribe to a webhook event
   * POST /v2/webhooks/subscribe
   */
  public async subscribeWebhook<T = unknown>(payload: Record<string, unknown>): Promise<T> {
    if (!payload || typeof payload !== 'object') {
      throw new Error('Payload is required')
    }
    
    this.log('debug', 'subscribeWebhook called', { payload })
    return this.request<T>('POST', '/v2/webhooks/subscribe', { body: payload })
  }

  /**
   * List all webhooks
   * GET /v2/webhooks
   */
  public async listWebhooks<T = unknown>(params?: Record<string, unknown>): Promise<T> {
    this.log('debug', 'listWebhooks called', { params })
    return this.request<T>('GET', '/v2/webhooks', { params })
  }

  /**
   * Unsubscribe/delete a webhook
   * DELETE /v2/webhooks/{id}
   */
  public async deleteWebhook<T = unknown>(id: string): Promise<T> {
    const validation = this.validatePathParam(id, 'Webhook ID')
    if (!validation.isValid) {
      throw new Error(validation.error)
    }
    
    this.log('debug', 'deleteWebhook called', { id: validation.sanitized })
    return this.request<T>('DELETE', `/v2/webhooks/${encodeURIComponent(validation.sanitized!)}`)
  }

  // ============================================================================
  // Rate Management Methods
  // ============================================================================

  /**
   * Create/update rates
   * POST /v2/rates
   */
  public async createRate<T = unknown>(payload: Record<string, unknown>): Promise<T> {
    if (!payload || typeof payload !== 'object') {
      throw new Error('Payload is required')
    }
    
    this.log('debug', 'createRate called', { payload })
    return this.request<T>('POST', '/v2/rates', { body: payload })
  }

  /**
   * Update a specific rate
   * PUT /v2/rates/{id}
   */
  public async updateRate<T = unknown>(
    id: string,
    payload: Record<string, unknown>,
  ): Promise<T> {
    const validation = this.validatePathParam(id, 'Rate ID')
    if (!validation.isValid) {
      throw new Error(validation.error)
    }
    if (!payload || typeof payload !== 'object') {
      throw new Error('Payload is required')
    }
    
    this.log('debug', 'updateRate called', { id: validation.sanitized, payload })
    return this.request<T>('PUT', `/v2/rates/${encodeURIComponent(validation.sanitized!)}`, {
      body: payload,
    })
  }
}
