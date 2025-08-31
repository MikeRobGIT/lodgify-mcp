/**
 * Tool Registry
 * Central registry for all MCP tools
 */

import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import type { ZodRawShape } from 'zod'
import type { IToolRegistry, ToolCategory, ToolRegistration } from '../utils/types.js'
import { registerToolWithDeprecation } from './deprecation.js'

/**
 * Tool Registry Implementation
 */
export class ToolRegistry implements IToolRegistry {
  private tools: ToolRegistration[] = []
  private toolsByCategory: Map<ToolCategory, ToolRegistration[]> = new Map()

  /**
   * Register a tool
   */
  register<TInput extends ZodRawShape>(registration: ToolRegistration<TInput>): void {
    this.tools.push(registration as ToolRegistration)

    // Add to category map
    const categoryTools = this.toolsByCategory.get(registration.category) || []
    categoryTools.push(registration as ToolRegistration)
    this.toolsByCategory.set(registration.category, categoryTools)
  }

  /**
   * Register all tools with the MCP server
   */
  registerAll(server: McpServer): void {
    for (const tool of this.tools) {
      // Register with deprecation handling
      // The handler already has access to getClient via closure
      // biome-ignore lint/suspicious/noExplicitAny: MCP SDK requires this type cast for handler compatibility
      registerToolWithDeprecation(server, tool.name, tool.config, tool.handler as any)
    }
  }

  /**
   * Get all registered tools
   */
  getTools(): ToolRegistration[] {
    return [...this.tools]
  }

  /**
   * Get tools organized by category
   */
  getCategories(): Record<ToolCategory, ToolRegistration[]> {
    const result: Partial<Record<ToolCategory, ToolRegistration[]>> = {}

    for (const [category, tools] of this.toolsByCategory.entries()) {
      result[category] = [...tools]
    }

    return result as Record<ToolCategory, ToolRegistration[]>
  }

  /**
   * Clear all registered tools (useful for testing)
   */
  clear(): void {
    this.tools = []
    this.toolsByCategory.clear()
  }
}
