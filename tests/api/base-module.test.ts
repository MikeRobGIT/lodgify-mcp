import { beforeEach, describe, expect, mock, test } from 'bun:test'
import { BaseApiClient } from '../../src/api/base-client.js'
import { ApiModuleFactory, BaseApiModule } from '../../src/api/base-module.js'

// Test client implementation
class TestClient extends BaseApiClient {
  constructor() {
    super('test-key')
  }
}

// Test module implementation
class TestModule extends BaseApiModule {
  constructor(client: BaseApiClient) {
    super(client, {
      name: 'test',
      version: 'v2',
      basePath: 'test-resources',
    })
  }

  // Expose protected methods for testing
  public testBuildEndpoint(path: string): string {
    return this.buildEndpoint(path)
  }

  public testRequest<T>(method: string, path: string, options?: Record<string, unknown>) {
    return this.request<T>(method, path, options)
  }

  public testList<T>(path: string, params?: Record<string, unknown>) {
    return this.list<T>(path, params)
  }

  public testGet<T>(path: string, id: string) {
    return this.get<T>(path, id)
  }

  public testCreate<T>(path: string, data: unknown) {
    return this.create<T>(path, data)
  }

  public testUpdate<T>(path: string, id: string, data: unknown) {
    return this.update<T>(path, id, data)
  }

  public testDelete<T = void>(path: string, id: string) {
    return this.delete<T>(path, id)
  }
}

describe('BaseApiModule', () => {
  let client: TestClient
  let module: TestModule

  beforeEach(() => {
    client = new TestClient()
    module = new TestModule(client)
  })

  describe('constructor', () => {
    test('should initialize with config', () => {
      expect(module.name).toBe('test')
      expect(module.version).toBe('v2')
    })
  })

  describe('buildEndpoint', () => {
    test('should combine base path with endpoint', () => {
      expect(module.testBuildEndpoint('items')).toBe('test-resources/items')
    })

    test('should handle leading slash in path', () => {
      expect(module.testBuildEndpoint('/items')).toBe('test-resources/items')
    })

    test('should handle empty base path', () => {
      const moduleNoBase = new BaseApiModule(client, {
        name: 'test',
        version: 'v2',
        basePath: '',
      })
      expect(
        (moduleNoBase as unknown as { buildEndpoint: (path: string) => string }).buildEndpoint(
          'items',
        ),
      ).toBe('items')
    })
  })

  describe('request operations', () => {
    test('should execute request through client', async () => {
      const mockRequest = mock(() => Promise.resolve({ data: 'test' }))
      client.request = mockRequest

      await module.testRequest('GET', 'items')

      expect(mockRequest).toHaveBeenCalledWith('GET', 'test-resources/items', {
        apiVersion: 'v2',
      })
    })

    test('should pass options to client request', async () => {
      const mockRequest = mock(() => Promise.resolve({ data: 'test' }))
      client.request = mockRequest

      const options = { params: { limit: 10 } }
      await module.testRequest('GET', 'items', options)

      expect(mockRequest).toHaveBeenCalledWith('GET', 'test-resources/items', {
        params: { limit: 10 },
        apiVersion: 'v2',
      })
    })
  })

  describe('CRUD operations', () => {
    test('list should make GET request with params', async () => {
      const mockRequest = mock(() => Promise.resolve([{ id: 1 }]))
      module.request = mockRequest

      const params = { limit: 10, offset: 0 }
      await module.testList('items', params)

      expect(mockRequest).toHaveBeenCalledWith('GET', 'items', { params })
    })

    test('get should make GET request with ID', async () => {
      const mockRequest = mock(() => Promise.resolve({ id: '123' }))
      module.request = mockRequest

      await module.testGet('items', '123')

      expect(mockRequest).toHaveBeenCalledWith('GET', 'items/123')
    })

    test('create should make POST request with data', async () => {
      const mockRequest = mock(() => Promise.resolve({ id: '123', name: 'New' }))
      module.request = mockRequest

      const data = { name: 'New' }
      await module.testCreate('items', data)

      expect(mockRequest).toHaveBeenCalledWith('POST', 'items', { body: data })
    })

    test('update should make PUT request with ID and data', async () => {
      const mockRequest = mock(() => Promise.resolve({ id: '123', name: 'Updated' }))
      module.request = mockRequest

      const data = { name: 'Updated' }
      await module.testUpdate('items', '123', data)

      expect(mockRequest).toHaveBeenCalledWith('PUT', 'items/123', { body: data })
    })

    test('delete should make DELETE request with ID', async () => {
      const mockRequest = mock(() => Promise.resolve(undefined))
      module.request = mockRequest

      await module.testDelete('items', '123')

      expect(mockRequest).toHaveBeenCalledWith('DELETE', 'items/123')
    })
  })
})

describe('ApiModuleFactory', () => {
  let client: TestClient
  let factory: ApiModuleFactory

  beforeEach(() => {
    client = new TestClient()
    factory = new ApiModuleFactory(client)
  })

  test('should register and retrieve module', () => {
    const module = factory.register('test', (c) => new TestModule(c))

    expect(module).toBeInstanceOf(TestModule)
    expect(factory.get('test')).toBe(module)
  })

  test('should return existing module if already registered', () => {
    const module1 = factory.register('test', (c) => new TestModule(c))
    const module2 = factory.register('test', (c) => new TestModule(c))

    expect(module1).toBe(module2)
  })

  test('should check if module exists', () => {
    expect(factory.has('test')).toBe(false)

    factory.register('test', (c) => new TestModule(c))

    expect(factory.has('test')).toBe(true)
  })

  test('should get all registered modules', () => {
    const module1 = factory.register('test1', (c) => new TestModule(c))
    const module2 = factory.register('test2', (c) => new TestModule(c))

    const all = factory.getAll()

    expect(all).toHaveLength(2)
    expect(all).toContain(module1)
    expect(all).toContain(module2)
  })

  test('should clear all modules', () => {
    factory.register('test1', (c) => new TestModule(c))
    factory.register('test2', (c) => new TestModule(c))

    expect(factory.getAll()).toHaveLength(2)

    factory.clear()

    expect(factory.getAll()).toHaveLength(0)
    expect(factory.has('test1')).toBe(false)
    expect(factory.has('test2')).toBe(false)
  })

  test('should return undefined for non-existent module', () => {
    expect(factory.get('nonexistent')).toBeUndefined()
  })
})
