/**
 * File-based logger configuration for MCP server
 * Prevents console.log interference with STDIO transport
 */
import pino from 'pino'
import path from 'path'
import fs from 'fs'

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
  } catch (error) {
    // Fallback to temp directory if we can't create logs directory
    const tempDir = path.join(process.env.TMPDIR || '/tmp', 'lodgify-mcp-logs')
    try {
      if (!fs.existsSync(tempDir)) {
        fs.mkdirSync(tempDir, { recursive: true })
      }
      return tempDir
    } catch (fallbackError) {
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
 * Create and configure the file-based logger
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
        }
      }
    },
    pino.destination({
      dest: logFile,
      sync: false, // Async writes for better performance
      mkdir: true   // Create directory if needed
    })
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
  error(message: string, ...args: any[]): void {
    if (args.length > 0) {
      this.pino.error({ extra: args }, message)
    } else {
      this.pino.error(message)
    }
  }
  
  /**
   * Log warning level messages
   */
  warn(message: string, ...args: any[]): void {
    if (args.length > 0) {
      this.pino.warn({ extra: args }, message)
    } else {
      this.pino.warn(message)
    }
  }
  
  /**
   * Log info level messages
   */
  info(message: string, ...args: any[]): void {
    if (args.length > 0) {
      this.pino.info({ extra: args }, message)
    } else {
      this.pino.info(message)
    }
  }
  
  /**
   * Log debug level messages
   */
  debug(message: string, ...args: any[]): void {
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
    headers?: Record<string, any>
    body?: any
    status?: number
    response?: any
  }): void {
    if (process.env.DEBUG_HTTP === '1') {
      this.pino.debug({
        http: {
          method: details.method,
          url: details.url,
          headers: this.sanitizeHeaders(details.headers),
          body: details.body,
          status: details.status,
          response: details.response
        }
      }, 'HTTP Request/Response')
    }
  }
  
  /**
   * Sanitize headers to remove sensitive information
   */
  private sanitizeHeaders(headers?: Record<string, any>): Record<string, any> | undefined {
    if (!headers) return undefined
    
    const sanitized = { ...headers }
    
    // Remove or mask sensitive headers
    if (sanitized['X-ApiKey']) {
      sanitized['X-ApiKey'] = '***REDACTED***'
    }
    if (sanitized['Authorization']) {
      sanitized['Authorization'] = '***REDACTED***'
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
export function createChildLogger(context: Record<string, any>): SafeLogger {
  const childPino = logger.child(context)
  
  class ChildSafeLogger extends SafeLogger {
    private readonly childPino: pino.Logger
    
    constructor(pino: pino.Logger) {
      super()
      this.childPino = pino
    }
    
    error(message: string, ...args: any[]): void {
      if (args.length > 0) {
        this.childPino.error({ extra: args }, message)
      } else {
        this.childPino.error(message)
      }
    }
    
    warn(message: string, ...args: any[]): void {
      if (args.length > 0) {
        this.childPino.warn({ extra: args }, message)
      } else {
        this.childPino.warn(message)
      }
    }
    
    info(message: string, ...args: any[]): void {
      if (args.length > 0) {
        this.childPino.info({ extra: args }, message)
      } else {
        this.childPino.info(message)
      }
    }
    
    debug(message: string, ...args: any[]): void {
      if (args.length > 0) {
        this.childPino.debug({ extra: args }, message)
      } else {
        this.childPino.debug(message)
      }
    }
  }
  
  return new ChildSafeLogger(childPino)
}