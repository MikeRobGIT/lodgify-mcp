/**
 * MCP-specific type definitions and interfaces
 */

import type { McpServer, ToolCallback } from '@modelcontextprotocol/sdk/server/mcp.js'
import type { ToolAnnotations } from '@modelcontextprotocol/sdk/types.js'
import type { ZodRawShape } from 'zod'
import type { LodgifyOrchestrator } from '../../lodgify-orchestrator.js'

/**
 * Tool registration configuration
 */
export interface ToolConfig<TInput extends ZodRawShape = ZodRawShape> {
  title?: string
  description?: string
  inputSchema?: TInput
  /**
   * MCP behavior hints. openWorldHint rule: true only when the tool sends data to,
   * or messages, a party outside the Lodgify account (webhook target, guest email).
   * Guest-authored text returned by read tools does not make a tool open-world.
   * Tools without readOnlyHint: true are hidden in LODGIFY_READ_ONLY mode.
   */
  annotations?: ToolAnnotations
}

/**
 * Tool deprecation information
 */
export interface DeprecationInfo {
  /** Version when deprecation started */
  since: string
  /** Version when tool will be removed (optional) */
  removeIn?: string
  /** Reason for deprecation */
  reason: string
  /** Suggested replacement tool (optional) */
  replacement?: string
  /** Whether to log usage warnings (default: true) */
  logWarnings?: boolean
}

/**
 * Tool category type
 */
export type ToolCategory =
  | 'Property Management'
  | 'Booking & Reservation Management'
  | 'Availability & Calendar'
  | 'Rates & Pricing'
  | 'Webhooks & Notifications'
  | 'Property Discovery & Search'
  | 'Messaging & Communication'

/**
 * Tool registration entry
 */
export interface ToolRegistration<TInput extends ZodRawShape = ZodRawShape> {
  name: string
  category: ToolCategory
  config: ToolConfig<TInput>
  handler: ToolCallback<TInput>
  deprecated?: DeprecationInfo
}

/**
 * Resource registration configuration
 */
export interface ResourceConfig {
  title: string
  description: string
  mimeType: string
  [key: string]: string | number | boolean | undefined // Allow additional properties for MCP compatibility
}

/**
 * Resource registration entry
 */
export interface ResourceRegistration {
  name: string
  uri: string
  config: ResourceConfig
  handler: (uri: URL) => Promise<{
    contents: Array<{
      uri: string
      mimeType: string
      text: string
    }>
  }>
}

/**
 * Dependency health status
 */
export interface DependencyHealth {
  status: 'healthy' | 'unhealthy' | 'degraded'
  responseTime?: number
  lastChecked: string
  error?: string
  details?: string
}

/**
 * Server configuration
 */
export interface ServerConfig {
  name: string
  version: string
  capabilities?: {
    tools?: {
      listChanged?: boolean
    }
    resources?: {
      listChanged?: boolean
    }
    logging?: Record<string, unknown>
  }
  debouncedNotificationMethods?: string[]
}

/**
 * Tool registry interface
 */
export interface IToolRegistry {
  register<TInput extends ZodRawShape>(registration: ToolRegistration<TInput>): void
  registerAll(server: McpServer, options?: { readOnly?: boolean }): void
  getTools(): ToolRegistration[]
  getCategories(): Record<ToolCategory, ToolRegistration[]>
}

/**
 * Resource registry interface
 */
export interface IResourceRegistry {
  register(registration: ResourceRegistration): void
  registerAll(server: McpServer): void
  getResources(): ResourceRegistration[]
}

/**
 * Error handler interface
 */
export interface IErrorHandler {
  handleToolError(error: unknown): never
  sanitizeErrorMessage(message: string): string
  sanitizeErrorDetails(details: unknown): unknown
}

/**
 * Server setup interface
 */
export interface IServerSetup {
  setupServer(injectedClient?: LodgifyOrchestrator): {
    server: McpServer
    getClient: () => LodgifyOrchestrator
    client?: LodgifyOrchestrator
  }
  startServer(): Promise<void>
}
