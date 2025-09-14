import pkg from '../package.json' with { type: 'json' }
import type { ToolHandlerArgs } from './types.js'

export interface TestServer {
  tools: Array<{
    name: string
    description: string
    inputSchema: Record<string, unknown>
  }>
  listTools: () => { tools: Array<{ name: string; description: string; inputSchema: unknown }> }
  listResources: () => { resources: Array<{ uri: string; name: string; description: string }> }
  readResource: (args: { uri: string }) => {
    contents: Array<{ uri: string; mimeType: string; text: string }>
  }
}

/**
 * Create a test server with a mock client
 * This is a simplified version of the main server for testing
 */
export function createTestServer(mockClient: unknown): TestServer {
  const tools = [
    // Property Management Tools
    {
      name: 'lodgify_list_properties',
      description: 'List all properties',
      inputSchema: { type: 'object' },
    },
    {
      name: 'lodgify_get_property',
      description: 'Get property by ID',
      inputSchema: { type: 'object', properties: { id: { type: 'string' } }, required: ['id'] },
    },
    {
      name: 'lodgify_list_property_rooms',
      description: 'List property rooms',
      inputSchema: {
        type: 'object',
        properties: { propertyId: { type: 'string' } },
        required: ['propertyId'],
      },
    },
    {
      name: 'lodgify_find_properties',
      description: 'Find properties',
      inputSchema: { type: 'object' },
    },
    {
      name: 'lodgify_list_deleted_properties',
      description: 'List deleted properties',
      inputSchema: { type: 'object' },
    },

    // Booking Management Tools
    {
      name: 'lodgify_list_bookings',
      description: 'List bookings',
      inputSchema: { type: 'object' },
    },
    {
      name: 'lodgify_get_booking',
      description: 'Get booking by ID',
      inputSchema: { type: 'object', properties: { id: { type: 'string' } }, required: ['id'] },
    },
    {
      name: 'lodgify_get_booking_payment_link',
      description: 'Get booking payment link',
      inputSchema: { type: 'object', properties: { id: { type: 'string' } }, required: ['id'] },
    },
    {
      name: 'lodgify_create_booking_payment_link',
      description: 'Create booking payment link',
      inputSchema: {
        type: 'object',
        properties: { id: { type: 'string' }, payload: { type: 'object' } },
        required: ['id', 'payload'],
      },
    },
    {
      name: 'lodgify_update_key_codes',
      description: 'Update key codes',
      inputSchema: {
        type: 'object',
        properties: { id: { type: 'string' }, payload: { type: 'object' } },
        required: ['id', 'payload'],
      },
    },
    {
      name: 'lodgify_checkin_booking',
      description: 'Check-in booking',
      inputSchema: { type: 'object', properties: { id: { type: 'string' } }, required: ['id'] },
    },
    {
      name: 'lodgify_checkout_booking',
      description: 'Check-out booking',
      inputSchema: { type: 'object', properties: { id: { type: 'string' } }, required: ['id'] },
    },
    {
      name: 'lodgify_get_external_bookings',
      description: 'Get external bookings',
      inputSchema: { type: 'object', properties: { id: { type: 'string' } }, required: ['id'] },
    },

    // Rates Management Tools
    {
      name: 'lodgify_daily_rates',
      description: 'Get daily rates',
      inputSchema: {
        type: 'object',
        properties: { params: { type: 'object' } },
        required: ['params'],
      },
    },
    {
      name: 'lodgify_rate_settings',
      description: 'Get rate settings',
      inputSchema: {
        type: 'object',
        properties: { params: { type: 'object' } },
        required: ['params'],
      },
    },

    // Availability Tools

    // New Availability fetch tools
    {
      name: 'lodgify_get_property_availability',
      description: 'Get property availability',
      inputSchema: {
        type: 'object',
        properties: { propertyId: { type: 'string' }, params: { type: 'object' } },
        required: ['propertyId'],
      },
    },
    {
      name: 'lodgify_list_vacant_inventory',
      description: 'List vacant properties and rooms for a date range',
      inputSchema: {
        type: 'object',
        properties: {
          from: { type: 'string' },
          to: { type: 'string' },
          propertyIds: {
            type: 'array',
            items: { anyOf: [{ type: 'string' }, { type: 'number' }] },
          },
          includeRooms: { type: 'boolean' },
          limit: { type: 'number' },
          wid: { type: 'number' },
        },
        required: ['from', 'to'],
      },
    },

    // Quote and Messaging Tools
    {
      name: 'lodgify_get_quote',
      description: 'Get quote',
      inputSchema: {
        type: 'object',
        properties: { propertyId: { type: 'string' }, params: { type: 'object' } },
        required: ['propertyId', 'params'],
      },
    },
    {
      name: 'lodgify_get_thread',
      description: 'Get messaging thread',
      inputSchema: {
        type: 'object',
        properties: { threadGuid: { type: 'string' } },
        required: ['threadGuid'],
      },
    },

    // New Messaging tools
    {
      name: 'lodgify_list_threads',
      description: 'List messaging threads',
      inputSchema: { type: 'object', properties: { params: { type: 'object' } } },
    },
    {
      name: 'lodgify_send_message',
      description: 'Send message to thread',
      inputSchema: {
        type: 'object',
        properties: {
          threadGuid: { type: 'string' },
          message: { type: 'object' },
        },
        required: ['threadGuid', 'message'],
      },
    },
    {
      name: 'lodgify_mark_thread_read',
      description: 'Mark thread as read',
      inputSchema: { type: 'object', properties: { threadGuid: { type: 'string' } } },
    },
    {
      name: 'lodgify_archive_thread',
      description: 'Archive thread',
      inputSchema: { type: 'object', properties: { threadGuid: { type: 'string' } } },
    },

    // v1 Webhook Management Tools
    {
      name: 'lodgify_list_webhooks',
      description: 'List webhooks',
      inputSchema: { type: 'object' },
    },
    {
      name: 'lodgify_subscribe_webhook',
      description: 'Subscribe to webhook',
      inputSchema: {
        type: 'object',
        properties: { payload: { type: 'object' } },
        required: ['payload'],
      },
    },
    {
      name: 'lodgify_unsubscribe_webhook',
      description: 'Unsubscribe from webhook',
      inputSchema: { type: 'object', properties: { id: { type: 'string' } }, required: ['id'] },
    },

    // v1 Booking CRUD Tools
    {
      name: 'lodgify_create_booking',
      description: 'Create booking',
      inputSchema: {
        type: 'object',
        properties: { payload: { type: 'object' } },
        required: ['payload'],
      },
    },
    {
      name: 'lodgify_update_booking',
      description: 'Update booking',
      inputSchema: {
        type: 'object',
        properties: { id: { type: 'string' }, payload: { type: 'object' } },
        required: ['id', 'payload'],
      },
    },
    {
      name: 'lodgify_delete_booking',
      description: 'Delete booking',
      inputSchema: { type: 'object', properties: { id: { type: 'string' } }, required: ['id'] },
    },

    // v1 Rate Management Tools
    {
      name: 'lodgify_update_rates',
      description: 'Update rates',
      inputSchema: {
        type: 'object',
        properties: { payload: { type: 'object' } },
        required: ['payload'],
      },
    },
  ]

  const resources = [
    {
      uri: 'lodgify://health',
      name: 'Health Check',
      description: 'Check the health status of the Lodgify MCP server',
      mimeType: 'application/json',
    },
  ]

  return {
    // List tools handler
    async listTools() {
      return { tools }
    },

    // Call tool handler
    async callTool(name: string, args: ToolHandlerArgs) {
      try {
        let result: unknown

        switch (name) {
          // Property Management Tools
          case 'lodgify_list_properties':
            result = await mockClient.listProperties(args.params)
            break
          case 'lodgify_get_property':
            result = await mockClient.getProperty(args.id)
            break
          case 'lodgify_list_property_rooms':
            result = await mockClient.listPropertyRooms(args.propertyId)
            break
          case 'lodgify_find_properties': {
            // Mock implementation for find_properties
            const properties = []
            const propertyIds = new Set()

            // Add properties from listProperties
            const propertiesData = await mockClient.listProperties(args.params)
            if (propertiesData?.items) {
              for (const property of propertiesData.items.slice(0, args.limit || 10)) {
                properties.push({
                  id: property.id.toString(),
                  name: property.name || `Property ${property.id}`,
                  source: 'property_list',
                })
                propertyIds.add(property.id.toString())
              }
            }

            // Add property IDs from bookings if enabled
            if (args.includePropertyIds !== false) {
              const bookingsData = await mockClient.listBookings()
              if (bookingsData?.items) {
                for (const booking of bookingsData.items) {
                  if (booking.property_id && !propertyIds.has(booking.property_id.toString())) {
                    properties.push({
                      id: booking.property_id.toString(),
                      name: `Property ${booking.property_id}`,
                      source: 'bookings',
                    })
                    propertyIds.add(booking.property_id.toString())
                  }
                }
              }
            }

            result = {
              properties,
              message: `Found ${properties.length} property(ies)`,
              suggestions: ['Use one of these property IDs with availability tools'],
            }
            break
          }
          case 'lodgify_list_deleted_properties':
            result = await mockClient.listDeletedProperties(args.params)
            break

          // Booking Management Tools
          case 'lodgify_list_bookings':
            result = await mockClient.listBookings(args.params)
            break
          case 'lodgify_get_booking':
            result = await mockClient.getBooking(args.id)
            break
          case 'lodgify_get_booking_payment_link':
            result = await mockClient.getBookingPaymentLink(args.id)
            break
          case 'lodgify_create_booking_payment_link':
            result = await mockClient.createBookingPaymentLink(args.id, args.payload)
            break
          case 'lodgify_update_key_codes':
            result = await mockClient.updateKeyCodes(args.id, args.payload)
            break
          case 'lodgify_checkin_booking':
            result = await mockClient.checkinBooking(String(args.id))
            break
          case 'lodgify_checkout_booking':
            result = await mockClient.checkoutBooking(String(args.id))
            break
          case 'lodgify_get_external_bookings':
            result = await mockClient.getExternalBookings(args.id)
            break

          // Rates Management Tools
          case 'lodgify_daily_rates':
            result = await mockClient.getDailyRates(args.params)
            break
          case 'lodgify_rate_settings':
            result = await mockClient.getRateSettings(args.params)
            break

          // Availability Tools
          case 'lodgify_list_vacant_inventory': {
            // Pass through to a mock aggregator if provided
            const mockWithVacant = mockClient as unknown as {
              findVacantInventory?: (args: unknown) => Promise<unknown>
              listProperties?: (args: {
                limit: number
              }) => Promise<{ items?: unknown[]; data?: unknown[] }>
            }
            if (typeof mockWithVacant.findVacantInventory === 'function') {
              result = await mockWithVacant.findVacantInventory(args)
            } else {
              // Fallback: compose from listProperties if available
              const propertiesData = await mockWithVacant.listProperties?.({
                limit: args.limit || 10,
              })
              const items = propertiesData?.items || propertiesData?.data || []
              result = {
                from: args.from,
                to: args.to,
                counts: {
                  propertiesChecked: items.length || 0,
                  availableProperties: items.length || 0,
                },
                properties: (items || []).map((p: { id: unknown; name?: string }) => ({
                  id: String(p.id),
                  name: p.name || `Property ${p.id}`,
                  available: true,
                })),
              }
            }
            break
          }

          // Quote and Messaging Tools
          case 'lodgify_get_quote':
            result = await mockClient.getQuote(args.propertyId, args.params)
            break
          case 'lodgify_get_thread':
            result = await mockClient.getThread(args.threadGuid)
            break

          // v1 Webhook Management Tools
          case 'lodgify_list_webhooks':
            result = await mockClient.listWebhooks(args.params)
            break
          case 'lodgify_subscribe_webhook':
            result = await mockClient.subscribeWebhook(args.payload || args)
            break
          case 'lodgify_unsubscribe_webhook':
            result = await mockClient.unsubscribeWebhook({ id: args.id })
            break

          // v1 Booking CRUD Tools
          case 'lodgify_create_booking':
            result = await mockClient.createBooking(args.payload || args)
            break
          case 'lodgify_update_booking': {
            const { id, ...updateData } = args
            result = await mockClient.updateBooking(String(id), args.payload || updateData)
            break
          }
          case 'lodgify_delete_booking':
            result = await mockClient.deleteBooking(String(args.id))
            break

          // v1 Rate Management Tools
          case 'lodgify_update_rates':
            result = await mockClient.updateRates(args.payload || args)
            break

          default:
            throw new Error(`Unknown tool: ${name}`)
        }

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(result, null, 2),
            },
          ],
        }
      } catch (error) {
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(
                {
                  error: true,
                  message: (error as Error).message,
                },
                null,
                2,
              ),
            },
          ],
          isError: true,
        }
      }
    },

    // List resources handler
    async listResources() {
      return { resources }
    },

    // Read resource handler
    async readResource(uri: string) {
      if (uri === 'lodgify://health') {
        const health = {
          ok: true,
          timestamp: new Date().toISOString(),
          version: pkg.version,
          baseUrl: 'https://api.lodgify.com',
          apiKeyConfigured: true,
        }

        return {
          contents: [
            {
              uri: 'lodgify://health',
              mimeType: 'application/json',
              text: JSON.stringify(health, null, 2),
            },
          ],
        }
      }

      throw new Error(`Unknown resource: ${uri}`)
    },
  }
}
