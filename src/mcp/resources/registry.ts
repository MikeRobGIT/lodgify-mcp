/**
 * Resource Registry
 * Central registry for all MCP resources
 */

import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import type { IResourceRegistry, ResourceRegistration } from '../utils/types.js'

/**
 * Resource Registry Implementation
 */
export class ResourceRegistry implements IResourceRegistry {
  private resources: ResourceRegistration[] = []

  /**
   * Register a resource
   */
  register(registration: ResourceRegistration): void {
    this.resources.push(registration)
  }

  /**
   * Register all resources with the MCP server
   */
  registerAll(server: McpServer): void {
    for (const resource of this.resources) {
      // The handler already has access to getClient via closure
      // biome-ignore lint/suspicious/noExplicitAny: MCP SDK requires this type cast for handler compatibility
      server.registerResource(resource.name, resource.uri, resource.config, resource.handler as any)
    }
  }

  /**
   * Get all registered resources
   */
  getResources(): ResourceRegistration[] {
    return [...this.resources]
  }
}
