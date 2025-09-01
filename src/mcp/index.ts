/**
 * MCP Module Exports
 * Central export point for all MCP-related functionality
 */

// Error handling
export { McpErrorHandler } from './errors/handler.js'
export { sanitizeErrorDetails, sanitizeErrorMessage } from './errors/sanitizer.js'
export { ResourceRegistry } from './resources/registry.js'
// Common schemas
export * from './schemas/common.js'
// Core setup
export { setupServer, startServer } from './server-setup.js'

// Deprecation system
export {
  DEPRECATED_TOOLS,
  generateDeprecationWarning,
  getDeprecatedTools,
  registerToolWithDeprecation,
} from './tools/deprecation.js'

// Helper functions
export { findProperties, validateQuoteParams } from './tools/helper-tools.js'
// Registries
export { ToolRegistry } from './tools/registry.js'

// Types
export type * from './utils/types.js'
