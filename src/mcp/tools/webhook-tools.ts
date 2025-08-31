/**
 * Webhook Management Tools Module
 * Contains all webhook-related MCP tool registrations
 */

import { z } from 'zod'
import type { WebhookSubscribeRequest } from '../../api/v1/webhooks/types.js'
import type { LodgifyOrchestrator } from '../../lodgify-orchestrator.js'
import { WebhookEventEnum } from '../schemas/common.js'
import type { ToolCategory, ToolRegistration } from '../utils/types.js'

const CATEGORY: ToolCategory = 'Webhooks & Notifications'

/**
 * Get all webhook management tools
 */
export function getWebhookTools(getClient: () => LodgifyOrchestrator): ToolRegistration[] {
  return [
    // List webhooks tool
    {
      name: 'lodgify_list_webhooks',
      category: CATEGORY,
      config: {
        title: 'List Webhooks',
        description: `[${CATEGORY}] List all webhook subscriptions configured for the account. Returns webhook details including event types, target URLs, status, and last triggered timestamps. Essential for monitoring and managing webhook integrations.
      
Example response:
{
  "webhooks": [
    {
      "id": "webhook_123",
      "event": "booking_new_status_booked",
      "target_url": "https://example.com/webhooks/lodgify",
      "created_at": "2024-01-15T10:00:00Z",
      "last_triggered_at": "2024-03-20T14:30:00Z",
      "status": "active"
    }
  ],
  "total": 5
}`,
        inputSchema: {},
      },
      handler: async () => {
        const result = await getClient().webhooks.listWebhooks()
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(result, null, 2),
            },
          ],
        }
      },
    },

    // Subscribe webhook tool
    {
      name: 'lodgify_subscribe_webhook',
      category: CATEGORY,
      config: {
        title: 'Subscribe to Webhook Events',
        description: `[${CATEGORY}] Subscribe to webhook events to receive real-time notifications when specific events occur in Lodgify. Supports various event types including booking changes, rate updates, and guest messages.
      
Available event types:
- rate_change: Rate or pricing changes
- availability_change: Availability updates
- booking_new_any_status: Any new booking created
- booking_new_status_booked: New confirmed bookings only
- booking_change: Any booking modification
- booking_status_change_booked: Booking status changed to booked
- booking_status_change_tentative: Booking status changed to tentative
- booking_status_change_open: Booking status changed to open
- booking_status_change_declined: Booking status changed to declined
- guest_message_received: New guest message received

Example request:
{
  "event": "booking_new_status_booked",
  "target_url": "https://example.com/webhooks/lodgify"
}`,
        inputSchema: {
          event: WebhookEventEnum.describe('Event type to subscribe to'),
          target_url: z
            .string()
            .url()
            .describe('HTTPS URL endpoint to receive webhook notifications'),
        },
      },
      handler: async ({ event, target_url }) => {
        const subscribeData: WebhookSubscribeRequest = {
          event,
          target_url,
        }
        const result = await getClient().webhooks.subscribeWebhook(subscribeData)
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(result, null, 2),
            },
          ],
        }
      },
    },

    // Unsubscribe webhook tool
    {
      name: 'lodgify_unsubscribe_webhook',
      category: CATEGORY,
      config: {
        title: 'Unsubscribe from Webhook',
        description: `[${CATEGORY}] Remove a webhook subscription to stop receiving event notifications. This is a permanent action that cannot be undone. Use the webhook ID obtained from lodgify_list_webhooks.
      
Example request:
{
  "id": "webhook_123"
}`,
        inputSchema: {
          id: z.string().min(1).describe('Webhook subscription ID to remove'),
        },
      },
      handler: async ({ id }) => {
        await getClient().webhooks.unsubscribeWebhook({ id })
        return {
          content: [
            {
              type: 'text',
              text: `Successfully unsubscribed from webhook: ${id}`,
            },
          ],
        }
      },
    },
  ]
}
