/**
 * MCP Error Handler Module
 * Handles tool errors with proper JSON-RPC error codes and security-focused sanitization
 */

import { ErrorCode, McpError } from '@modelcontextprotocol/sdk/types.js'
import { z } from 'zod'
import { ReadOnlyModeError } from '../../core/errors/read-only-error.js'
import { type EnvConfig, isProduction } from '../../env.js'
import { safeLogger } from '../../logger.js'
import type { IErrorHandler } from '../utils/types.js'
import { sanitizeErrorDetails, sanitizeErrorMessage } from './sanitizer.js'

/**
 * MCP Error Handler Implementation
 */
export class McpErrorHandler implements IErrorHandler {
  constructor(private getEnvConfig: () => EnvConfig) {}

  /**
   * Helper function to handle tool errors with proper JSON-RPC error codes and security-focused sanitization.
   *
   * This function processes errors from tool handlers and converts them into appropriate
   * McpError instances with proper JSON-RPC error codes. It includes security measures
   * to prevent sensitive information (API keys, tokens, credentials) from leaking to clients.
   *
   * @param error - The error to handle (can be any type)
   * @throws {McpError} Always throws an appropriately formatted McpError
   *
   * @remarks
   * Security features:
   * - Sanitizes error messages to remove API keys, tokens, and credentials
   * - Prevents sensitive environment information from leaking
   * - Provides appropriate error codes for different error types
   * - Maintains detailed logging while protecting client-facing messages
   */
  handleToolError(error: unknown): never {
    // Debug logging to understand error structure (remove in production)
    if (process.env.DEBUG_HTTP === '1') {
      safeLogger.debug('handleToolError received:', {
        type: typeof error,
        constructor: error?.constructor?.name,
        isError: error instanceof Error,
        isMcpError: error instanceof McpError,
        errorObj: error,
      })
    }

    // Handle ReadOnlyModeError specially
    if (error instanceof ReadOnlyModeError) {
      throw new McpError(ErrorCode.InvalidRequest, error.message, {
        ...(error.detail || {}),
        type: 'ReadOnlyModeError',
      })
    }

    // Handle MCP errors (already properly formatted)
    if (error instanceof McpError) {
      // Sanitize existing MCP errors to ensure no sensitive data leaks
      const sanitizedMessage = this.sanitizeErrorMessage(error.message)
      const sanitizedData = error.data ? this.sanitizeErrorDetails(error.data) : undefined

      throw new McpError(error.code, sanitizedMessage, sanitizedData)
    }

    // Handle Zod validation errors
    if (error instanceof z.ZodError) {
      throw new McpError(ErrorCode.InvalidParams, 'Invalid input parameters', {
        validationErrors: error.issues.map((issue) => ({
          path: issue.path.join('.'),
          message: this.sanitizeErrorMessage(issue.message),
          code: issue.code,
        })),
      })
    }

    // Handle structured Lodgify errors first (from ErrorHandler)
    const errorObj = error as unknown as Record<string, unknown>
    const isLodgifyError =
      errorObj?.error === true &&
      typeof errorObj?.status === 'number' &&
      typeof errorObj?.message === 'string'

    if (isLodgifyError) {
      // Extract status and message from Lodgify error
      const status = errorObj.status as number
      const lodgifyMessage = errorObj.message as string
      const detail = errorObj.detail

      if (process.env.DEBUG_HTTP === '1') {
        safeLogger.debug('Processing structured Lodgify error:', {
          status,
          message: lodgifyMessage,
          hasDetail: !!detail,
        })
      }

      // Map Lodgify status codes to appropriate MCP error codes
      let mcpErrorCode: ErrorCode
      if (status === 400) {
        mcpErrorCode = ErrorCode.InvalidParams
      } else if (status === 401 || status === 403) {
        mcpErrorCode = ErrorCode.InvalidRequest
      } else if (status === 404) {
        mcpErrorCode = ErrorCode.InvalidParams
      } else if (status === 429) {
        mcpErrorCode = ErrorCode.RequestTimeout
      } else if (status >= 500) {
        mcpErrorCode = ErrorCode.InternalError
      } else {
        mcpErrorCode = ErrorCode.InternalError
      }

      // Use the Lodgify error message directly (it's already sanitized by ErrorHandler)
      throw new McpError(mcpErrorCode, lodgifyMessage, {
        status,
        detail: detail ? this.sanitizeErrorDetails(detail) : undefined,
        type: 'LodgifyAPIError',
      })
    }

    // Handle regular JavaScript Error objects
    if (error instanceof Error) {
      const message = error.message.toLowerCase()
      const sanitizedMessage = this.sanitizeErrorMessage(error.message)

      // Rate limiting errors
      if (message.includes('429') || message.includes('rate limit')) {
        throw new McpError(
          ErrorCode.RequestTimeout,
          'Rate limit exceeded. Please try again later.',
          {
            originalError: sanitizedMessage,
            retryAfter: (error as { retryAfter?: number }).retryAfter,
          },
        )
      }

      // Authentication errors - be extra careful not to leak API key info
      if (
        message.includes('401') ||
        message.includes('unauthorized') ||
        message.includes('api key')
      ) {
        // Production vs development error messages
        const config = this.getEnvConfig()
        const errorMessage = isProduction(config)
          ? 'Authentication failed. Please verify your API credentials.'
          : 'Authentication failed. Please check your API key configuration.'

        throw new McpError(ErrorCode.InvalidRequest, errorMessage, {
          originalError: sanitizedMessage,
          hint: 'Check API key validity and permissions in your Lodgify account',
        })
      }

      // Not found errors
      if (message.includes('404') || message.includes('not found')) {
        throw new McpError(
          ErrorCode.InvalidParams,
          'Resource not found. Please verify the ID and your access permissions.',
          { originalError: sanitizedMessage },
        )
      }

      // Network errors
      if (
        message.includes('econnrefused') ||
        message.includes('network') ||
        message.includes('fetch')
      ) {
        throw new McpError(
          ErrorCode.InternalError,
          'Network error occurred while connecting to Lodgify API. Please check your connection.',
          {
            originalError: sanitizedMessage,
            hint: 'Verify internet connectivity and Lodgify service status',
          },
        )
      }

      // Generic API errors with details (fallback)
      const errorDetails =
        errorObj?.detail || (errorObj as { response?: { data?: unknown } })?.response?.data
      if (errorDetails) {
        throw new McpError(
          ErrorCode.InternalError,
          sanitizedMessage,
          this.sanitizeErrorDetails(errorDetails),
        )
      }

      // Default error handling - preserve more of the original message
      // Only sanitize credentials, but keep the actual error description
      const preservedMessage = error.message.includes('Lodgify')
        ? sanitizedMessage // Already formatted Lodgify error
        : `Lodgify API Error: ${sanitizedMessage}` // Generic error with context

      throw new McpError(ErrorCode.InternalError, preservedMessage, {
        type: 'LodgifyAPIError',
        originalMessage: sanitizedMessage,
      })
    }

    // Unknown error type - be very careful about what we expose
    const errorString = String(error)
    const sanitizedError = this.sanitizeErrorMessage(errorString)

    throw new McpError(
      ErrorCode.InternalError,
      'An unexpected error occurred while processing your request',
      { error: sanitizedError },
    )
  }

  /**
   * Sanitizes error messages to prevent sensitive information leakage
   */
  sanitizeErrorMessage(message: string): string {
    return sanitizeErrorMessage(message)
  }

  /**
   * Extracts safe error details while removing sensitive information
   */
  sanitizeErrorDetails(details: unknown): unknown {
    return sanitizeErrorDetails(details)
  }
}
