/**
 * Error handling module exports
 */

export { ErrorHandler } from './error-handler.js'
export {
  createReadOnlyError,
  isReadOnlyModeError,
  ReadOnlyModeError,
} from './read-only-error.js'
export type {
  ErrorHandlerConfig,
  HttpErrorResponse,
  LodgifyError,
  ValidationResult,
} from './types.js'
