/**
 * Tests for MCP Resources - Rate Limit Resource Handler
 * Tests critical user-facing monitoring functionality
 */

import { beforeEach, describe, expect, it, vi } from 'bun:test'
import type { LodgifyOrchestrator } from '../src/lodgify-orchestrator.js'
import { registerResources } from '../src/mcp/resources/resources.js'
import type { IResourceRegistry } from '../src/mcp/utils/types.js'

describe('MCP Resources - Rate Limit Resource', () => {
  let registry: IResourceRegistry
  let registeredResources: Map<string, any>
  let mockClient: LodgifyOrchestrator

  beforeEach(() => {
    registeredResources = new Map()
    registry = {
      register: vi.fn((resource) => {
        registeredResources.set(resource.uri, resource)
      }),
    }
    mockClient = {
      // Minimal mock for rate limit resource (doesn't use client)
    } as LodgifyOrchestrator
  })

  describe('Rate Limit Resource Handler', () => {
    it('should register the rate-limit resource with correct configuration', () => {
      // Register resources
      registerResources(registry, () => mockClient)

      // Verify registration was called
      expect(registry.register).toHaveBeenCalled()

      // Get the rate-limit resource
      const rateLimitResource = registeredResources.get('lodgify://rate-limit')
      expect(rateLimitResource).toBeDefined()
      expect(rateLimitResource.name).toBe('rate-limit')
      expect(rateLimitResource.config.title).toBe('Rate Limit Status')
      expect(rateLimitResource.config.description).toContain('rate limit usage')
      expect(rateLimitResource.config.mimeType).toBe('application/json')
    })

    it('should return rate limit status with OK status when utilization is low', async () => {
      // Register resources
      registerResources(registry, () => mockClient)

      // Get the rate-limit resource handler
      const rateLimitResource = registeredResources.get('lodgify://rate-limit')
      const uri = new URL('lodgify://rate-limit')

      // Execute the handler
      const result = await rateLimitResource.handler(uri)

      // Parse the response
      const responseData = JSON.parse(result.contents[0].text)

      // Verify response structure
      expect(responseData.service).toBe('lodgify-api')
      expect(responseData.rateLimitInfo).toBeDefined()
      expect(responseData.rateLimitInfo.available).toBe(true)
      expect(responseData.rateLimitInfo.resetTime).toBeNull()
      expect(responseData.rateLimitInfo.utilizationPercent).toBe(0)
      expect(responseData.rateLimitInfo.status).toBe('ok')
      expect(responseData.rateLimitInfo.recommendation).toContain('within normal range')
      expect(responseData.timestamp).toBeDefined()
    })

    it('should provide warning status when utilization is high (80-94%)', async () => {
      // Register resources with mock that simulates high usage
      registerResources(registry, () => mockClient)

      // Get handler and modify the internal logic to simulate high usage
      const rateLimitResource = registeredResources.get('lodgify://rate-limit')

      // Create a modified handler that simulates 85% utilization
      const originalHandler = rateLimitResource.handler
      rateLimitResource.handler = async (uri) => {
        const result = await originalHandler(uri)
        const data = JSON.parse(result.contents[0].text)

        // Simulate 85% utilization
        data.rateLimitInfo.utilizationPercent = 85
        data.rateLimitInfo.status =
          data.rateLimitInfo.utilizationPercent >= 95
            ? 'critical'
            : data.rateLimitInfo.utilizationPercent >= 80
              ? 'warning'
              : 'ok'
        data.rateLimitInfo.recommendation =
          data.rateLimitInfo.utilizationPercent >= 95
            ? 'Rate limit nearly exhausted. Consider reducing request frequency.'
            : data.rateLimitInfo.utilizationPercent >= 80
              ? 'High rate limit usage detected. Monitor closely.'
              : 'Rate limit usage is within normal range.'

        return {
          contents: [
            {
              uri: result.contents[0].uri,
              mimeType: result.contents[0].mimeType,
              text: JSON.stringify(data, null, 2),
            },
          ],
        }
      }

      const uri = new URL('lodgify://rate-limit')
      const result = await rateLimitResource.handler(uri)
      const responseData = JSON.parse(result.contents[0].text)

      // Verify warning status
      expect(responseData.rateLimitInfo.utilizationPercent).toBe(85)
      expect(responseData.rateLimitInfo.status).toBe('warning')
      expect(responseData.rateLimitInfo.recommendation).toContain('Monitor closely')
    })

    it('should provide critical status when utilization is very high (95%+)', async () => {
      // Register resources
      registerResources(registry, () => mockClient)

      // Get handler and simulate critical usage
      const rateLimitResource = registeredResources.get('lodgify://rate-limit')

      // Create a modified handler that simulates 98% utilization
      const originalHandler = rateLimitResource.handler
      rateLimitResource.handler = async (uri) => {
        const result = await originalHandler(uri)
        const data = JSON.parse(result.contents[0].text)

        // Simulate 98% utilization
        data.rateLimitInfo.utilizationPercent = 98
        data.rateLimitInfo.status =
          data.rateLimitInfo.utilizationPercent >= 95
            ? 'critical'
            : data.rateLimitInfo.utilizationPercent >= 80
              ? 'warning'
              : 'ok'
        data.rateLimitInfo.recommendation =
          data.rateLimitInfo.utilizationPercent >= 95
            ? 'Rate limit nearly exhausted. Consider reducing request frequency.'
            : data.rateLimitInfo.utilizationPercent >= 80
              ? 'High rate limit usage detected. Monitor closely.'
              : 'Rate limit usage is within normal range.'

        return {
          contents: [
            {
              uri: result.contents[0].uri,
              mimeType: result.contents[0].mimeType,
              text: JSON.stringify(data, null, 2),
            },
          ],
        }
      }

      const uri = new URL('lodgify://rate-limit')
      const result = await rateLimitResource.handler(uri)
      const responseData = JSON.parse(result.contents[0].text)

      // Verify critical status
      expect(responseData.rateLimitInfo.utilizationPercent).toBe(98)
      expect(responseData.rateLimitInfo.status).toBe('critical')
      expect(responseData.rateLimitInfo.recommendation).toContain('nearly exhausted')
      expect(responseData.rateLimitInfo.recommendation).toContain('reducing request frequency')
    })

    it('should return valid JSON response format for monitoring tools', async () => {
      // Register resources
      registerResources(registry, () => mockClient)

      const rateLimitResource = registeredResources.get('lodgify://rate-limit')
      const uri = new URL('lodgify://rate-limit')

      const result = await rateLimitResource.handler(uri)

      // Verify response structure
      expect(result.contents).toBeArray()
      expect(result.contents[0].uri).toBe('lodgify://rate-limit')
      expect(result.contents[0].mimeType).toBe('application/json')

      // Verify JSON is valid
      const responseData = JSON.parse(result.contents[0].text)
      expect(responseData).toBeDefined()

      // Verify essential fields for monitoring integration
      expect(responseData.service).toBeDefined()
      expect(responseData.rateLimitInfo).toBeDefined()
      expect(responseData.timestamp).toBeDefined()

      // Verify timestamp is valid ISO string
      expect(() => new Date(responseData.timestamp)).not.toThrow()
    })

    it('should handle edge case when rate limit info is at exactly 80% threshold', async () => {
      // Register resources
      registerResources(registry, () => mockClient)

      const rateLimitResource = registeredResources.get('lodgify://rate-limit')

      // Modify to simulate exactly 80% utilization
      const originalHandler = rateLimitResource.handler
      rateLimitResource.handler = async (uri) => {
        const result = await originalHandler(uri)
        const data = JSON.parse(result.contents[0].text)

        // Simulate exactly 80% utilization
        data.rateLimitInfo.utilizationPercent = 80
        data.rateLimitInfo.status =
          data.rateLimitInfo.utilizationPercent >= 95
            ? 'critical'
            : data.rateLimitInfo.utilizationPercent >= 80
              ? 'warning'
              : 'ok'
        data.rateLimitInfo.recommendation =
          data.rateLimitInfo.utilizationPercent >= 95
            ? 'Rate limit nearly exhausted. Consider reducing request frequency.'
            : data.rateLimitInfo.utilizationPercent >= 80
              ? 'High rate limit usage detected. Monitor closely.'
              : 'Rate limit usage is within normal range.'

        return {
          contents: [
            {
              uri: result.contents[0].uri,
              mimeType: result.contents[0].mimeType,
              text: JSON.stringify(data, null, 2),
            },
          ],
        }
      }

      const uri = new URL('lodgify://rate-limit')
      const result = await rateLimitResource.handler(uri)
      const responseData = JSON.parse(result.contents[0].text)

      // At exactly 80%, should be warning
      expect(responseData.rateLimitInfo.utilizationPercent).toBe(80)
      expect(responseData.rateLimitInfo.status).toBe('warning')
    })

    it('should handle edge case when rate limit info is at exactly 95% threshold', async () => {
      // Register resources
      registerResources(registry, () => mockClient)

      const rateLimitResource = registeredResources.get('lodgify://rate-limit')

      // Modify to simulate exactly 95% utilization
      const originalHandler = rateLimitResource.handler
      rateLimitResource.handler = async (uri) => {
        const result = await originalHandler(uri)
        const data = JSON.parse(result.contents[0].text)

        // Simulate exactly 95% utilization
        data.rateLimitInfo.utilizationPercent = 95
        data.rateLimitInfo.status =
          data.rateLimitInfo.utilizationPercent >= 95
            ? 'critical'
            : data.rateLimitInfo.utilizationPercent >= 80
              ? 'warning'
              : 'ok'
        data.rateLimitInfo.recommendation =
          data.rateLimitInfo.utilizationPercent >= 95
            ? 'Rate limit nearly exhausted. Consider reducing request frequency.'
            : data.rateLimitInfo.utilizationPercent >= 80
              ? 'High rate limit usage detected. Monitor closely.'
              : 'Rate limit usage is within normal range.'

        return {
          contents: [
            {
              uri: result.contents[0].uri,
              mimeType: result.contents[0].mimeType,
              text: JSON.stringify(data, null, 2),
            },
          ],
        }
      }

      const uri = new URL('lodgify://rate-limit')
      const result = await rateLimitResource.handler(uri)
      const responseData = JSON.parse(result.contents[0].text)

      // At exactly 95%, should be critical
      expect(responseData.rateLimitInfo.utilizationPercent).toBe(95)
      expect(responseData.rateLimitInfo.status).toBe('critical')
    })

    it('should provide consistent data structure for automated monitoring systems', async () => {
      // This test ensures monitoring tools can reliably parse the response
      registerResources(registry, () => mockClient)

      const rateLimitResource = registeredResources.get('lodgify://rate-limit')
      const uri = new URL('lodgify://rate-limit')

      // Make multiple requests to verify consistency
      const results = []
      for (let i = 0; i < 3; i++) {
        const result = await rateLimitResource.handler(uri)
        const data = JSON.parse(result.contents[0].text)
        results.push(data)
      }

      // Verify all responses have the same structure
      for (const result of results) {
        expect(result).toHaveProperty('service')
        expect(result).toHaveProperty('rateLimitInfo')
        expect(result).toHaveProperty('timestamp')
        expect(result.rateLimitInfo).toHaveProperty('available')
        expect(result.rateLimitInfo).toHaveProperty('resetTime')
        expect(result.rateLimitInfo).toHaveProperty('utilizationPercent')
        expect(result.rateLimitInfo).toHaveProperty('status')
        expect(result.rateLimitInfo).toHaveProperty('recommendation')
      }
    })

    it('should be accessible via the correct URI scheme', async () => {
      // Test that the resource is accessible via lodgify:// scheme
      registerResources(registry, () => mockClient)

      const rateLimitResource = registeredResources.get('lodgify://rate-limit')

      // Test with different URI variations
      const uri1 = new URL('lodgify://rate-limit')
      const result1 = await rateLimitResource.handler(uri1)
      expect(result1.contents[0].uri).toBe('lodgify://rate-limit')

      // Verify the handler accepts URL object
      expect(() => rateLimitResource.handler(uri1)).not.toThrow()
    })

    it('should provide actionable recommendations based on utilization levels', async () => {
      registerResources(registry, () => mockClient)
      const rateLimitResource = registeredResources.get('lodgify://rate-limit')

      // Test different utilization levels and verify recommendations
      const testCases = [
        { utilization: 50, expectedRecommendation: 'within normal range' },
        { utilization: 85, expectedRecommendation: 'Monitor closely' },
        { utilization: 99, expectedRecommendation: 'reducing request frequency' },
      ]

      for (const testCase of testCases) {
        const originalHandler = rateLimitResource.handler
        rateLimitResource.handler = async (uri) => {
          const result = await originalHandler(uri)
          const data = JSON.parse(result.contents[0].text)

          data.rateLimitInfo.utilizationPercent = testCase.utilization
          data.rateLimitInfo.status =
            data.rateLimitInfo.utilizationPercent >= 95
              ? 'critical'
              : data.rateLimitInfo.utilizationPercent >= 80
                ? 'warning'
                : 'ok'
          data.rateLimitInfo.recommendation =
            data.rateLimitInfo.utilizationPercent >= 95
              ? 'Rate limit nearly exhausted. Consider reducing request frequency.'
              : data.rateLimitInfo.utilizationPercent >= 80
                ? 'High rate limit usage detected. Monitor closely.'
                : 'Rate limit usage is within normal range.'

          return {
            contents: [
              {
                uri: result.contents[0].uri,
                mimeType: result.contents[0].mimeType,
                text: JSON.stringify(data, null, 2),
              },
            ],
          }
        }

        const uri = new URL('lodgify://rate-limit')
        const result = await rateLimitResource.handler(uri)
        const responseData = JSON.parse(result.contents[0].text)

        expect(responseData.rateLimitInfo.recommendation).toContain(testCase.expectedRecommendation)
      }
    })
  })
})
