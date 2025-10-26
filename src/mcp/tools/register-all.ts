/**
 * Register All Tools
 * Central registration point for all MCP tools
 */

import type { ToolSetIdentifier } from '../../env.js'
import type { LodgifyOrchestrator } from '../../lodgify-orchestrator.js'
import type { IToolRegistry } from '../utils/types.js'
import { getAvailabilityTools } from './availability-tools.js'
import { getBookingTools } from './booking-tools.js'
import { getMessagingTools } from './messaging-tools.js'
import { getPropertyTools } from './property-tools.js'
import { getRateTools } from './rate-tools.js'
import { getWebhookTools } from './webhook-tools.js'

interface RegisterAllToolsOptions {
  enabledToolSets?: Iterable<ToolSetIdentifier>
}

const CATEGORY_TOOL_SET_MAP = {
  'Property Management': 'properties',
  'Property Discovery & Search': 'properties',
  'Booking & Reservation Management': 'bookings',
  'Availability & Calendar': 'availability',
  'Rates & Pricing': 'rates',
  'Webhooks & Notifications': 'webhooks',
  'Messaging & Communication': 'messaging',
} as const satisfies Record<string, ToolSetIdentifier>

function resolveToolSet(
  tool: Parameters<IToolRegistry['register']>[0],
): ToolSetIdentifier | undefined {
  if (tool.category === 'Rates & Pricing') {
    const toolName = tool.name.toLowerCase()
    if (toolName.includes('quote')) {
      return 'quotes'
    }
  }

  const mapped = CATEGORY_TOOL_SET_MAP[tool.category as keyof typeof CATEGORY_TOOL_SET_MAP]
  return mapped
}

/**
 * Register all tools with the registry
 */
export function registerAllTools(
  registry: IToolRegistry,
  getClient: () => LodgifyOrchestrator,
  options: RegisterAllToolsOptions = {},
): void {
  const enabledSet = options.enabledToolSets ? new Set(options.enabledToolSets) : undefined

  const shouldRegister = (tool: Parameters<IToolRegistry['register']>[0]): boolean => {
    if (!enabledSet) {
      return true
    }

    const toolSet = resolveToolSet(tool)
    if (!toolSet) {
      // If the tool doesn't map to a known set, allow it by default
      return true
    }

    return enabledSet.has(toolSet)
  }

  // Register property management tools
  const propertyTools = getPropertyTools(getClient)
  for (const tool of propertyTools) {
    if (shouldRegister(tool)) {
      registry.register(tool)
    }
  }

  // Register booking management tools
  const bookingTools = getBookingTools(getClient)
  for (const tool of bookingTools) {
    if (shouldRegister(tool)) {
      registry.register(tool)
    }
  }

  // Register availability tools
  const availabilityTools = getAvailabilityTools(getClient)
  for (const tool of availabilityTools) {
    if (shouldRegister(tool)) {
      registry.register(tool)
    }
  }

  // Register rate management tools
  const rateTools = getRateTools(getClient)
  for (const tool of rateTools) {
    if (shouldRegister(tool)) {
      registry.register(tool)
    }
  }

  // Register webhook tools
  const webhookTools = getWebhookTools(getClient)
  for (const tool of webhookTools) {
    if (shouldRegister(tool)) {
      registry.register(tool)
    }
  }

  // Register messaging tools
  const messagingTools = getMessagingTools(getClient)
  for (const tool of messagingTools) {
    if (shouldRegister(tool)) {
      registry.register(tool)
    }
  }
}
