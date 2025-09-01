/**
 * Tool Deprecation System
 * Manages deprecated tools and provides migration guidance
 */

import type { McpServer, ToolCallback } from '@modelcontextprotocol/sdk/server/mcp.js'
import type { ZodRawShape } from 'zod'
import { safeLogger } from '../../logger.js'
import type { DeprecationInfo, ToolConfig } from '../utils/types.js'

/**
 * Tool deprecation registry
 *
 * This system allows graceful handling of deprecated tools and API changes.
 * Deprecated tools will continue to work but will include deprecation warnings
 * in their descriptions and can log usage warnings.
 *
 * @example
 * ```typescript
 * // To deprecate a tool:
 * DEPRECATED_TOOLS.tool_name = {
 *   since: '0.2.0',
 *   removeIn: '1.0.0',
 *   reason: 'Replaced by new_tool_name for better performance',
 *   replacement: 'new_tool_name'
 * }
 * ```
 */
export const DEPRECATED_TOOLS: Record<string, DeprecationInfo> = {
  // Example deprecations showing how the system works
  // Note: Previously deprecated tools that don't exist in the official API have been removed
}

/**
 * Generate deprecation warning text for tool descriptions
 */
export function generateDeprecationWarning(_toolName: string, info: DeprecationInfo): string {
  let warning = `⚠️ **DEPRECATED** (since v${info.since}): ${info.reason}`

  if (info.replacement) {
    warning += ` Please use '${info.replacement}' instead.`
  }

  if (info.removeIn) {
    warning += ` This tool will be removed in v${info.removeIn}.`
  }

  return warning
}

/**
 * Enhanced tool registration that handles deprecation warnings
 */
export function registerToolWithDeprecation<TInput extends ZodRawShape = ZodRawShape>(
  server: McpServer,
  toolName: string,
  toolConfig: ToolConfig<TInput>,
  handler: ToolCallback<TInput>,
): void {
  const deprecationInfo = DEPRECATED_TOOLS[toolName]

  if (deprecationInfo) {
    // Add deprecation warning to description
    const warning = generateDeprecationWarning(toolName, deprecationInfo)
    toolConfig.description = `${warning}\n\n${toolConfig.description}`

    // Wrap handler to log deprecation warnings
    const originalHandler = handler
    // Create a properly typed wrapper that handles both cases
    const wrappedHandler = async (input: TInput) => {
      if (deprecationInfo.logWarnings !== false) {
        safeLogger.warn(`Deprecated tool '${toolName}' used`, {
          tool: toolName,
          deprecatedSince: deprecationInfo.since,
          removeIn: deprecationInfo.removeIn,
          replacement: deprecationInfo.replacement,
          reason: deprecationInfo.reason,
        })
      }
      // Call original handler with the arguments
      // The handler is already properly typed, so this maintains type safety
      // @ts-expect-error - Handler may be called with different argument patterns
      return originalHandler(input)
    }

    server.registerTool(toolName, toolConfig, wrappedHandler as unknown as ToolCallback<TInput>)
  } else {
    // Register normally if not deprecated
    server.registerTool(toolName, toolConfig, handler)
  }
}

/**
 * Get all deprecated tools with their warnings
 */
export function getDeprecatedTools(): Array<{
  tool: string
  deprecatedSince: string
  removeIn: string
  reason: string
  replacement?: string
  warning: string
}> {
  return Object.entries(DEPRECATED_TOOLS).map(([toolName, info]) => ({
    tool: toolName,
    deprecatedSince: info.since,
    removeIn: info.removeIn || 'TBD',
    reason: info.reason,
    replacement: info.replacement,
    warning: generateDeprecationWarning(toolName, info),
  }))
}
