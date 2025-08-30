/**
 * API Client Orchestrator
 * Manages and coordinates all API modules
 */

import { ReadOnlyModeError } from '../core/errors/read-only-error.js'
import type { Logger } from '../core/http/types.js'
import { BaseApiClient } from './base-client.js'
import { ApiModuleFactory } from './base-module.js'

/**
 * Orchestrator configuration
 */
export interface OrchestratorConfig {
  apiKey: string
  baseUrl?: string
  defaultVersion?: 'v1' | 'v2'
  logger?: Logger
  readOnly?: boolean
}

/**
 * Module registration function
 */
export type ModuleRegistrar<T> = (client: BaseApiClient) => T

/**
 * API Client Orchestrator
 * Central coordinator for all API operations
 */
export class ApiClientOrchestrator extends BaseApiClient {
  private readonly moduleFactory: ApiModuleFactory

  constructor(config: OrchestratorConfig) {
    super(
      config.apiKey,
      config.defaultVersion || 'v2',
      config.baseUrl || 'https://api.lodgify.com',
      config.logger,
      config.readOnly || false,
    )

    this.moduleFactory = new ApiModuleFactory(this)
  }

  /**
   * Register an API module
   */
  registerModule<T extends { name: string; version: 'v1' | 'v2' | 'both' }>(
    name: string,
    registrar: ModuleRegistrar<T>,
  ): T {
    return this.moduleFactory.register(name, registrar as (client: BaseApiClient) => T)
  }

  /**
   * Get a registered module
   */
  getModule<T extends { name: string; version: 'v1' | 'v2' | 'both' }>(
    name: string,
  ): T | undefined {
    return this.moduleFactory.get(name) as T | undefined
  }

  /**
   * Check if module is registered
   */
  hasModule(name: string): boolean {
    return this.moduleFactory.has(name)
  }

  /**
   * Get all registered modules
   */
  getAllModules() {
    return this.moduleFactory.getAll()
  }

  /**
   * Execute an operation across multiple modules
   */
  async executeAcrossModules<T>(
    operation: (module: { name: string; version: 'v1' | 'v2' | 'both' }) => Promise<T>,
    moduleNames?: string[],
  ): Promise<Map<string, T>> {
    const results = new Map<string, T>()
    const modules = moduleNames
      ? moduleNames.map((name) => ({ name, module: this.getModule(name) }))
      : this.getAllModules().map((module) => ({ name: module.name, module }))

    // Execute operations in parallel
    const promises = modules
      .filter(({ module }) => module !== undefined)
      .map(async ({ name, module }) => {
        if (!module) return // Type guard - we filtered undefined above
        try {
          const result = await operation(module)
          results.set(name, result)
        } catch (error) {
          this.log('error', `Failed to execute operation on module ${name}`, error)
          throw error
        }
      })

    await Promise.all(promises)
    return results
  }

  /**
   * Batch operations across multiple endpoints
   */
  async batch<T>(
    operations: Array<{
      method: string
      path: string
      options?: Record<string, unknown>
    }>,
  ): Promise<T[]> {
    // Check for write operations in read-only mode
    if (this.readOnly) {
      const writeOperations = operations.filter((op) =>
        ['POST', 'PUT', 'PATCH', 'DELETE'].includes(op.method.toUpperCase()),
      )
      if (writeOperations.length > 0) {
        const firstWriteOp = writeOperations[0]
        throw ReadOnlyModeError.forApiOperation(
          firstWriteOp.method.toUpperCase(),
          firstWriteOp.path,
          `Batch operation containing ${writeOperations.length} write operations`,
        )
      }
    }

    // Execute all operations in parallel with rate limiting
    const results = await Promise.all(
      operations.map((op) => this.request<T>(op.method, op.path, op.options)),
    )

    return results
  }

  /**
   * Transaction-like operation with rollback support
   */
  async transaction<T>(
    operations: Array<{
      execute: () => Promise<T>
      rollback?: () => Promise<void>
    }>,
  ): Promise<T[]> {
    // Note: We can't easily check if operations are write operations since they're functions
    // The read-only check will happen at the individual request level in each operation
    // This is acceptable since the transaction itself doesn't bypass the read-only checks

    const results: T[] = []
    const executed: Array<{ rollback?: () => Promise<void> }> = []

    try {
      for (const op of operations) {
        const result = await op.execute()
        results.push(result)
        executed.push(op)
      }
      return results
    } catch (error) {
      // Rollback in reverse order
      this.log('warn', 'Transaction failed, rolling back operations')

      for (const op of executed.reverse()) {
        if (op.rollback) {
          try {
            await op.rollback()
          } catch (rollbackError) {
            this.log('error', 'Rollback failed', rollbackError)
          }
        }
      }

      throw error
    }
  }

  /**
   * Health check across all registered modules
   */
  async healthCheck(): Promise<{
    healthy: boolean
    modules: Map<string, { healthy: boolean; error?: string }>
  }> {
    const moduleHealth = new Map<string, { healthy: boolean; error?: string }>()
    let allHealthy = true

    for (const module of this.getAllModules()) {
      try {
        // Try a simple operation to verify module is working
        // This could be overridden per module for specific health checks
        await this.request('GET', `/${module.version}/health`, {
          skipRetry: true,
          skipRateLimit: true,
        })
        moduleHealth.set(module.name, { healthy: true })
      } catch (error) {
        allHealthy = false
        moduleHealth.set(module.name, {
          healthy: false,
          error: error instanceof Error ? error.message : String(error),
        })
      }
    }

    return {
      healthy: allHealthy,
      modules: moduleHealth,
    }
  }

  /**
   * Clear all modules (useful for testing)
   */
  clearModules(): void {
    this.moduleFactory.clear()
  }
}
