import { describe, expect, it, vi } from 'vitest'
import { LodgifyOrchestrator } from '../src/lodgify-orchestrator.js'

describe('findVacantInventory', () => {
  it('should correctly identify unavailable properties when API returns available: 0', async () => {
    // Mock the availability client
    const mockAvailabilityClient = {
      getAvailabilityForProperty: vi.fn(),
      getAvailabilityForRoom: vi.fn(),
    }

    // Mock the properties client
    const mockPropertiesClient = {
      listProperties: vi.fn().mockResolvedValue({
        data: [
          {
            id: 435705,
            name: "MeMe's Place Villa #1",
            room_types: [{ id: 501845, name: 'Villa #1' }],
          },
          { id: 435706, name: "MeMe's Place Villas", room_types: [{ id: 501846, name: 'Villas' }] },
        ],
      }),
      getProperty: vi.fn().mockImplementation((id) => {
        const properties: Record<string, any> = {
          '435705': {
            id: 435705,
            name: "MeMe's Place Villa #1",
            room_types: [{ id: 501845, name: 'Villa #1' }],
          },
          '435706': {
            id: 435706,
            name: "MeMe's Place Villas",
            room_types: [{ id: 501846, name: 'Villas' }],
          },
        }
        return Promise.resolve(properties[id])
      }),
    }

    // Create orchestrator instance with mocked clients
    const orchestrator = new LodgifyOrchestrator({
      apiKey: 'test-key',
      readOnly: false,
    })

    // Replace clients with mocks
    ;(orchestrator as any).availability = mockAvailabilityClient
    ;(orchestrator as any).properties = mockPropertiesClient

    // Mock API responses - API returns an array with periods containing available: 0
    mockAvailabilityClient.getAvailabilityForProperty.mockImplementation((propertyId) => {
      // Simulate the actual API response structure (array with periods)
      return Promise.resolve([
        {
          user_id: 527350,
          property_id: parseInt(propertyId),
          room_type_id: 501845,
          periods: [
            {
              start: '2025-09-25',
              end: '2025-09-26',
              available: 0, // Property is unavailable
              closed_period: null,
              bookings: [{ id: 13610595, status: 'Booked' }],
              channel_calendars: [],
            },
          ],
        },
      ])
    })

    // Test the function
    const result = await orchestrator.findVacantInventory({
      from: '2025-09-25',
      to: '2025-09-26',
      propertyIds: ['435705', '435706'],
      includeRooms: false,
    })

    // Assertions
    expect(result.counts.propertiesChecked).toBe(2)
    expect(result.counts.availableProperties).toBe(0) // All should be unavailable

    // Both properties should be marked as unavailable
    expect(result.properties[0].available).toBe(false)
    expect(result.properties[1].available).toBe(false)

    // Verify the availability API was called for each property
    expect(mockAvailabilityClient.getAvailabilityForProperty).toHaveBeenCalledTimes(2)
  })

  it('should correctly handle API response as array instead of object', async () => {
    const mockAvailabilityClient = {
      getAvailabilityForProperty: vi.fn(),
      getAvailabilityForRoom: vi.fn(),
    }

    const mockPropertiesClient = {
      listProperties: vi.fn().mockResolvedValue({
        data: [
          { id: 684871, name: "MeMe's Place Estate", room_types: [{ id: 751918, name: 'Estate' }] },
        ],
      }),
      getProperty: vi.fn().mockResolvedValue({
        id: 684871,
        name: "MeMe's Place Estate",
        room_types: [{ id: 751918, name: 'Estate' }],
      }),
    }

    const orchestrator = new LodgifyOrchestrator({
      apiKey: 'test-key',
      readOnly: false,
    })

    ;(orchestrator as any).availability = mockAvailabilityClient
    ;(orchestrator as any).properties = mockPropertiesClient

    // Test that we handle both array and object responses correctly
    mockAvailabilityClient.getAvailabilityForProperty.mockResolvedValueOnce([
      {
        periods: [
          {
            start: '2025-09-25',
            end: '2025-09-26',
            available: 1, // Available
          },
        ],
      },
    ])

    const result = await orchestrator.findVacantInventory({
      from: '2025-09-25',
      to: '2025-09-26',
      propertyIds: ['684871'],
      includeRooms: false,
    })

    expect(result.counts.availableProperties).toBe(1)
    expect(result.properties[0].available).toBe(true)
  })

  it('should not check room availability when property is unavailable', async () => {
    const mockAvailabilityClient = {
      getAvailabilityForProperty: vi.fn(),
      getAvailabilityForRoom: vi.fn(),
    }

    const mockPropertiesClient = {
      listProperties: vi.fn().mockResolvedValue({
        data: [
          {
            id: 435705,
            name: "MeMe's Place Villa #1",
            room_types: [{ id: 501845, name: 'Room 1' }],
          },
        ],
      }),
      getProperty: vi.fn().mockResolvedValue({
        id: 435705,
        name: "MeMe's Place Villa #1",
        room_types: [{ id: 501845, name: 'Room 1' }],
      }),
      listPropertyRooms: vi.fn().mockResolvedValue([{ id: 501845, name: 'Room 1' }]),
    }

    const orchestrator = new LodgifyOrchestrator({
      apiKey: 'test-key',
      readOnly: false,
    })

    ;(orchestrator as any).availability = mockAvailabilityClient
    ;(orchestrator as any).properties = mockPropertiesClient

    // Property is unavailable
    mockAvailabilityClient.getAvailabilityForProperty.mockResolvedValueOnce([
      {
        periods: [
          {
            start: '2025-09-25',
            end: '2025-09-26',
            available: 0, // Unavailable
            bookings: [{ id: 123, status: 'Booked' }],
          },
        ],
      },
    ])

    const result = await orchestrator.findVacantInventory({
      from: '2025-09-25',
      to: '2025-09-26',
      propertyIds: ['435705'],
      includeRooms: true, // Request room details
    })

    // Should NOT call room availability API when property is unavailable
    expect(mockAvailabilityClient.getAvailabilityForRoom).not.toHaveBeenCalled()

    // Property and rooms should be marked as unavailable
    expect(result.properties[0].available).toBe(false)
    expect(result.properties[0].rooms).toBeDefined()
    expect(result.properties[0].rooms![0].available).toBe(false)
  })
})
