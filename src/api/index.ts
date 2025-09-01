/**
 * API Layer Module Exports
 * Central export point for all API architecture components
 */

// Base client and types
export {
  type ApiModule,
  type ApiRequestOptions,
  BaseApiClient,
  type CrudOperations,
  createApiModule,
  isListResponse,
  isSingleResponse,
  type ListResponse,
  type SingleResponse,
} from './base-client.js'

// Base module
export {
  ApiModuleFactory,
  BaseApiModule,
  type ModuleConfig,
} from './base-module.js'

// Client orchestrator
export {
  ApiClientOrchestrator,
  type ModuleRegistrar,
  type OrchestratorConfig,
} from './client-orchestrator.js'
