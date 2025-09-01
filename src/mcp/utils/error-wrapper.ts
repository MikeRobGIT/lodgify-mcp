/**
 * Error Wrapper Utility
 * Ensures errors from tool handlers are properly serialized before reaching MCP SDK
 */

import { ErrorCode, McpError } from '@modelcontextprotocol/sdk/types.js'
import { safeLogger } from '../../logger.js'

/**
 * Wraps a tool handler to ensure errors are properly serialized
 *
 * This wrapper catches any errors thrown by the handler and ensures they're
 * converted to properly serializable error messages before re-throwing.
 * This prevents "[object Object]" from appearing in error responses.
 *
 * @param handler The original tool handler function
 * @param toolName The name of the tool (for logging)
 * @returns A wrapped handler that properly serializes errors
 */
export function wrapToolHandler<TInput = unknown, TOutput = unknown>(
  handler: (input: TInput) => Promise<TOutput>,
  toolName: string,
): (input: TInput) => Promise<TOutput> {
  return async (input: TInput): Promise<TOutput> => {
    try {
      // Call the original handler
      return await handler(input)
    } catch (error) {
      // Log the error for debugging
      if (process.env.DEBUG_HTTP === '1') {
        safeLogger.debug(`Error in tool ${toolName}:`, {
          errorType: typeof error,
          errorConstructor: error?.constructor?.name,
          isError: error instanceof Error,
          isMcpError: error instanceof McpError,
          errorMessage: error instanceof Error ? error.message : String(error),
        })
      }

      // If it's already an McpError, make sure it's properly serializable
      if (error instanceof McpError) {
        // McpError should already be properly formatted, but ensure the message is a string
        throw new McpError(error.code, String(error.message), error.data)
      }

      // Check if it's a LodgifyError (has error: true, message, status, and detail fields)
      if (
        error &&
        typeof error === 'object' &&
        'error' in error &&
        'message' in error &&
        'status' in error
      ) {
        const lodgifyError = error as {
          error: boolean
          message: string
          status: number
          path?: string
          detail?: unknown
        }

        // Build a comprehensive error message including detail
        let errorMessage = lodgifyError.message

        // If there's detail, append it to the message for better visibility
        if (lodgifyError.detail) {
          // Check if detail has a message property
          if (typeof lodgifyError.detail === 'object' && 'message' in lodgifyError.detail) {
            errorMessage = `${errorMessage}: ${lodgifyError.detail.message}`
          } else if (typeof lodgifyError.detail === 'string') {
            errorMessage = `${errorMessage}: ${lodgifyError.detail}`
          } else if (typeof lodgifyError.detail === 'object') {
            // For object details, try to extract useful information
            try {
              const detailStr = JSON.stringify(lodgifyError.detail)
              if (detailStr !== '{}' && detailStr !== 'null') {
                errorMessage = `${errorMessage}: ${detailStr}`
              }
            } catch {
              // If serialization fails, just use the base message
            }
          }
        }

        // Map status codes to appropriate MCP error codes
        let errorCode = ErrorCode.InternalError
        if (lodgifyError.status === 400 || lodgifyError.status === 422) {
          errorCode = ErrorCode.InvalidParams
        } else if (lodgifyError.status === 404) {
          errorCode = ErrorCode.MethodNotFound
        } else if (lodgifyError.status === 401 || lodgifyError.status === 403) {
          errorCode = ErrorCode.InvalidRequest
        }

        // Log the full error for debugging if enabled
        if (process.env.DEBUG_HTTP === '1') {
          safeLogger.debug(`[${toolName}] LodgifyError details:`, {
            message: errorMessage,
            status: lodgifyError.status,
            detail: lodgifyError.detail,
            path: lodgifyError.path,
          })
        }

        // Throw a properly formatted McpError with all relevant information
        throw new McpError(errorCode, errorMessage, {
          tool: toolName,
          status: lodgifyError.status,
          path: lodgifyError.path,
        })
      }

      // If it's a regular Error, convert it to an McpError with a proper message
      if (error instanceof Error) {
        // Extract the error message and ensure it's serializable
        const errorMessage = error.message || 'An unknown error occurred'

        // Determine the appropriate error code based on the error message
        let errorCode = ErrorCode.InternalError

        // Check for common validation errors
        if (
          errorMessage.toLowerCase().includes('required') ||
          errorMessage.toLowerCase().includes('invalid') ||
          errorMessage.toLowerCase().includes('must be')
        ) {
          errorCode = ErrorCode.InvalidParams
        } else if (errorMessage.toLowerCase().includes('not found')) {
          errorCode = ErrorCode.InvalidParams
        } else if (
          errorMessage.toLowerCase().includes('unauthorized') ||
          errorMessage.toLowerCase().includes('api key')
        ) {
          errorCode = ErrorCode.InvalidRequest
        }

        // Throw a properly formatted McpError
        throw new McpError(errorCode, errorMessage, {
          tool: toolName,
          originalError: error.name || 'Error',
        })
      }

      // For any other type of error, convert to string and throw as McpError
      const errorMessage = String(error)
      throw new McpError(ErrorCode.InternalError, errorMessage || 'An unexpected error occurred', {
        tool: toolName,
        errorType: typeof error,
      })
    }
  }
}

/**
 * Helper to wrap multiple tool handlers at once
 *
 * @param handlers Object containing handler functions keyed by tool name
 * @returns Object with wrapped handlers
 */
export function wrapToolHandlers<
  T extends Record<string, (...args: unknown[]) => Promise<unknown>>,
>(handlers: T): T {
  const wrapped: Record<string, unknown> = {}
  for (const [toolName, handler] of Object.entries(handlers)) {
    wrapped[toolName] = wrapToolHandler(handler, toolName)
  }
  return wrapped as T
}
