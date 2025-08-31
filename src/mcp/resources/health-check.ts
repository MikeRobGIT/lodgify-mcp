/**
 * Health Check Module
 * Provides health status monitoring for the MCP server
 */

import type { LodgifyOrchestrator } from '../../lodgify-orchestrator.js'
import type { DependencyHealth } from '../utils/types.js'

/**
 * Check the health status of all dependencies
 */
export async function checkDependencies(
  client: LodgifyOrchestrator,
): Promise<Record<string, DependencyHealth>> {
  const dependencies: Record<string, DependencyHealth> = {}

  // Check Lodgify API connectivity
  try {
    const startTime = Date.now()
    // Try to make a simple API call to test connectivity
    await client.properties.listProperties({ limit: 1 })
    const responseTime = Date.now() - startTime

    dependencies.lodgifyApi = {
      status: 'healthy',
      responseTime,
      lastChecked: new Date().toISOString(),
      details: 'Successfully connected to Lodgify API',
    }
  } catch (error) {
    dependencies.lodgifyApi = {
      status: 'unhealthy',
      lastChecked: new Date().toISOString(),
      error: error instanceof Error ? error.message : 'Unknown error',
      details: 'Failed to connect to Lodgify API',
    }
  }

  // Check environment configuration
  dependencies.environment = {
    status: process.env.LODGIFY_API_KEY ? 'healthy' : 'unhealthy',
    lastChecked: new Date().toISOString(),
    details: process.env.LODGIFY_API_KEY
      ? 'API key is configured'
      : 'LODGIFY_API_KEY environment variable is not set',
  }

  return dependencies
}
