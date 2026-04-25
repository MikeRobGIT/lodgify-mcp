/**
 * Health Check Module Tests
 * Tests the critical user-facing health monitoring functionality
 *
 * The health check is essential for:
 * - Monitoring system uptime and availability
 * - Verifying API connectivity before making requests
 * - Alerting users to configuration issues
 * - Providing diagnostic information for troubleshooting
 */

import { afterEach, beforeEach, describe, expect, it, jest } from 'bun:test'
import type { LodgifyOrchestrator } from '../src/lodgify-orchestrator'
import { checkDependencies } from '../src/mcp/resources/health-check'

describe('Health Check - Critical User-Facing Monitoring', () => {
  let originalEnv: NodeJS.ProcessEnv

  beforeEach(() => {
    // Store original environment
    originalEnv = { ...process.env }
  })

  afterEach(() => {
    // Restore original environment
    process.env = originalEnv
  })

  describe('API Connectivity Health Check', () => {
    it('should report healthy when API connection succeeds', async () => {
      // User scenario: Checking if the integration is working properly
      const mockClient = {
        properties: {
          listProperties: jest.fn().mockResolvedValue({
            data: [],
            count: 0,
          }),
        },
      } as unknown as LodgifyOrchestrator

      const health = await checkDependencies(mockClient)

      // Verify the API health is reported correctly
      expect(health.lodgifyApi).toBeDefined()
      expect(health.lodgifyApi.status).toBe('healthy')
      expect(health.lodgifyApi.details).toBe('Successfully connected to Lodgify API')
      expect(health.lodgifyApi.lastChecked).toBeDefined()
      expect(health.lodgifyApi.responseTime).toBeGreaterThanOrEqual(0)
      expect(health.lodgifyApi.error).toBeUndefined()

      // Verify the API was called to test connectivity
      expect(mockClient.properties.listProperties).toHaveBeenCalledWith({ limit: 1 })
    })

    it('should report unhealthy when API connection fails', async () => {
      // User scenario: API is down or credentials are invalid
      const mockError = new Error('401 Unauthorized: Invalid API key')
      const mockClient = {
        properties: {
          listProperties: jest.fn().mockRejectedValue(mockError),
        },
      } as unknown as LodgifyOrchestrator

      const health = await checkDependencies(mockClient)

      // Verify the unhealthy status is reported with error details
      expect(health.lodgifyApi).toBeDefined()
      expect(health.lodgifyApi.status).toBe('unhealthy')
      expect(health.lodgifyApi.details).toBe('Failed to connect to Lodgify API')
      expect(health.lodgifyApi.error).toBe('401 Unauthorized: Invalid API key')
      expect(health.lodgifyApi.lastChecked).toBeDefined()
      expect(health.lodgifyApi.responseTime).toBeUndefined()
    })

    it('should measure API response time accurately', async () => {
      let resolvePromise: (() => void) | undefined
      const delayedPromise = new Promise<{ data: unknown[]; count: number }>((resolve) => {
        resolvePromise = () => resolve({ data: [], count: 0 })
      })

      const mockClient = {
        properties: {
          listProperties: jest.fn().mockImplementation(async () => {
            // Simulate 100ms API delay
            await new Promise((resolve) => setTimeout(resolve, 100))
            resolvePromise?.()
            return delayedPromise
          }),
        },
      } as unknown as LodgifyOrchestrator

      const health = await checkDependencies(mockClient)

      // Response time should reflect the API delay. Bounds are loose to
      // accommodate timer-precision and CI/test-runner jitter; the assertion
      // still catches truly broken measurements (orders of magnitude off).
      expect(health.lodgifyApi.status).toBe('healthy')
      expect(health.lodgifyApi.responseTime).toBeGreaterThanOrEqual(80)
      expect(health.lodgifyApi.responseTime).toBeLessThan(2000)
    })

    it('should handle non-Error exceptions gracefully', async () => {
      // User scenario: Unexpected error format from third-party library
      const mockClient = {
        properties: {
          listProperties: jest.fn().mockRejectedValue('String error'),
        },
      } as unknown as LodgifyOrchestrator

      const health = await checkDependencies(mockClient)

      // Should handle non-Error objects safely
      expect(health.lodgifyApi.status).toBe('unhealthy')
      expect(health.lodgifyApi.error).toBe('Unknown error')
      expect(health.lodgifyApi.details).toBe('Failed to connect to Lodgify API')
    })
  })

  describe('Environment Configuration Health Check', () => {
    it('should report healthy when API key is configured', async () => {
      // User scenario: Verifying the server is properly configured
      process.env.LODGIFY_API_KEY = 'test-api-key-12345'

      const mockClient = {
        properties: {
          listProperties: jest.fn().mockResolvedValue({ data: [] }),
        },
      } as unknown as LodgifyOrchestrator

      const health = await checkDependencies(mockClient)

      // Environment should be reported as healthy
      expect(health.environment).toBeDefined()
      expect(health.environment.status).toBe('healthy')
      expect(health.environment.details).toBe('API key is configured')
      expect(health.environment.lastChecked).toBeDefined()
    })

    it('should report unhealthy when API key is missing', async () => {
      // User scenario: Server started without proper configuration
      delete process.env.LODGIFY_API_KEY

      const mockClient = {
        properties: {
          listProperties: jest.fn().mockResolvedValue({ data: [] }),
        },
      } as unknown as LodgifyOrchestrator

      const health = await checkDependencies(mockClient)

      // Environment should be reported as unhealthy with guidance
      expect(health.environment).toBeDefined()
      expect(health.environment.status).toBe('unhealthy')
      expect(health.environment.details).toBe('LODGIFY_API_KEY environment variable is not set')
      expect(health.environment.lastChecked).toBeDefined()
    })

    it('should report unhealthy when API key is empty string', async () => {
      // User scenario: Configuration file has empty API key value
      process.env.LODGIFY_API_KEY = ''

      const mockClient = {
        properties: {
          listProperties: jest.fn().mockResolvedValue({ data: [] }),
        },
      } as unknown as LodgifyOrchestrator

      const health = await checkDependencies(mockClient)

      // Empty string should be treated as missing
      expect(health.environment.status).toBe('unhealthy')
      expect(health.environment.details).toBe('LODGIFY_API_KEY environment variable is not set')
    })
  })

  describe('Combined Health Status', () => {
    it('should report both API and environment status independently', async () => {
      // User scenario: Partial failure - API works but config is wrong
      process.env.LODGIFY_API_KEY = 'valid-key'

      const mockClient = {
        properties: {
          listProperties: jest.fn().mockRejectedValue(new Error('Network timeout')),
        },
      } as unknown as LodgifyOrchestrator

      const health = await checkDependencies(mockClient)

      // Should report mixed health status
      expect(health.lodgifyApi.status).toBe('unhealthy')
      expect(health.lodgifyApi.error).toBe('Network timeout')
      expect(health.environment.status).toBe('healthy')

      // Both checks should have timestamps for monitoring
      expect(health.lodgifyApi.lastChecked).toBeDefined()
      expect(health.environment.lastChecked).toBeDefined()
    })

    it('should include ISO 8601 timestamps for monitoring systems', async () => {
      // User scenario: External monitoring system needs standard timestamps
      process.env.LODGIFY_API_KEY = 'test-key'

      const mockClient = {
        properties: {
          listProperties: jest.fn().mockResolvedValue({ data: [] }),
        },
      } as unknown as LodgifyOrchestrator

      const health = await checkDependencies(mockClient)

      // Timestamps should be valid ISO 8601 format
      const apiTimestamp = new Date(health.lodgifyApi.lastChecked)
      const envTimestamp = new Date(health.environment.lastChecked)

      expect(apiTimestamp.toISOString()).toBe(health.lodgifyApi.lastChecked)
      expect(envTimestamp.toISOString()).toBe(health.environment.lastChecked)

      // Timestamps should be recent (within last second)
      const now = Date.now()
      expect(now - apiTimestamp.getTime()).toBeLessThan(1000)
      expect(now - envTimestamp.getTime()).toBeLessThan(1000)
    })
  })

  describe('Health Check Use Cases', () => {
    it('should support pre-flight health checks before operations', async () => {
      // User scenario: Checking health before starting a batch operation
      const mockClient = {
        properties: {
          listProperties: jest.fn().mockResolvedValue({ data: [{ id: 1 }] }),
        },
      } as unknown as LodgifyOrchestrator

      process.env.LODGIFY_API_KEY = 'batch-operation-key'

      const health = await checkDependencies(mockClient)

      // All systems should be go for operations
      const canProceed =
        health.lodgifyApi.status === 'healthy' && health.environment.status === 'healthy'

      expect(canProceed).toBe(true)
    })

    it('should provide actionable error messages for troubleshooting', async () => {
      // User scenario: User needs to diagnose connection issues
      const mockClient = {
        properties: {
          listProperties: jest
            .fn()
            .mockRejectedValue(new Error('ECONNREFUSED: Connection refused to api.lodgify.com')),
        },
      } as unknown as LodgifyOrchestrator

      delete process.env.LODGIFY_API_KEY

      const health = await checkDependencies(mockClient)

      // Should provide clear error information
      expect(health.lodgifyApi.error).toContain('ECONNREFUSED')
      expect(health.lodgifyApi.error).toContain('api.lodgify.com')
      expect(health.environment.details).toContain('LODGIFY_API_KEY')
      expect(health.environment.details).toContain('not set')
    })

    it('should complete health check quickly for responsive monitoring', async () => {
      // User scenario: Health endpoint called frequently by monitoring tools
      const mockClient = {
        properties: {
          listProperties: jest.fn().mockImplementation(async () => {
            // Simulate quick API response
            await new Promise((resolve) => setTimeout(resolve, 10))
            return { data: [] }
          }),
        },
      } as unknown as LodgifyOrchestrator

      process.env.LODGIFY_API_KEY = 'monitoring-key'

      const startTime = Date.now()
      const health = await checkDependencies(mockClient)
      const duration = Date.now() - startTime

      // Health check should complete quickly
      expect(duration).toBeLessThan(100) // Should be very fast
      expect(health.lodgifyApi.responseTime).toBeGreaterThanOrEqual(10)
      expect(health.lodgifyApi.responseTime).toBeLessThan(50)
    })
  })

  describe('Health Check Data Structure', () => {
    it('should return consistent structure for automated parsing', async () => {
      // User scenario: Automated monitoring tools parse the health response
      const mockClient = {
        properties: {
          listProperties: jest.fn().mockResolvedValue({ data: [] }),
        },
      } as unknown as LodgifyOrchestrator

      process.env.LODGIFY_API_KEY = 'parser-test-key'

      const health = await checkDependencies(mockClient)

      // Verify the structure matches expected format
      expect(Object.keys(health).sort()).toEqual(['environment', 'lodgifyApi'])

      // Each dependency should have required fields
      expect(health.lodgifyApi).toHaveProperty('status')
      expect(health.lodgifyApi).toHaveProperty('lastChecked')
      expect(health.lodgifyApi).toHaveProperty('details')

      expect(health.environment).toHaveProperty('status')
      expect(health.environment).toHaveProperty('lastChecked')
      expect(health.environment).toHaveProperty('details')

      // Status should be one of the expected values
      expect(['healthy', 'unhealthy']).toContain(health.lodgifyApi.status)
      expect(['healthy', 'unhealthy']).toContain(health.environment.status)
    })
  })
})
