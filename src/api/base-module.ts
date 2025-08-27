/**
 * Base API Module
 * Foundation for all domain-specific API modules
 */

import type { ApiModule, BaseApiClient } from './base-client.js'

/**
 * Module configuration
 */
export interface ModuleConfig {
  name: string
  version: 'v1' | 'v2' | 'both'
  basePath: string
}

/**
 * Base class for API modules
 * Provides common functionality for all domain modules
 */
export abstract class BaseApiModule implements ApiModule {
  readonly name: string
  readonly version: 'v1' | 'v2' | 'both'
  protected readonly basePath: string
  protected readonly client: BaseApiClient

  constructor(client: BaseApiClient, config: ModuleConfig) {
    this.client = client
    this.name = config.name
    this.version = config.version
    this.basePath = config.basePath
  }

  /**
   * Build full endpoint path
   */
  protected buildEndpoint(path: string): string {
    // Remove leading slash from path if present
    const cleanPath = path.startsWith('/') ? path.slice(1) : path
    // Combine base path with specific path, handling empty cleanPath
    if (!this.basePath) {
      return cleanPath
    }
    return cleanPath ? `${this.basePath}/${cleanPath}` : this.basePath
  }

  /**
   * Execute request through the client
   */
  protected async request<T>(
    method: string,
    path: string,
    options?: Record<string, unknown>,
  ): Promise<T> {
    const endpoint = this.buildEndpoint(path)
    // Add API version to options if module has a specific version
    const requestOptions = {
      ...options,
      apiVersion: this.version === 'both' ? undefined : this.version,
    }
    return this.client.request<T>(method, endpoint, requestOptions)
  }

  /**
   * List resources
   */
  protected list<T>(path: string, params?: Record<string, unknown>): Promise<T> {
    return this.request<T>('GET', path, { params })
  }

  /**
   * Get single resource
   */
  protected get<T>(path: string, id: string): Promise<T> {
    return this.request<T>('GET', `${path}/${id}`)
  }

  /**
   * Create resource
   */
  protected create<T>(path: string, data: unknown): Promise<T> {
    return this.request<T>('POST', path, { body: data as Record<string, unknown> })
  }

  /**
   * Update resource
   */
  protected update<T>(path: string, id: string, data: unknown): Promise<T> {
    return this.request<T>('PUT', `${path}/${id}`, { body: data as Record<string, unknown> })
  }

  /**
   * Delete resource
   */
  protected delete<T = void>(path: string, id: string): Promise<T> {
    return this.request<T>('DELETE', `${path}/${id}`)
  }
}

/**
 * Factory for creating typed module instances
 */
export class ApiModuleFactory {
  private modules: Map<string, ApiModule> = new Map()

  constructor(private client: BaseApiClient) {}

  /**
   * Register a module
   */
  register<T extends ApiModule>(name: string, factory: (client: BaseApiClient) => T): T {
    if (this.modules.has(name)) {
      return this.modules.get(name) as T
    }

    const module = factory(this.client)
    this.modules.set(name, module)
    return module
  }

  /**
   * Get a registered module
   */
  get<T extends ApiModule>(name: string): T | undefined {
    return this.modules.get(name) as T
  }

  /**
   * Check if module is registered
   */
  has(name: string): boolean {
    return this.modules.has(name)
  }

  /**
   * Get all registered modules
   */
  getAll(): ApiModule[] {
    return Array.from(this.modules.values())
  }

  /**
   * Clear all modules
   */
  clear(): void {
    this.modules.clear()
  }
}
