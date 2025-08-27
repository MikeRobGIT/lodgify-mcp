import { afterEach, beforeEach, describe, expect, mock, test } from 'bun:test'
import { BaseApiClient, isListResponse, isSingleResponse } from '../../src/api/base-client.js'

// Test implementation of BaseApiClient
class TestApiClient extends BaseApiClient {
  // Expose protected methods for testing
  public testBuildPath(path: string, version?: 'v1' | 'v2'): string {
    return this.buildPath(path, version)
  }

  public testList<T>(endpoint: string, params?: Record<string, unknown>, version?: 'v1' | 'v2') {
    return this.list<T>(endpoint, params, version)
  }

  public testGetById<T>(endpoint: string, id: string, version?: 'v1' | 'v2') {
    return this.getById<T>(endpoint, id, version)
  }

  public testCreate<T, Input>(endpoint: string, data: Input, version?: 'v1' | 'v2') {
    return this.create<T, Input>(endpoint, data, version)
  }

  public testUpdate<T, Input>(endpoint: string, id: string, data: Input, version?: 'v1' | 'v2') {
    return this.update<T, Input>(endpoint, id, data, version)
  }

  public testDeleteById<T = void>(endpoint: string, id: string, version?: 'v1' | 'v2') {
    return this.deleteById<T>(endpoint, id, version)
  }

  public testBuildQuery(params: Record<string, unknown>): string {
    return this.buildQuery(params)
  }
}

describe('BaseApiClient', () => {
  let client: TestApiClient
  let originalFetch: typeof global.fetch

  beforeEach(() => {
    originalFetch = global.fetch
    client = new TestApiClient('test-api-key')
  })

  afterEach(() => {
    global.fetch = originalFetch
  })

  describe('constructor', () => {
    test('should throw error if API key is not provided', () => {
      expect(() => new TestApiClient('')).toThrow('API key is required')
    })

    test('should initialize with default v2 version', () => {
      const client = new TestApiClient('test-key')
      expect(client.testBuildPath('properties')).toBe('/v2/properties')
    })

    test('should allow v1 as default version', () => {
      const client = new TestApiClient('test-key', 'v1')
      expect(client.testBuildPath('properties')).toBe('/v1/properties')
    })

    test('should accept custom base URL', () => {
      const mockFetch = mock(() =>
        Promise.resolve(
          new Response(JSON.stringify({ data: 'test' }), {
            status: 200,
            headers: new Headers({ 'content-type': 'application/json' }),
          }),
        ),
      )
      global.fetch = mockFetch

      const client = new TestApiClient('test-key', 'v2', 'https://custom.api.com')
      client.request('GET', 'test')

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('https://custom.api.com'),
        expect.anything(),
      )
    })
  })

  describe('buildPath', () => {
    test('should build v2 path by default', () => {
      expect(client.testBuildPath('properties')).toBe('/v2/properties')
    })

    test('should build v1 path when specified', () => {
      expect(client.testBuildPath('properties', 'v1')).toBe('/v1/properties')
    })

    test('should handle paths with leading slash', () => {
      expect(client.testBuildPath('/properties')).toBe('/v2/properties')
    })

    test('should remove existing version prefix', () => {
      expect(client.testBuildPath('v1/properties')).toBe('/v2/properties')
      expect(client.testBuildPath('/v2/properties')).toBe('/v2/properties')
    })
  })

  describe('request with rate limiting', () => {
    test('should check rate limit before request', async () => {
      const mockFetch = mock(() =>
        Promise.resolve(
          new Response(JSON.stringify({ data: 'test' }), {
            status: 200,
            headers: new Headers({ 'content-type': 'application/json' }),
          }),
        ),
      )
      global.fetch = mockFetch

      await client.request('GET', 'properties')

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/v2/properties'),
        expect.anything(),
      )
    })

    test('should skip rate limiting when specified', async () => {
      const mockFetch = mock(() =>
        Promise.resolve(
          new Response(JSON.stringify({ data: 'test' }), {
            status: 200,
            headers: new Headers({ 'content-type': 'application/json' }),
          }),
        ),
      )
      global.fetch = mockFetch

      await client.request('GET', 'properties', { skipRateLimit: true })

      expect(mockFetch).toHaveBeenCalled()
    })

    test('should skip retry when specified', async () => {
      let callCount = 0
      const mockFetch = mock(() => {
        callCount++
        return Promise.resolve(
          new Response(JSON.stringify({ error: 'Server error' }), {
            status: 500,
            statusText: 'Internal Server Error',
            headers: new Headers({ 'content-type': 'application/json' }),
          }),
        )
      })
      global.fetch = mockFetch

      await expect(client.request('GET', 'properties', { skipRetry: true })).rejects.toMatchObject({
        status: 500,
      })

      expect(callCount).toBe(1) // No retries
    })
  })

  describe('common operation patterns', () => {
    describe('list', () => {
      test('should handle array response', async () => {
        const mockData = [{ id: 1 }, { id: 2 }]
        global.fetch = mock(() =>
          Promise.resolve(
            new Response(JSON.stringify(mockData), {
              status: 200,
              headers: new Headers({ 'content-type': 'application/json' }),
            }),
          ),
        )

        const result = await client.testList<{ id: number }>('properties')

        expect(result).toEqual({
          data: mockData,
          count: 2,
        })
      })

      test('should handle object with data property', async () => {
        const mockResponse = { data: [{ id: 1 }], count: 1 }
        global.fetch = mock(() =>
          Promise.resolve(
            new Response(JSON.stringify(mockResponse), {
              status: 200,
              headers: new Headers({ 'content-type': 'application/json' }),
            }),
          ),
        )

        const result = await client.testList<{ id: number }>('properties')

        expect(result).toEqual(mockResponse)
      })

      test('should handle object with items property', async () => {
        const mockResponse = {
          items: [{ id: 1 }],
          count: 1,
          pagination: { limit: 10, offset: 0, total: 1 },
        }
        global.fetch = mock(() =>
          Promise.resolve(
            new Response(JSON.stringify(mockResponse), {
              status: 200,
              headers: new Headers({ 'content-type': 'application/json' }),
            }),
          ),
        )

        const result = await client.testList<{ id: number }>('properties')

        expect(result).toEqual({
          data: mockResponse.items,
          count: 1,
          pagination: mockResponse.pagination,
        })
      })

      test('should wrap single object in array', async () => {
        const mockData = { id: 1, name: 'Test' }
        global.fetch = mock(() =>
          Promise.resolve(
            new Response(JSON.stringify(mockData), {
              status: 200,
              headers: new Headers({ 'content-type': 'application/json' }),
            }),
          ),
        )

        const result = await client.testList<{ id: number; name: string }>('properties')

        expect(result).toEqual({
          data: [mockData],
          count: 1,
        })
      })
    })

    describe('getById', () => {
      test('should get resource by ID', async () => {
        const mockData = { id: '123', name: 'Test' }
        global.fetch = mock(() =>
          Promise.resolve(
            new Response(JSON.stringify(mockData), {
              status: 200,
              headers: new Headers({ 'content-type': 'application/json' }),
            }),
          ),
        )

        const result = await client.testGetById('properties', '123')

        expect(result).toEqual(mockData)
      })

      test('should encode ID for URL safety', async () => {
        const mockFetch = mock(() =>
          Promise.resolve(
            new Response(JSON.stringify({ id: 'test/slash' }), {
              status: 200,
              headers: new Headers({ 'content-type': 'application/json' }),
            }),
          ),
        )
        global.fetch = mockFetch

        await client.testGetById('properties', 'test/slash')

        expect(mockFetch).toHaveBeenCalledWith(
          expect.stringContaining('test%2Fslash'),
          expect.anything(),
        )
      })

      test('should throw error if ID is missing', async () => {
        await expect(client.testGetById('properties', '')).rejects.toThrow('ID is required')
      })
    })

    describe('create', () => {
      test('should create resource', async () => {
        const input = { name: 'New Property' }
        const mockResponse = { id: '123', ...input }

        global.fetch = mock(() =>
          Promise.resolve(
            new Response(JSON.stringify(mockResponse), {
              status: 201,
              headers: new Headers({ 'content-type': 'application/json' }),
            }),
          ),
        )

        const result = await client.testCreate('properties', input)

        expect(result).toEqual(mockResponse)
      })

      test('should throw error if data is missing', async () => {
        await expect(client.testCreate('properties', null as unknown)).rejects.toThrow(
          'Request body is required',
        )
      })
    })

    describe('update', () => {
      test('should update resource', async () => {
        const input = { name: 'Updated Property' }
        const mockResponse = { id: '123', ...input }

        global.fetch = mock(() =>
          Promise.resolve(
            new Response(JSON.stringify(mockResponse), {
              status: 200,
              headers: new Headers({ 'content-type': 'application/json' }),
            }),
          ),
        )

        const result = await client.testUpdate('properties', '123', input)

        expect(result).toEqual(mockResponse)
      })

      test('should throw error if ID is missing', async () => {
        await expect(client.testUpdate('properties', '', { name: 'Test' })).rejects.toThrow(
          'ID is required',
        )
      })

      test('should throw error if data is missing', async () => {
        await expect(client.testUpdate('properties', '123', null as unknown)).rejects.toThrow(
          'Request body is required',
        )
      })
    })

    describe('deleteById', () => {
      test('should delete resource', async () => {
        global.fetch = mock(() =>
          Promise.resolve(
            new Response(null, {
              status: 204,
              headers: new Headers(),
            }),
          ),
        )

        await client.testDeleteById('properties', '123')

        expect(global.fetch).toHaveBeenCalledWith(
          expect.stringContaining('properties/123'),
          expect.objectContaining({ method: 'DELETE' }),
        )
      })

      test('should throw error if ID is missing', async () => {
        await expect(client.testDeleteById('properties', '')).rejects.toThrow('ID is required')
      })
    })
  })

  describe('buildQuery', () => {
    test('should build query string from parameters', () => {
      const params = {
        limit: 10,
        offset: 0,
        status: 'active',
      }

      const query = client.testBuildQuery(params)

      expect(query).toBe('limit=10&offset=0&status=active')
    })

    test('should flatten nested parameters', () => {
      const params = {
        'filter[status]': 'active',
        'sort[field]': 'name',
      }

      const query = client.testBuildQuery(params)

      expect(query).toContain('filter%5Bstatus%5D=active')
      expect(query).toContain('sort%5Bfield%5D=name')
    })
  })

  describe('type guards', () => {
    test('isListResponse should identify list responses', () => {
      expect(isListResponse({ data: [] })).toBe(true)
      expect(isListResponse({ data: [1, 2, 3] })).toBe(true)
      expect(isListResponse({ data: 'not array' })).toBe(false)
      expect(isListResponse({ notData: [] })).toBe(false)
      expect(isListResponse(null)).toBe(false)
    })

    test('isSingleResponse should identify single responses', () => {
      expect(isSingleResponse({ data: { id: 1 } })).toBe(true)
      expect(isSingleResponse({ data: 'string' })).toBe(true)
      expect(isSingleResponse({ data: [] })).toBe(false)
      expect(isSingleResponse({ notData: {} })).toBe(false)
      expect(isSingleResponse(null)).toBe(false)
    })
  })
})
