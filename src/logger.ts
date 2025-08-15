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
 * Determines and ensures a directory for application log files, returning its path.
 *
 * Attempts to create a "logs" directory under the current working directory and returns that path.
 * If creation fails, falls back to a temporary directory (TMPDIR or `/tmp`) under `lodgify-mcp-logs`.
 * If that also cannot be created, returns the current working directory as a final fallback.
 *
 * Errors during directory creation are handled internally; this function always returns a usable directory path.
 *
 * @returns The chosen directory path where logs can be written.
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
    const tempDir = path.join(process.env.TMPDIR || '/tmp', 'lodgify-mcp-logs')
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
 * Returns the active log level from the LOG_LEVEL environment variable.
 *
 * Reads LOG_LEVEL case‑insensitively and validates it against the supported levels
 * ('error', 'warn', 'info', 'debug'). If LOG_LEVEL is unset or invalid, returns 'info'.
 *
 * @returns The selected log level.
 */
function getLogLevel(): LogLevel {
  const level = process.env.LOG_LEVEL?.toLowerCase() as LogLevel
  return ['error', 'warn', 'info', 'debug'].includes(level) ? level : 'info'
}

/**
 * Create and configure a file-based Pino logger and return the logger instance.
 *
 * This function determines a log directory and log level (via ensureLogDirectory and getLogLevel),
 * builds a daily log file named `lodgify-mcp-YYYY-MM-DD.log`, and constructs a Pino logger configured to:
 * - use the resolved log level,
 * - emit ISO timestamps,
 * - format the level as an object `{ level: <label> }`,
 * - write asynchronously to the constructed file path and create directories as needed.
 *
 * @returns A configured `pino.Logger` that writes structured logs to the daily file.
 */
function createLogger() {
  const logDir = ensureLogDirectory()
  const logLevel = getLogLevel()

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
      sync: false, // Async writes for better performance
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
      this.pino.error({ extra: args }, message)
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
 * Create a SafeLogger bound to the provided context by creating a pino child logger.
 *
 * The returned logger will include the given context on every log record. Use this to
 * attach persistent metadata (for example `requestId`, `userId`, or component identifiers)
 * that should appear with all logs emitted by the child logger.
 *
 * @param context - Key/value pairs to add as persistent context on the child logger
 * @returns A SafeLogger instance that logs with the provided context applied
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
