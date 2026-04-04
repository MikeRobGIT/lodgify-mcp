/**
 * Logger configuration for MCP server
 *
 * In HTTP mode: logs to stdout (Docker logging driver handles rotation).
 * In STDIO mode: logs to file to avoid interfering with the MCP protocol on stdout.
 */

import fs from 'node:fs'
import path from 'node:path'
import pino from 'pino'

/**
 * Valid log levels supported by the logger
 */
export type LogLevel = 'error' | 'warn' | 'info' | 'debug'

/** Maximum serialized size for a single log entry's data payload (bytes). */
const MAX_LOG_ENTRY_BYTES = 64 * 1024 // 64 KB

/**
 * Detect whether we are running in HTTP transport mode.
 * When true, we can safely write logs to stdout.
 */
function isHttpMode(): boolean {
  // server-http.ts sets PORT; the entrypoint also prints MODE: http
  return Boolean(process.env.PORT) || process.env.MCP_TRANSPORT === 'http'
}

/**
 * Create log directory if it doesn't exist (STDIO mode only)
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
 * Clean up old log files (older than 7 days) in the given directory.
 * Best-effort — failures are silently ignored.
 */
function pruneOldLogFiles(logDir: string): void {
  try {
    const cutoff = Date.now() - 7 * 24 * 60 * 60 * 1000
    for (const entry of fs.readdirSync(logDir)) {
      if (!entry.startsWith('lodgify-mcp-') || !entry.endsWith('.log')) continue
      const filePath = path.join(logDir, entry)
      try {
        const stat = fs.statSync(filePath)
        if (stat.mtimeMs < cutoff) {
          fs.unlinkSync(filePath)
        }
      } catch {
        // ignore per-file errors
      }
    }
  } catch {
    // ignore directory-level errors
  }
}

/**
 * Create and configure the logger
 */
function createLogger() {
  const logLevel = getLogLevel()

  if (isHttpMode()) {
    // HTTP mode: write to stdout — Docker logging driver handles rotation/size
    return pino({
      level: logLevel,
      timestamp: pino.stdTimeFunctions.isoTime,
      formatters: {
        level: (label) => ({ level: label }),
      },
    })
  }

  // STDIO mode: write to file so stdout stays clean for MCP protocol
  const logDir = ensureLogDirectory()
  pruneOldLogFiles(logDir)

  const timestamp = new Date().toISOString().split('T')[0] // YYYY-MM-DD
  const logFile = path.join(logDir, `lodgify-mcp-${timestamp}.log`)

  return pino(
    {
      level: logLevel,
      timestamp: pino.stdTimeFunctions.isoTime,
      formatters: {
        level: (label) => ({ level: label }),
      },
    },
    pino.destination({
      dest: logFile,
      sync: false, // async writes to avoid blocking the event loop
      mkdir: true,
    }),
  )
}

/**
 * Global logger instance
 */
export const logger = createLogger()

/**
 * Truncate a value if its JSON representation exceeds the size limit.
 * Returns the original value when small enough, or a truncation notice string.
 */
function truncateIfLarge(value: unknown): unknown {
  if (value === undefined || value === null) return value
  try {
    const serialized = JSON.stringify(value)
    if (serialized && serialized.length > MAX_LOG_ENTRY_BYTES) {
      return `[truncated: ${serialized.length} bytes]`
    }
  } catch {
    return '[unserializable]'
  }
  return value
}

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
      this.pino.error({ extra: args.map(truncateIfLarge) }, message)
    } else {
      this.pino.error(message)
    }
  }

  /**
   * Log warning level messages
   */
  warn(message: string, ...args: unknown[]): void {
    if (args.length > 0) {
      this.pino.warn({ extra: args.map(truncateIfLarge) }, message)
    } else {
      this.pino.warn(message)
    }
  }

  /**
   * Log info level messages
   */
  info(message: string, ...args: unknown[]): void {
    if (args.length > 0) {
      this.pino.info({ extra: args.map(truncateIfLarge) }, message)
    } else {
      this.pino.info(message)
    }
  }

  /**
   * Log debug level messages
   */
  debug(message: string, ...args: unknown[]): void {
    if (args.length > 0) {
      this.pino.debug({ extra: args.map(truncateIfLarge) }, message)
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
            body: truncateIfLarge(details.body),
            status: details.status,
            response: truncateIfLarge(details.response),
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
        this.childPino.error({ extra: args.map(truncateIfLarge) }, message)
      } else {
        this.childPino.error(message)
      }
    }

    warn(message: string, ...args: unknown[]): void {
      if (args.length > 0) {
        this.childPino.warn({ extra: args.map(truncateIfLarge) }, message)
      } else {
        this.childPino.warn(message)
      }
    }

    info(message: string, ...args: unknown[]): void {
      if (args.length > 0) {
        this.childPino.info({ extra: args.map(truncateIfLarge) }, message)
      } else {
        this.childPino.info(message)
      }
    }

    debug(message: string, ...args: unknown[]): void {
      if (args.length > 0) {
        this.childPino.debug({ extra: args.map(truncateIfLarge) }, message)
      } else {
        this.childPino.debug(message)
      }
    }
  }

  return new ChildSafeLogger(childPino)
}
