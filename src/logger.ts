/**
 * File-based logger configuration for MCP server
 * Prevents console.log interference with STDIO transport
 */

import fs from 'node:fs'
import path from 'node:path'
import pino from 'pino'

/**
 * Valid log levels supported by the logger
 */
export type LogLevel = 'error' | 'warn' | 'info' | 'debug'

/**
 * Create log directory if it doesn't exist
 */
function ensureLogDirectory(): string {
  const logDir = path.join(process.cwd(), 'logs')

  try {
    if (!fs.existsSync(logDir)) {
      fs.mkdirSync(logDir, { recursive: true })
    }
    return logDir
  } catch (_error) {
    // Fallback to temp directory if we can't create logs directory
    const tempDir = path.join(process.env.TMPDIR || '/tmp', '@mikerob-lodgify-mcp-logs')
    try {
      if (!fs.existsSync(tempDir)) {
        fs.mkdirSync(tempDir, { recursive: true })
      }
      return tempDir
    } catch (_fallbackError) {
      // Final fallback - use current directory
      return process.cwd()
    }
  }
}

/**
 * Get the configured log level from environment or default to 'info'
 */
function getLogLevel(): LogLevel {
  const level = process.env.LOG_LEVEL?.toLowerCase() as LogLevel
  return ['error', 'warn', 'info', 'debug'].includes(level) ? level : 'info'
}

/**
 * Check if running in HTTP mode
 */
function isHttpMode(): boolean {
  // Check if we're running server-http.js or if HTTP_MODE env is set
  return (
    process.argv.some((arg) => arg.includes('server-http')) ||
    process.env.HTTP_MODE === 'true' ||
    process.env.HTTP_HOST !== undefined ||
    process.env.HTTP_PORT !== undefined
  )
}

/**
 * Create and configure the file-based logger
 */
function createLogger() {
  const logLevel = getLogLevel()

  // For HTTP mode, use console output
  if (isHttpMode()) {
    return pino(
      {
        level: logLevel,
        timestamp: pino.stdTimeFunctions.isoTime,
        formatters: {
          level: (label) => {
            return { level: label }
          },
        },
      },
      pino.destination({
        dest: process.stdout.fd,
        sync: true,
      }),
    )
  }

  // For STDIO mode, use file-based logging to avoid interfering with MCP protocol
  const logDir = ensureLogDirectory()

  // Log file path with timestamp for rotation
  const timestamp = new Date().toISOString().split('T')[0] // YYYY-MM-DD
  const logFile = path.join(logDir, `lodgify-mcp-${timestamp}.log`)

  // Create logger instance with file destination
  const logger = pino(
    {
      level: logLevel,
      timestamp: pino.stdTimeFunctions.isoTime,
      formatters: {
        level: (label) => {
          return { level: label }
        },
      },
    },
    pino.destination({
      dest: logFile,
      sync: true, // Sync writes to ensure logger is immediately ready
      mkdir: true, // Create directory if needed
    }),
  )

  return logger
}

/**
 * Global logger instance
 */
export const logger = createLogger()

/**
 * Safe logging wrapper that ensures no output to stdout/stderr
 * during STDIO transport operation
 */
export class SafeLogger {
  private readonly pino: pino.Logger

  constructor() {
    this.pino = logger
  }

  /**
   * Log error level messages
   */
  error(message: string, ...args: unknown[]): void {
    if (args.length > 0) {
      // Better error serialization for Error objects
      const extra = args.map((arg) => {
        if (arg instanceof Error) {
          return {
            message: arg.message,
            stack: arg.stack,
            name: arg.name,
          }
        }
        return arg
      })
      this.pino.error({ extra }, message)
    } else {
      this.pino.error(message)
    }
  }

  /**
   * Log warning level messages
   */
  warn(message: string, ...args: unknown[]): void {
    if (args.length > 0) {
      this.pino.warn({ extra: args }, message)
    } else {
      this.pino.warn(message)
    }
  }

  /**
   * Log info level messages
   */
  info(message: string, ...args: unknown[]): void {
    if (args.length > 0) {
      this.pino.info({ extra: args }, message)
    } else {
      this.pino.info(message)
    }
  }

  /**
   * Log debug level messages
   */
  debug(message: string, ...args: unknown[]): void {
    if (args.length > 0) {
      this.pino.debug({ extra: args }, message)
    } else {
      this.pino.debug(message)
    }
  }

  /**
   * Log HTTP request details when DEBUG_HTTP is enabled
   */
  debugHttp(details: {
    method: string
    url: string
    headers?: Record<string, unknown>
    body?: unknown
    status?: number
    response?: unknown
  }): void {
    if (process.env.DEBUG_HTTP === '1') {
      this.pino.debug(
        {
          http: {
            method: details.method,
            url: details.url,
            headers: this.sanitizeHeaders(details.headers),
            body: details.body,
            status: details.status,
            response: details.response,
          },
        },
        'HTTP Request/Response',
      )
    }
  }

  /**
   * Sanitize headers to remove sensitive information
   */
  private sanitizeHeaders(headers?: Record<string, unknown>): Record<string, unknown> | undefined {
    if (!headers) return undefined

    const sanitized = { ...headers }

    // Remove or mask sensitive headers
    if (sanitized['X-ApiKey']) {
      sanitized['X-ApiKey'] = '***REDACTED***'
    }
    if (sanitized.Authorization) {
      sanitized.Authorization = '***REDACTED***'
    }

    return sanitized
  }
}

/**
 * Global safe logger instance - use this instead of console.log
 */
export const safeLogger = new SafeLogger()

/**
 * Create a child logger with additional context
 */
export function createChildLogger(context: Record<string, unknown>): SafeLogger {
  const childPino = logger.child(context)

  class ChildSafeLogger extends SafeLogger {
    private readonly childPino: pino.Logger

    constructor(pino: pino.Logger) {
      super()
      this.childPino = pino
    }

    error(message: string, ...args: unknown[]): void {
      if (args.length > 0) {
        this.childPino.error({ extra: args }, message)
      } else {
        this.childPino.error(message)
      }
    }

    warn(message: string, ...args: unknown[]): void {
      if (args.length > 0) {
        this.childPino.warn({ extra: args }, message)
      } else {
        this.childPino.warn(message)
      }
    }

    info(message: string, ...args: unknown[]): void {
      if (args.length > 0) {
        this.childPino.info({ extra: args }, message)
      } else {
        this.childPino.info(message)
      }
    }

    debug(message: string, ...args: unknown[]): void {
      if (args.length > 0) {
        this.childPino.debug({ extra: args }, message)
      } else {
        this.childPino.debug(message)
      }
    }
  }

  return new ChildSafeLogger(childPino)
}
