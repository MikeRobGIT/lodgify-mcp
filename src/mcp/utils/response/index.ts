/**
 * Response Enhancer Utility
 * Provides contextual enhancement for API responses to improve user experience
 *
 * This file re-exports all functionality from modularized components
 * to maintain backward compatibility after refactoring
 */

// Export currency formatter
export { formatCurrency } from '../currency-formatter.js'
// Export date formatters
export { calculateNights, formatDate } from '../date/formatter.js'
// Export main enhancement functions
export {
  enhanceResponse,
  extractEntityDetails,
  flexibleEnhanceResponse,
  formatMcpResponse,
} from './builder.js'
// Export all types from response-types
export type {
  ApiResponseData,
  EnhancedResponse,
  EnhanceOptions,
  EntityType,
  FlexibleBuilderOptions,
  OperationStatus,
  OperationType,
} from './types.js'
// Export validators
export { isApiResponseData, toApiResponseData } from './validators.js'
