import { afterEach, beforeEach, describe, expect, it, mock } from 'bun:test'
import {
  getPropertyTools,
  normalizeIncludePropertyIds,
  normalizeLimit,
} from '../src/mcp/tools/property-tools.js'

describe('Property tools additional coverage', () => {
  let mockClient: {
    properties: {
      listProperties: ReturnType<typeof mock>
      getProperty: ReturnType<typeof mock>
      listPropertyRooms: ReturnType<typeof mock>
      listDeletedProperties: ReturnType<typeof mock>
    }
    bookings: {
      listBookings: ReturnType<typeof mock>
    }
  }

  beforeEach(() => {
    mockClient = {
      properties: {
        listProperties: mock(),
        getProperty: mock(),
        listPropertyRooms: mock(),
        listDeletedProperties: mock(),
      },
      bookings: {
        listBookings: mock(),
      },
    }
  })

  afterEach(() => {
    mock.restore()
  })

  it('normalizes property discovery inputs consistently', () => {
    expect(normalizeIncludePropertyIds()).toBe(true)
    expect(normalizeIncludePropertyIds(false)).toBe(false)
    expect(normalizeIncludePropertyIds('false')).toBe(false)
    expect(normalizeIncludePropertyIds('0')).toBe(false)
    expect(normalizeIncludePropertyIds(['123'])).toBe(true)

    expect(normalizeLimit()).toBe(10)
    expect(normalizeLimit('3')).toBe(3)
    expect(normalizeLimit('bad')).toBe(10)
    expect(normalizeLimit(500)).toBe(50)
    expect(normalizeLimit(0)).toBe(1)
  })

  it('lists room types and coerces numeric property ids to strings', async () => {
    const tool = getPropertyTools(() => mockClient as never).find(
      (entry) => entry.name === 'lodgify_list_property_rooms',
    )
    if (!tool) throw new Error('Tool not found')

    mockClient.properties.listPropertyRooms.mockResolvedValue([
      { id: 1, name: 'Master Suite', maxOccupancy: 2 },
      { id: 2, name: 'Guest Loft', maxOccupancy: 4 },
    ])

    const result = await tool.handler({ propertyId: 42 as unknown as string })
    const response = JSON.parse(result.content[0].text)

    expect(mockClient.properties.listPropertyRooms).toHaveBeenCalledWith('42')
    expect(response.operation.type).toBe('list')
    expect(response.summary).toBeTruthy()
    expect(response.suggestions.length).toBeGreaterThan(0)
  })

  it('finds properties from wrapped property list responses and skips booking lookup when disabled', async () => {
    const tool = getPropertyTools(() => mockClient as never).find(
      (entry) => entry.name === 'lodgify_find_properties',
    )
    if (!tool) throw new Error('Tool not found')

    mockClient.properties.listProperties.mockResolvedValue({
      data: [
        {
          items: [
            { id: 101, name: 'Ocean View Villa' },
            { id: 102, title: 'City Loft' },
          ],
        },
      ],
    })

    const result = await tool.handler({
      searchTerm: 'ocean',
      includePropertyIds: 'false' as unknown as boolean,
      limit: '1' as unknown as number,
    })
    const response = JSON.parse(result.content[0].text)

    expect(mockClient.properties.listProperties).toHaveBeenCalled()
    expect(mockClient.bookings.listBookings).not.toHaveBeenCalled()
    expect(response.data.properties).toHaveLength(1)
    expect(response.data.properties[0]).toMatchObject({
      id: '101',
      name: 'Ocean View Villa',
      source: 'properties',
    })
    expect(response.data.message).toContain('matching "ocean"')
  })

  it('returns helpful suggestions when property discovery cannot find any matches', async () => {
    const tool = getPropertyTools(() => mockClient as never).find(
      (entry) => entry.name === 'lodgify_find_properties',
    )
    if (!tool) throw new Error('Tool not found')

    mockClient.properties.listProperties.mockRejectedValue(new Error('properties unavailable'))
    mockClient.bookings.listBookings.mockRejectedValue(new Error('bookings unavailable'))

    const result = await tool.handler({ searchTerm: 'desert' })
    const response = JSON.parse(result.content[0].text)

    expect(response.data.properties).toHaveLength(0)
    expect(response.data.message).toContain('No properties found')
    expect(
      response.data.suggestions.some((item: string) => item.includes('Property list API')),
    ).toBe(true)
    expect(
      response.data.suggestions.some((item: string) =>
        item.includes('Could not retrieve property IDs from bookings'),
      ),
    ).toBe(true)
  })

  it('validates deletedSince dates for deleted properties lookups', async () => {
    const tool = getPropertyTools(() => mockClient as never).find(
      (entry) => entry.name === 'lodgify_list_deleted_properties',
    )
    if (!tool) throw new Error('Tool not found')

    await expect(
      tool.handler({
        params: {
          deletedSince: '2024/01/01',
        },
      }),
    ).rejects.toThrow('Invalid date format for deletedSince')
  })

  it('returns deleted properties with recovery guidance when matches exist', async () => {
    const tool = getPropertyTools(() => mockClient as never).find(
      (entry) => entry.name === 'lodgify_list_deleted_properties',
    )
    if (!tool) throw new Error('Tool not found')

    mockClient.properties.listDeletedProperties.mockResolvedValue({
      data: [
        {
          id: 901,
          name: 'Archived Cabin',
          deletedAt: '2024-01-02T10:00:00Z',
        },
      ],
    })

    const result = await tool.handler({
      params: {
        deletedSince: '2024-01-01T00:00:00Z',
      },
    })
    const response = JSON.parse(result.content[0].text)

    expect(mockClient.properties.listDeletedProperties).toHaveBeenCalledWith({
      deletedSince: '2024-01-01T00:00:00Z',
    })
    expect(response.operation.type).toBe('list_deleted')
    expect(response.data.data[0].name).toBe('Archived Cabin')
    expect(response.suggestions.length).toBeGreaterThan(0)
  })

  it('uses the fallback deleted property summary when no deleted properties are returned', async () => {
    const tool = getPropertyTools(() => mockClient as never).find(
      (entry) => entry.name === 'lodgify_list_deleted_properties',
    )
    if (!tool) throw new Error('Tool not found')

    mockClient.properties.listDeletedProperties.mockResolvedValue({ data: [] })

    const result = await tool.handler({})
    const response = JSON.parse(result.content[0].text)

    expect(response.data.data).toHaveLength(0)
    expect(response.summary).toContain('deleted')
  })
})
