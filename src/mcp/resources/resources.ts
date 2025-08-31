/**
 * MCP Resources Implementation
 * All resource handlers for the MCP server
 */

import pkg from '../../../package.json' with { type: 'json' }
import type { LodgifyOrchestrator } from '../../lodgify-orchestrator.js'
import { getDeprecatedTools } from '../tools/deprecation.js'
import type { IResourceRegistry } from '../utils/types.js'
import { checkDependencies } from './health-check.js'

/**
 * Register all MCP resources
 */
export function registerResources(
  registry: IResourceRegistry,
  getClient: () => LodgifyOrchestrator,
): void {
  // Health check resource
  registry.register({
    name: 'health',
    uri: 'lodgify://health',
    config: {
      title: 'Health Check',
      description: 'Check the health status of the Lodgify MCP server',
      mimeType: 'application/json',
    },
    handler: async (uri) => {
      // Check dependencies
      const dependencies = await checkDependencies(getClient())

      // Determine overall status
      const allHealthy = Object.values(dependencies).every((dep) => dep.status === 'healthy')
      const overallStatus = allHealthy ? 'healthy' : 'unhealthy'

      const health = {
        status: overallStatus,
        service: '@mikerob/lodgify-mcp',
        version: pkg.version,
        timestamp: new Date().toISOString(),
        dependencies,
        runtimeInfo: {
          nodeVersion: process.version,
          platform: process.platform,
          arch: process.arch,
          uptime: Math.round(process.uptime()),
          memoryUsage: {
            used: Math.round(process.memoryUsage().heapUsed / 1024 / 1024),
            total: Math.round(process.memoryUsage().heapTotal / 1024 / 1024),
            unit: 'MB',
          },
        },
      }

      return {
        contents: [
          {
            uri: uri.href,
            mimeType: 'application/json',
            text: JSON.stringify(health, null, 2),
          },
        ],
      }
    },
  })

  // Rate limit status resource
  registry.register({
    name: 'rate-limit',
    uri: 'lodgify://rate-limit',
    config: {
      title: 'Rate Limit Status',
      description: 'Monitor current API rate limit usage and status',
      mimeType: 'application/json',
    },
    handler: async (uri) => {
      const rateLimitStatus = { available: true, resetTime: null, utilizationPercent: 0 }

      const status = {
        service: 'lodgify-api',
        rateLimitInfo: {
          ...rateLimitStatus,
          status:
            rateLimitStatus.utilizationPercent >= 95
              ? 'critical'
              : rateLimitStatus.utilizationPercent >= 80
                ? 'warning'
                : 'ok',
          recommendation:
            rateLimitStatus.utilizationPercent >= 95
              ? 'Rate limit nearly exhausted. Consider reducing request frequency.'
              : rateLimitStatus.utilizationPercent >= 80
                ? 'High rate limit usage detected. Monitor closely.'
                : 'Rate limit usage is within normal range.',
        },
        timestamp: new Date().toISOString(),
      }

      return {
        contents: [
          {
            uri: uri.href,
            mimeType: 'application/json',
            text: JSON.stringify(status, null, 2),
          },
        ],
      }
    },
  })

  // Deprecation registry resource
  registry.register({
    name: 'deprecations',
    uri: 'lodgify://deprecations',
    config: {
      title: 'Tool Deprecation Registry',
      description: 'View current tool deprecation notices and upgrade recommendations',
      mimeType: 'application/json',
    },
    handler: async (uri) => {
      const deprecationList = getDeprecatedTools()

      const registry = {
        service: '@mikerob/lodgify-mcp-deprecations',
        totalDeprecatedTools: deprecationList.length,
        deprecations: deprecationList,
        recommendations:
          deprecationList.length > 0
            ? [
                'Update your integration to use recommended replacement tools',
                'Test replacement tools before deprecated ones are removed',
                'Subscribe to release notes for deprecation announcements',
              ]
            : ['No deprecated tools - all tools are current'],
        timestamp: new Date().toISOString(),
      }

      return {
        contents: [
          {
            uri: uri.href,
            mimeType: 'application/json',
            text: JSON.stringify(registry, null, 2),
          },
        ],
      }
    },
  })
}
