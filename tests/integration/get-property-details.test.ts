/**
 * Integration tests for lodgify_get_property MCP tool
 * This tool is critical for property managers to retrieve comprehensive property details
 * including configuration, amenities, room types, and booking settings.
 */

import { afterEach, beforeEach, describe, expect, it, mock } from 'bun:test'
import { getPropertyTools } from '../../src/mcp/tools/property-tools.js'
import type { EnhancedResponse } from '../../src/mcp/utils/response/types.js'

describe('lodgify_get_property - Critical Property Details Retrieval', () => {
  let mockClient: Record<string, unknown>
  let tools: ReturnType<typeof getPropertyTools>
  let getPropertyTool: ReturnType<typeof getPropertyTools>[0]

  beforeEach(() => {
    // Create mock client with properties module
    mockClient = {
      properties: {
        getProperty: mock(),
        listProperties: mock(),
        listPropertyRooms: mock(),
        listDeletedProperties: mock(),
      },
      isReadOnly: () => false,
    }

    // Get tools with mock client
    tools = getPropertyTools(() => mockClient)
    const tool = tools.find((t) => t.name === 'lodgify_get_property')
    if (!tool) throw new Error('Tool not found')
    getPropertyTool = tool
  })

  afterEach(() => {
    // Clean up mocks
    mock.restore()
  })

  it('should successfully retrieve comprehensive property details', async () => {
    // Mock successful API response with full property details
    mockClient.properties.getProperty.mockResolvedValue({
      id: 684855,
      name: 'Ocean View Villa',
      description: 'Luxury beachfront villa with stunning ocean views',
      location: {
        address: '123 Ocean Drive',
        city: 'Miami Beach',
        state: 'FL',
        country: 'USA',
        zipCode: '33139',
        latitude: 25.7617,
        longitude: -80.1918,
      },
      amenities: ['WiFi', 'Pool', 'Beach Access', 'Parking', 'Air Conditioning'],
      roomTypes: [
        {
          id: 751902,
          name: 'Master Suite',
          maxOccupancy: 2,
          beds: 1,
          bathrooms: 1,
        },
        {
          id: 751903,
          name: 'Guest Room',
          maxOccupancy: 2,
          beds: 2,
          bathrooms: 1,
        },
      ],
      currency: 'USD',
      checkInTime: '15:00',
      checkOutTime: '11:00',
      minStay: 3,
      maxOccupancy: 6,
      status: 'active',
      images: [
        { url: 'https://example.com/image1.jpg', caption: 'Ocean view' },
        { url: 'https://example.com/image2.jpg', caption: 'Pool area' },
      ],
    })

    const result = await getPropertyTool.handler({
      id: 684855,
    })

    const response: EnhancedResponse = JSON.parse(result.content[0].text)

    // Verify the tool was called correctly
    expect(mockClient.properties.getProperty).toHaveBeenCalledWith('684855', undefined)

    // Check response structure
    expect(response.operation).toMatchObject({
      type: 'get',
      entity: 'property',
      status: 'success',
    })

    // Verify property details are included
    expect(response.data).toMatchObject({
      id: 684855,
      name: 'Ocean View Villa',
      description: 'Luxury beachfront villa with stunning ocean views',
      currency: 'USD',
      maxOccupancy: 6,
    })

    // Ensure critical room information is present
    expect(response.data.roomTypes).toHaveLength(2)
    expect(response.data.roomTypes[0]).toMatchObject({
      id: 751902,
      name: 'Master Suite',
      maxOccupancy: 2,
    })

    // Verify location details for mapping
    expect(response.data.location).toMatchObject({
      city: 'Miami Beach',
      state: 'FL',
      country: 'USA',
    })

    // Check amenities are included
    expect(response.data.amenities).toContain('WiFi')
    expect(response.data.amenities).toContain('Pool')

    // Summary should be present
    expect(response.summary).toBeTruthy()
  })

  it('should retrieve property with optional website ID filter', async () => {
    // Mock API response for property with website filter
    mockClient.properties.getProperty.mockResolvedValue({
      id: 123456,
      name: 'Mountain Retreat',
      website_id: 12345,
      currency: 'EUR',
      status: 'active',
    })

    const result = await getPropertyTool.handler({
      id: 123456,
      wid: 12345,
    })

    const response: EnhancedResponse = JSON.parse(result.content[0].text)

    // Verify the tool passed the website ID parameter
    expect(mockClient.properties.getProperty).toHaveBeenCalledWith('123456', { wid: 12345 })

    expect(response.operation.status).toBe('success')
    expect(response.data.name).toBe('Mountain Retreat')
    expect(response.data.currency).toBe('EUR')
  })

  it('should include arrival/departure availability when requested', async () => {
    // Mock response with availability dates
    mockClient.properties.getProperty.mockResolvedValue({
      id: 789012,
      name: 'City Center Apartment',
      availableForArrival: ['2024-03-15', '2024-03-16', '2024-03-17'],
      availableForDeparture: ['2024-03-18', '2024-03-19', '2024-03-20'],
      nextAvailable: '2024-03-15',
    })

    const result = await getPropertyTool.handler({
      id: 789012,
      includeInOut: true,
    })

    const response: EnhancedResponse = JSON.parse(result.content[0].text)

    // Verify includeInOut parameter was passed
    expect(mockClient.properties.getProperty).toHaveBeenCalledWith('789012', { includeInOut: true })

    // Check availability dates are included
    expect(response.data.availableForArrival).toContain('2024-03-15')
    expect(response.data.availableForDeparture).toContain('2024-03-18')
    expect(response.data.nextAvailable).toBe('2024-03-15')
  })

  it('should handle property not found (404) with helpful suggestions', async () => {
    // Mock 404 error
    const error = new Error('Property not found') as Error & { statusCode?: number }
    error.statusCode = 404
    error.message = 'Property with ID 999999 not found'
    mockClient.properties.getProperty.mockRejectedValue(error)

    await expect(getPropertyTool.handler({ id: 999999 })).rejects.toThrow()

    // Verify the tool attempted to get the property
    expect(mockClient.properties.getProperty).toHaveBeenCalledWith('999999', undefined)
  })

  it('should retrieve property with minimal response data', async () => {
    // Mock minimal valid response
    mockClient.properties.getProperty.mockResolvedValue({
      id: 111,
      name: 'Basic Property',
    })

    const result = await getPropertyTool.handler({
      id: 111,
    })

    const response: EnhancedResponse = JSON.parse(result.content[0].text)

    expect(response.operation.status).toBe('success')
    expect(response.data.id).toBe(111)
    expect(response.data.name).toBe('Basic Property')
  })

  it('should handle properties with complex room configurations', async () => {
    // Mock property with multiple room types and configurations
    mockClient.properties.getProperty.mockResolvedValue({
      id: 555,
      name: 'Large Family Villa',
      roomTypes: [
        {
          id: 101,
          name: 'Master Bedroom',
          maxOccupancy: 2,
          beds: 1,
          bedType: 'King',
        },
        {
          id: 102,
          name: 'Kids Room',
          maxOccupancy: 3,
          beds: 3,
          bedType: 'Single',
        },
        {
          id: 103,
          name: 'Guest Suite',
          maxOccupancy: 2,
          beds: 1,
          bedType: 'Queen',
          hasPrivateBathroom: true,
        },
      ],
      totalBedrooms: 3,
      totalBathrooms: 2.5,
      maxOccupancy: 7,
    })

    const result = await getPropertyTool.handler({
      id: 555,
    })

    const response: EnhancedResponse = JSON.parse(result.content[0].text)

    expect(response.data.roomTypes).toHaveLength(3)
    expect(response.data.totalBedrooms).toBe(3)
    expect(response.data.maxOccupancy).toBe(7)

    // Verify room details are preserved
    const kidsRoom = response.data.roomTypes.find((r: { name: string }) => r.name === 'Kids Room')
    expect(kidsRoom).toMatchObject({
      maxOccupancy: 3,
      beds: 3,
      bedType: 'Single',
    })
  })

  it('should handle network timeout gracefully', async () => {
    // Mock network timeout
    const timeoutError = new Error('Network timeout') as Error & { code?: string }
    timeoutError.code = 'ETIMEDOUT'
    mockClient.properties.getProperty.mockRejectedValue(timeoutError)

    await expect(getPropertyTool.handler({ id: 777 })).rejects.toThrow()

    expect(mockClient.properties.getProperty).toHaveBeenCalledWith('777', undefined)
  })

  it('should handle invalid property ID format', async () => {
    // Test with invalid ID (though TypeScript should catch this)
    const invalidError = new Error('Invalid property ID format') as Error & { statusCode?: number }
    invalidError.statusCode = 400
    mockClient.properties.getProperty.mockRejectedValue(invalidError)

    await expect(getPropertyTool.handler({ id: -1 })).rejects.toThrow()
  })

  it('should retrieve property with seasonal pricing information', async () => {
    // Mock property with pricing details
    mockClient.properties.getProperty.mockResolvedValue({
      id: 888,
      name: 'Seasonal Beach House',
      currency: 'USD',
      basePricePerNight: 200,
      pricing: {
        highSeason: {
          start: '06-01',
          end: '08-31',
          pricePerNight: 350,
        },
        lowSeason: {
          start: '11-01',
          end: '03-31',
          pricePerNight: 150,
        },
      },
      minStay: 3,
      weekendMinStay: 2,
    })

    const result = await getPropertyTool.handler({
      id: 888,
    })

    const response: EnhancedResponse = JSON.parse(result.content[0].text)

    expect(response.data.basePricePerNight).toBe(200)
    expect(response.data.pricing).toBeDefined()
    expect(response.data.pricing.highSeason.pricePerNight).toBe(350)
    expect(response.data.minStay).toBe(3)
  })

  it('should handle rate-limited API response', async () => {
    // Mock 429 rate limit error
    const rateLimitError = new Error('Rate limit exceeded') as Error & {
      statusCode?: number
      headers?: Record<string, string>
    }
    rateLimitError.statusCode = 429
    rateLimitError.headers = { 'Retry-After': '60' }
    mockClient.properties.getProperty.mockRejectedValue(rateLimitError)

    await expect(getPropertyTool.handler({ id: 333 })).rejects.toThrow()

    expect(mockClient.properties.getProperty).toHaveBeenCalledWith('333', undefined)
  })

  it('should retrieve property with booking rules and policies', async () => {
    // Mock property with detailed booking rules
    mockClient.properties.getProperty.mockResolvedValue({
      id: 444,
      name: 'Policy Test Villa',
      bookingRules: {
        checkInTime: '16:00',
        checkOutTime: '10:00',
        checkInDays: ['Saturday'],
        checkOutDays: ['Saturday'],
        minAdvanceBooking: 2,
        maxAdvanceBooking: 365,
        instantBooking: false,
        requiresApproval: true,
      },
      cancellationPolicy: {
        type: 'Moderate',
        fullRefundDays: 5,
        partialRefundDays: 2,
      },
      houseRules: ['No smoking', 'No pets', 'No parties', 'Quiet hours 10pm-8am'],
    })

    const result = await getPropertyTool.handler({
      id: 444,
    })

    const response: EnhancedResponse = JSON.parse(result.content[0].text)

    expect(response.data.bookingRules).toBeDefined()
    expect(response.data.bookingRules.checkInTime).toBe('16:00')
    expect(response.data.bookingRules.checkInDays).toContain('Saturday')
    expect(response.data.cancellationPolicy.type).toBe('Moderate')
    expect(response.data.houseRules).toContain('No smoking')
  })

  it('should handle properties with special characters in names', async () => {
    // Mock property with special characters
    mockClient.properties.getProperty.mockResolvedValue({
      id: 666,
      name: "L'Étoile d'Or - Beach Villa & Spa",
      description: 'Luxurious villa with spa, près de la plage',
      location: {
        city: "Côte d'Azur",
        country: 'France',
      },
    })

    const result = await getPropertyTool.handler({
      id: 666,
    })

    const response: EnhancedResponse = JSON.parse(result.content[0].text)

    expect(response.data.name).toBe("L'Étoile d'Or - Beach Villa & Spa")
    expect(response.data.location.city).toBe("Côte d'Azur")
  })

  it('should handle unauthorized access (401)', async () => {
    // Mock 401 unauthorized error
    const authError = new Error('Unauthorized') as Error & { statusCode?: number }
    authError.statusCode = 401
    authError.message = 'Invalid API key'
    mockClient.properties.getProperty.mockRejectedValue(authError)

    await expect(getPropertyTool.handler({ id: 222 })).rejects.toThrow()

    expect(mockClient.properties.getProperty).toHaveBeenCalledWith('222', undefined)
  })

  it('should warn about suspiciously low website ID', async () => {
    // Mock response for low wid warning test
    mockClient.properties.getProperty.mockResolvedValue({
      id: 999,
      name: 'Test Property',
    })

    const result = await getPropertyTool.handler({
      id: 999,
      wid: 5, // Suspiciously low wid
    })

    const response: EnhancedResponse = JSON.parse(result.content[0].text)

    // Should still work but potentially log warning
    expect(response.operation.status).toBe('success')
    expect(mockClient.properties.getProperty).toHaveBeenCalledWith('999', { wid: 5 })
  })

  it('should handle empty response data gracefully', async () => {
    // Mock empty but valid response
    mockClient.properties.getProperty.mockResolvedValue({})

    const result = await getPropertyTool.handler({
      id: 777,
    })

    const response: EnhancedResponse = JSON.parse(result.content[0].text)

    expect(response.operation.status).toBe('success')
    expect(response.data).toEqual({})
  })

  it('should retrieve property with all parameters combined', async () => {
    // Mock comprehensive response with all features
    mockClient.properties.getProperty.mockResolvedValue({
      id: 12345,
      name: 'Ultimate Test Villa',
      website_id: 54321,
      status: 'active',
      availableForArrival: ['2024-04-01', '2024-04-02'],
      availableForDeparture: ['2024-04-10', '2024-04-11'],
      roomTypes: [{ id: 1, name: 'Suite', maxOccupancy: 4 }],
      amenities: ['All Inclusive'],
      currency: 'EUR',
    })

    const result = await getPropertyTool.handler({
      id: 12345,
      wid: 54321,
      includeInOut: true,
    })

    const response: EnhancedResponse = JSON.parse(result.content[0].text)

    // Verify all parameters were passed
    expect(mockClient.properties.getProperty).toHaveBeenCalledWith('12345', {
      wid: 54321,
      includeInOut: true,
    })

    expect(response.operation.status).toBe('success')
    expect(response.data.name).toBe('Ultimate Test Villa')
    expect(response.data.availableForArrival).toBeDefined()
    expect(response.data.availableForDeparture).toBeDefined()
  })
})
