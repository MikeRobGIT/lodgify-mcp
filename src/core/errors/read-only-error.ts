/**
 * Read-Only Mode Error
 * Error thrown when attempting write operations in read-only mode
 */

import type { LodgifyError } from './types.js'

/**
 * Read-only mode error class
 * Thrown when write operations are attempted while read-only mode is active
 */
export class ReadOnlyModeError extends Error implements LodgifyError {
  public readonly error = true
  public readonly status = 403
  public readonly path: string
  public readonly detail?: unknown

  constructor(
    operation: string,
    path: string,
    detail?: { operation: string; method: string; endpoint?: string; toolName?: string },
  ) {
    const message = `Write operation '${operation}' is not allowed in read-only mode. Set LODGIFY_READ_ONLY=0 to enable write operations.`
    super(message)

    this.name = 'ReadOnlyModeError'
    this.path = path
    this.detail = {
      operation,
      readOnlyMode: true,
      suggestion:
        'Set LODGIFY_READ_ONLY=0 or remove the environment variable to enable write operations',
      ...detail,
    }

    // Maintain proper stack trace for where our error was thrown (only available on V8)
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, ReadOnlyModeError)
    }
  }

  /**
   * Convert error to JSON format for API responses
   */
  toJSON(): LodgifyError {
    return {
      error: this.error,
      status: this.status,
      message: this.message,
      path: this.path,
      detail: this.detail,
    }
  }

  /**
   * Create a read-only error for API operations
   */
  static forApiOperation(method: string, endpoint: string, operation: string): ReadOnlyModeError {
    return new ReadOnlyModeError(operation, endpoint, {
      operation,
      method: method.toUpperCase(),
      endpoint,
    })
  }

  /**
   * Create a read-only error for MCP tool operations
   */
  static forMcpTool(toolName: string, operation: string): ReadOnlyModeError {
    return new ReadOnlyModeError(operation, `mcp:${toolName}`, {
      operation,
      method: 'TOOL',
      toolName,
    })
  }
}

/**
 * Type guard to check if an error is a ReadOnlyModeError
 */
export function isReadOnlyModeError(error: unknown): error is ReadOnlyModeError {
  return error instanceof ReadOnlyModeError
}

/**
 * Helper to create consistent read-only error messages
 */
export function createReadOnlyError(
  operation: string,
  context: { path: string; method?: string; endpoint?: string; toolName?: string },
): ReadOnlyModeError {
  if (context.toolName) {
    return ReadOnlyModeError.forMcpTool(context.toolName, operation)
  }

  if (context.method && context.endpoint) {
    return ReadOnlyModeError.forApiOperation(context.method, context.endpoint, operation)
  }

  return new ReadOnlyModeError(operation, context.path)
}
