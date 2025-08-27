import { afterEach, beforeEach, describe, expect, mock, test } from 'bun:test'
import type { BaseApiClient } from '../../src/api/base-client.js'
import { BaseApiModule } from '../../src/api/base-module.js'
import { ApiClientOrchestrator } from '../../src/api/client-orchestrator.js'

// Test module implementations
class PropertiesModule extends BaseApiModule {
  constructor(client: BaseApiClient) {
    super(client, {
      name: 'properties',
      version: 'v2',
      basePath: 'properties',
    })
  }

  async listProperties() {
    return this.list<{ id: string; name: string }>('', { limit: 10 })
  }
}

class BookingsModule extends BaseApiModule {
  constructor(client: BaseApiClient) {
    super(client, {
      name: 'bookings',
      version: 'v2',
      basePath: 'reservations/bookings',
    })
  }

  async listBookings() {
    return this.list<{ id: string; status: string }>('', { limit: 10 })
  }
}

describe('ApiClientOrchestrator', () => {
  let orchestrator: ApiClientOrchestrator
  let originalFetch: typeof global.fetch

  beforeEach(() => {
    originalFetch = global.fetch
    orchestrator = new ApiClientOrchestrator({ apiKey: 'test-key' })
  })

  afterEach(() => {
    global.fetch = originalFetch
  })

  describe('constructor', () => {
    test('should initialize with config', () => {
      const orchestrator = new ApiClientOrchestrator({
        apiKey: 'test-key',
        defaultVersion: 'v1',
        baseUrl: 'https://custom.api.com',
      })

      expect(orchestrator).toBeDefined()
    })

    test('should throw error if API key is missing', () => {
      expect(() => new ApiClientOrchestrator({ apiKey: '' })).toThrow('API key is required')
    })
  })

  describe('module management', () => {
    test('should register and retrieve modules', () => {
      const properties = orchestrator.registerModule('properties', (c) => new PropertiesModule(c))
      const bookings = orchestrator.registerModule('bookings', (c) => new BookingsModule(c))

      expect(orchestrator.getModule('properties')).toBe(properties)
      expect(orchestrator.getModule('bookings')).toBe(bookings)
    })

    test('should check if module exists', () => {
      expect(orchestrator.hasModule('properties')).toBe(false)

      orchestrator.registerModule('properties', (c) => new PropertiesModule(c))

      expect(orchestrator.hasModule('properties')).toBe(true)
    })

    test('should get all modules', () => {
      orchestrator.registerModule('properties', (c) => new PropertiesModule(c))
      orchestrator.registerModule('bookings', (c) => new BookingsModule(c))

      const modules = orchestrator.getAllModules()

      expect(modules).toHaveLength(2)
      expect(modules.map((m) => m.name)).toContain('properties')
      expect(modules.map((m) => m.name)).toContain('bookings')
    })

    test('should clear all modules', () => {
      orchestrator.registerModule('properties', (c) => new PropertiesModule(c))
      orchestrator.registerModule('bookings', (c) => new BookingsModule(c))

      expect(orchestrator.getAllModules()).toHaveLength(2)

      orchestrator.clearModules()

      expect(orchestrator.getAllModules()).toHaveLength(0)
    })
  })

  describe('executeAcrossModules', () => {
    test('should execute operation across all modules', async () => {
      const _properties = orchestrator.registerModule('properties', (c) => new PropertiesModule(c))
      const _bookings = orchestrator.registerModule('bookings', (c) => new BookingsModule(c))

      const mockFetch = mock(() =>
        Promise.resolve(
          new Response(JSON.stringify([{ id: '1' }]), {
            status: 200,
            headers: new Headers({ 'content-type': 'application/json' }),
          }),
        ),
      )
      global.fetch = mockFetch

      const results = await orchestrator.executeAcrossModules(async (module) => {
        if (module.name === 'properties') {
          return await (module as PropertiesModule).listProperties()
        }
        if (module.name === 'bookings') {
          return await (module as BookingsModule).listBookings()
        }
        return null
      })

      expect(results.size).toBe(2)
      expect(results.has('properties')).toBe(true)
      expect(results.has('bookings')).toBe(true)
    })

    test('should execute operation on specific modules only', async () => {
      orchestrator.registerModule('properties', (c) => new PropertiesModule(c))
      orchestrator.registerModule('bookings', (c) => new BookingsModule(c))

      const mockFetch = mock(() =>
        Promise.resolve(
          new Response(JSON.stringify([{ id: '1' }]), {
            status: 200,
            headers: new Headers({ 'content-type': 'application/json' }),
          }),
        ),
      )
      global.fetch = mockFetch

      const results = await orchestrator.executeAcrossModules(
        async (module) => module.name,
        ['properties'],
      )

      expect(results.size).toBe(1)
      expect(results.has('properties')).toBe(true)
      expect(results.has('bookings')).toBe(false)
    })

    test('should handle errors in module operations', async () => {
      orchestrator.registerModule('properties', (c) => new PropertiesModule(c))

      const mockFetch = mock(() => Promise.reject(new Error('Network error')))
      global.fetch = mockFetch

      await expect(
        orchestrator.executeAcrossModules(async (_module) => {
          throw new Error('Operation failed')
        }),
      ).rejects.toThrow('Operation failed')
    })
  })

  describe('batch operations', () => {
    test('should execute batch operations in parallel', async () => {
      let callCount = 0
      const mockFetch = mock(() => {
        callCount++
        return Promise.resolve(
          new Response(JSON.stringify({ id: callCount }), {
            status: 200,
            headers: new Headers({ 'content-type': 'application/json' }),
          }),
        )
      })
      global.fetch = mockFetch

      const operations = [
        { method: 'GET', path: 'properties/1' },
        { method: 'GET', path: 'properties/2' },
        { method: 'GET', path: 'properties/3' },
      ]

      const results = await orchestrator.batch<{ id: number }>(operations)

      expect(results).toHaveLength(3)
      expect(results[0]).toEqual({ id: 1 })
      expect(results[1]).toEqual({ id: 2 })
      expect(results[2]).toEqual({ id: 3 })
      expect(callCount).toBe(3)
    })
  })

  describe('transaction operations', () => {
    test('should execute transaction successfully', async () => {
      const results: string[] = []

      const ops = [
        {
          execute: async () => {
            results.push('op1')
            return 'result1'
          },
        },
        {
          execute: async () => {
            results.push('op2')
            return 'result2'
          },
        },
      ]

      const transactionResults = await orchestrator.transaction(ops)

      expect(transactionResults).toEqual(['result1', 'result2'])
      expect(results).toEqual(['op1', 'op2'])
    })

    test('should rollback on failure', async () => {
      const results: string[] = []
      const rollbacks: string[] = []

      const ops = [
        {
          execute: async () => {
            results.push('op1')
            return 'result1'
          },
          rollback: async () => {
            rollbacks.push('rollback1')
          },
        },
        {
          execute: async () => {
            results.push('op2')
            throw new Error('Operation 2 failed')
          },
          rollback: async () => {
            rollbacks.push('rollback2')
          },
        },
        {
          execute: async () => {
            results.push('op3')
            return 'result3'
          },
          rollback: async () => {
            rollbacks.push('rollback3')
          },
        },
      ]

      await expect(orchestrator.transaction(ops)).rejects.toThrow('Operation 2 failed')

      expect(results).toEqual(['op1', 'op2'])
      expect(rollbacks).toEqual(['rollback1']) // Only op1 was successful, so only it gets rolled back
    })

    test('should handle rollback errors gracefully', async () => {
      const ops = [
        {
          execute: async () => 'result1',
          rollback: async () => {
            throw new Error('Rollback failed')
          },
        },
        {
          execute: async () => {
            throw new Error('Operation 2 failed')
          },
        },
      ]

      // Should still throw the original error, not the rollback error
      await expect(orchestrator.transaction(ops)).rejects.toThrow('Operation 2 failed')
    })
  })

  describe('health check', () => {
    test('should check health of all modules', async () => {
      orchestrator.registerModule('properties', (c) => new PropertiesModule(c))
      orchestrator.registerModule('bookings', (c) => new BookingsModule(c))

      // Note: The health check will always fail because /v2/health endpoint doesn't exist
      // This is expected behavior - we're testing the error handling
      const mockFetch = mock(() => {
        return Promise.resolve(
          new Response(JSON.stringify({ error: 'Not found' }), {
            status: 404,
            headers: new Headers({ 'content-type': 'application/json' }),
          }),
        )
      })
      global.fetch = mockFetch

      const health = await orchestrator.healthCheck()

      // All modules should be unhealthy since the health endpoint returns 404
      expect(health.healthy).toBe(false)

      const propertiesHealth = health.modules.get('properties')
      const bookingsHealth = health.modules.get('bookings')

      expect(propertiesHealth?.healthy).toBe(false)
      expect(propertiesHealth?.error).toBeDefined()
      expect(bookingsHealth?.healthy).toBe(false)
      expect(bookingsHealth?.error).toBeDefined()
    })

    test('should handle health check when no modules registered', async () => {
      const health = await orchestrator.healthCheck()

      expect(health.healthy).toBe(true)
      expect(health.modules.size).toBe(0)
    })
  })
})
