/**
 * Register All Tools
 * Central registration point for all MCP tools
 */

import type { LodgifyOrchestrator } from '../../lodgify-orchestrator.js'
import type { IToolRegistry } from '../utils/types.js'
import { getAvailabilityTools } from './availability-tools.js'
import { getBookingTools } from './booking-tools.js'
import { getMessagingTools } from './messaging-tools.js'
import { getPropertyTools } from './property-tools.js'
import { getRateTools } from './rate-tools.js'
import { getWebhookTools } from './webhook-tools.js'

/**
 * Register all tools with the registry
 */
export function registerAllTools(
  registry: IToolRegistry,
  getClient: () => LodgifyOrchestrator,
): void {
  // Register property management tools
  const propertyTools = getPropertyTools(getClient)
  for (const tool of propertyTools) {
    registry.register(tool)
  }

  // Register booking management tools
  const bookingTools = getBookingTools(getClient)
  for (const tool of bookingTools) {
    registry.register(tool)
  }

  // Register availability tools
  const availabilityTools = getAvailabilityTools(getClient)
  for (const tool of availabilityTools) {
    registry.register(tool)
  }

  // Register rate management tools
  const rateTools = getRateTools(getClient)
  for (const tool of rateTools) {
    registry.register(tool)
  }

  // Register webhook tools
  const webhookTools = getWebhookTools(getClient)
  for (const tool of webhookTools) {
    registry.register(tool)
  }

  // Register messaging tools
  const messagingTools = getMessagingTools(getClient)
  for (const tool of messagingTools) {
    registry.register(tool)
  }
}
