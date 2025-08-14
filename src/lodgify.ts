import { config } from 'dotenv'

// Load environment variables
config()

// Types and Interfaces
export interface RequestOptions {
  headers?: Record<string, string>
  body?: unknown
  params?: Record<string, unknown>
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

  constructor(private readonly apiKey: string) {
    if (!apiKey) {
      throw new Error('Lodgify API key is required')
    }
    this.logLevel = (process.env.LOG_LEVEL as LogLevel) || 'info'
  }

  /**
   * Sleep utility for retry delays
   */
  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms))
  }

  /**
   * Logging utility based on LOG_LEVEL environment variable
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
      const logData = data ? ` ${JSON.stringify(data)}` : ''
      const logMessage = `[${timestamp}] [${level.toUpperCase()}] ${message}${logData}`

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

    // Debug logging for HTTP requests
    if (process.env.DEBUG_HTTP === '1') {
      this.log('debug', `HTTP Request: ${method} ${url}`, {
        headers: { ...options?.headers, 'X-ApiKey': '[REDACTED]' },
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

        // Debug logging for responses
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
   * Get a single property by ID
   * GET /v2/properties/{id}
   */
  public async getProperty<T = unknown>(id: string): Promise<T> {
    if (!id) {
      throw new Error('Property ID is required')
    }
    this.log('debug', 'getProperty called', { id })
    return this.request<T>('GET', `/v2/properties/${encodeURIComponent(id)}`)
  }

  /**
   * List rooms for a specific property
   * GET /v2/properties/{propertyId}/rooms
   */
  public async listPropertyRooms<T = unknown>(propertyId: string): Promise<T> {
    if (!propertyId) {
      throw new Error('Property ID is required')
    }
    this.log('debug', 'listPropertyRooms called', { propertyId })
    return this.request<T>('GET', `/v2/properties/${encodeURIComponent(propertyId)}/rooms`)
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
    if (!id) {
      throw new Error('Booking ID is required')
    }
    this.log('debug', 'getBooking called', { id })
    return this.request<T>('GET', `/v2/reservations/bookings/${encodeURIComponent(id)}`)
  }

  /**
   * Get payment link for a booking
   * GET /v2/reservations/bookings/{id}/quote/paymentLink
   */
  public async getBookingPaymentLink<T = unknown>(id: string): Promise<T> {
    if (!id) {
      throw new Error('Booking ID is required')
    }
    this.log('debug', 'getBookingPaymentLink called', { id })
    return this.request<T>('GET', `/v2/reservations/bookings/${encodeURIComponent(id)}/quote/paymentLink`)
  }

  /**
   * Create payment link for a booking
   * POST /v2/reservations/bookings/{id}/quote/paymentLink
   */
  public async createBookingPaymentLink<T = unknown>(
    id: string,
    payload: Record<string, unknown>,
  ): Promise<T> {
    if (!id) {
      throw new Error('Booking ID is required')
    }
    if (!payload) {
      throw new Error('Payload is required')
    }
    this.log('debug', 'createBookingPaymentLink called', { id, payload })
    return this.request<T>('POST', `/v2/reservations/bookings/${encodeURIComponent(id)}/quote/paymentLink`, {
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
    if (!id) {
      throw new Error('Booking ID is required')
    }
    if (!payload) {
      throw new Error('Payload is required')
    }
    this.log('debug', 'updateKeyCodes called', { id, payload })
    return this.request<T>('PUT', `/v2/reservations/bookings/${encodeURIComponent(id)}/keyCodes`, {
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
    if (!propertyId) {
      throw new Error('Property ID is required')
    }
    if (!roomTypeId) {
      throw new Error('Room Type ID is required')
    }
    this.log('debug', 'getAvailabilityRoom called', { propertyId, roomTypeId, params })
    return this.request<T>(
      'GET',
      `/v2/availability/${encodeURIComponent(propertyId)}/${encodeURIComponent(roomTypeId)}`,
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
    if (!propertyId) {
      throw new Error('Property ID is required')
    }
    this.log('debug', 'getAvailabilityProperty called', { propertyId, params })
    return this.request<T>('GET', `/v2/availability/${encodeURIComponent(propertyId)}`, { params })
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
    if (!propertyId) {
      throw new Error('Property ID is required')
    }
    if (!params) {
      throw new Error('Parameters are required for quote')
    }
    this.log('debug', 'getQuote called', { propertyId, params })
    return this.request<T>('GET', `/v2/quote/${encodeURIComponent(propertyId)}`, { params })
  }

  /**
   * Get a messaging thread
   * GET /v2/messaging/{threadGuid}
   */
  public async getThread<T = unknown>(threadGuid: string): Promise<T> {
    if (!threadGuid) {
      throw new Error('Thread GUID is required')
    }
    this.log('debug', 'getThread called', { threadGuid })
    return this.request<T>('GET', `/v2/messaging/${encodeURIComponent(threadGuid)}`)
  }
}
