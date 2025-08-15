/**
 * Create a test server with a mock client
 * This is a simplified version of the main server for testing
 */
export function createTestServer(mockClient: any) {
  const tools = [
    {
      name: 'lodgify.list_properties',
      description:
        'List all properties with optional filtering and pagination (GET /v2/properties)',
      inputSchema: {
        type: 'object',
        properties: {
          params: {
            type: 'object',
            description: 'Optional query parameters for filtering',
          },
        },
      },
    },
    {
      name: 'lodgify.get_property',
      description: 'Get a single property by ID (GET /v2/properties/{id})',
      inputSchema: {
        type: 'object',
        properties: {
          id: {
            type: 'string',
            description: 'Property ID',
          },
        },
        required: ['id'],
      },
    },
    {
      name: 'lodgify.list_property_rooms',
      description: 'List all rooms for a specific property (GET /v2/properties/{propertyId}/rooms)',
      inputSchema: {
        type: 'object',
        properties: {
          propertyId: {
            type: 'string',
            description: 'Property ID',
          },
        },
        required: ['propertyId'],
      },
    },
    {
      name: 'lodgify.find_properties',
      description: "Find properties in the system when you don't know the exact property ID",
      inputSchema: {
        type: 'object',
        properties: {
          searchTerm: {
            type: 'string',
            description: 'Optional search term to filter properties by name',
          },
          includePropertyIds: {
            type: 'boolean',
            description: 'Include property IDs found in recent bookings',
          },
          limit: {
            type: 'number',
            description: 'Maximum number of properties to return',
          },
        },
      },
    },
    {
      name: 'lodgify.list_deleted_properties',
      description: 'List deleted properties (GET /v2/deletedProperties)',
      inputSchema: {
        type: 'object',
        properties: {
          params: {
            type: 'object',
            description: 'Optional query parameters for filtering',
          },
        },
      },
    },
    {
      name: 'lodgify.daily_rates',
      description: 'Get daily rates calendar (GET /v2/rates/calendar)',
      inputSchema: {
        type: 'object',
        properties: {
          params: {
            type: 'object',
            description: 'Query parameters including propertyId, from, to dates',
          },
        },
        required: ['params'],
      },
    },
    {
      name: 'lodgify.rate_settings',
      description: 'Get rate settings (GET /v2/rates/settings)',
      inputSchema: {
        type: 'object',
        properties: {
          params: {
            type: 'object',
            description: 'Query parameters for rate settings',
          },
        },
        required: ['params'],
      },
    },
    {
      name: 'lodgify.list_bookings',
      description: 'List bookings with optional filtering (GET /v2/reservations/bookings)',
      inputSchema: {
        type: 'object',
        properties: {
          params: {
            type: 'object',
            description: 'Optional query parameters for filtering (date range, status, etc.)',
          },
        },
      },
    },
    {
      name: 'lodgify.get_booking',
      description: 'Get a single booking by ID (GET /v2/reservations/bookings/{id})',
      inputSchema: {
        type: 'object',
        properties: {
          id: {
            type: 'string',
            description: 'Booking ID',
          },
        },
        required: ['id'],
      },
    },
    {
      name: 'lodgify.get_booking_payment_link',
      description:
        'Get payment link for a booking (GET /v2/reservations/bookings/{id}/quote/paymentLink)',
      inputSchema: {
        type: 'object',
        properties: {
          id: {
            type: 'string',
            description: 'Booking ID',
          },
        },
        required: ['id'],
      },
    },
    {
      name: 'lodgify.create_booking_payment_link',
      description:
        'Create payment link for a booking (POST /v2/reservations/bookings/{id}/quote/paymentLink)',
      inputSchema: {
        type: 'object',
        properties: {
          id: {
            type: 'string',
            description: 'Booking ID',
          },
          payload: {
            type: 'object',
            description: 'Payment link configuration',
          },
        },
        required: ['id', 'payload'],
      },
    },
    {
      name: 'lodgify.update_key_codes',
      description: 'Update key codes for a booking (PUT /v2/reservations/bookings/{id}/keyCodes)',
      inputSchema: {
        type: 'object',
        properties: {
          id: {
            type: 'string',
            description: 'Booking ID',
          },
          payload: {
            type: 'object',
            description: 'Key codes data',
          },
        },
        required: ['id', 'payload'],
      },
    },
    {
      name: 'lodgify.availability_room',
      description:
        'Check availability for a specific room type (GET /v2/availability/{propertyId}/{roomTypeId})',
      inputSchema: {
        type: 'object',
        properties: {
          propertyId: {
            type: 'string',
            description: 'Property ID',
          },
          roomTypeId: {
            type: 'string',
            description: 'Room Type ID',
          },
          params: {
            type: 'object',
            description: 'Optional query parameters',
          },
        },
        required: ['propertyId', 'roomTypeId'],
      },
    },
    {
      name: 'lodgify.availability_property',
      description: 'Check availability for an entire property (GET /v2/availability/{propertyId})',
      inputSchema: {
        type: 'object',
        properties: {
          propertyId: {
            type: 'string',
            description: 'Property ID',
          },
          params: {
            type: 'object',
            description: 'Optional query parameters',
          },
        },
        required: ['propertyId'],
      },
    },
    {
      name: 'lodgify.get_quote',
      description: 'Get a quote for a property stay (GET /v2/quote/{propertyId})',
      inputSchema: {
        type: 'object',
        properties: {
          propertyId: {
            type: 'string',
            description: 'Property ID',
          },
          params: {
            type: 'object',
            description: 'Quote parameters',
          },
        },
        required: ['propertyId', 'params'],
      },
    },
    {
      name: 'lodgify.get_thread',
      description: 'Get a messaging thread (GET /v2/messaging/{threadGuid})',
      inputSchema: {
        type: 'object',
        properties: {
          threadGuid: {
            type: 'string',
            description: 'Thread GUID',
          },
        },
        required: ['threadGuid'],
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
    async callTool(name: string, args: any) {
      try {
        let result: unknown

        switch (name) {
          case 'lodgify.list_properties':
            result = await mockClient.listProperties(args.params)
            break

          case 'lodgify.get_property':
            result = await mockClient.getProperty(args.id)
            break

          case 'lodgify.list_property_rooms':
            result = await mockClient.listPropertyRooms(args.propertyId)
            break

          case 'lodgify.list_deleted_properties':
            result = await mockClient.listDeletedProperties(args.params)
            break

          case 'lodgify.daily_rates':
            result = await mockClient.getDailyRates(args.params)
            break

          case 'lodgify.rate_settings':
            result = await mockClient.getRateSettings(args.params)
            break

          case 'lodgify.list_bookings':
            result = await mockClient.listBookings(args.params)
            break

          case 'lodgify.get_booking':
            result = await mockClient.getBooking(args.id)
            break

          case 'lodgify.get_booking_payment_link':
            result = await mockClient.getBookingPaymentLink(args.id)
            break

          case 'lodgify.create_booking_payment_link':
            result = await mockClient.createBookingPaymentLink(args.id, args.payload)
            break

          case 'lodgify.update_key_codes':
            result = await mockClient.updateKeyCodes(args.id, args.payload)
            break

          case 'lodgify.availability_room':
            result = await mockClient.getAvailabilityRoom(
              args.propertyId,
              args.roomTypeId,
              args.params,
            )
            break

          case 'lodgify.availability_property':
            result = await mockClient.getAvailabilityProperty(args.propertyId, args.params)
            break

          case 'lodgify.get_quote':
            result = await mockClient.getQuote(args.propertyId, args.params)
            break

          case 'lodgify.get_thread':
            result = await mockClient.getThread(args.threadGuid)
            break

          case 'lodgify.find_properties': {
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
          version: '0.1.0',
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
