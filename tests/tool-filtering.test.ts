import { afterEach, describe, expect, test } from 'bun:test'
import type { LodgifyOrchestrator } from '../src/lodgify-orchestrator.js'
import { setupServer } from '../src/server.js'

function createDummyClient(): LodgifyOrchestrator {
  return {} as LodgifyOrchestrator
}

const ORIGINAL_TOOL_SET_ENV = process.env.LODGIFY_ENABLED_TOOL_SETS
const ORIGINAL_READ_ONLY_ENV = process.env.LODGIFY_READ_ONLY
const ORIGINAL_API_KEY = process.env.LODGIFY_API_KEY

describe('Tool set filtering', () => {
  afterEach(() => {
    if (ORIGINAL_TOOL_SET_ENV === undefined) {
      delete process.env.LODGIFY_ENABLED_TOOL_SETS
    } else {
      process.env.LODGIFY_ENABLED_TOOL_SETS = ORIGINAL_TOOL_SET_ENV
    }

    if (ORIGINAL_READ_ONLY_ENV === undefined) {
      delete process.env.LODGIFY_READ_ONLY
    } else {
      process.env.LODGIFY_READ_ONLY = ORIGINAL_READ_ONLY_ENV
    }

    if (ORIGINAL_API_KEY === undefined) {
      delete process.env.LODGIFY_API_KEY
    } else {
      process.env.LODGIFY_API_KEY = ORIGINAL_API_KEY
    }
  })

  test('registers only booking and quote tools when restricted', () => {
    process.env.LODGIFY_ENABLED_TOOL_SETS = 'bookings,quotes'
    const { toolRegistry } = setupServer(createDummyClient())
    const tools = toolRegistry.getTools()

    expect(tools.length).toBeGreaterThan(0)

    const disallowed = tools.filter((tool) => {
      if (tool.category === 'Booking & Reservation Management') {
        return false
      }
      if (tool.category === 'Rates & Pricing' && tool.name.toLowerCase().includes('quote')) {
        return false
      }
      return true
    })

    expect(disallowed).toHaveLength(0)
  })

  test('supports quote-only restrictions', () => {
    process.env.LODGIFY_ENABLED_TOOL_SETS = 'quotes'
    const { toolRegistry } = setupServer(createDummyClient())
    const tools = toolRegistry.getTools()

    expect(tools.length).toBeGreaterThan(0)
    expect(tools.every((tool) => tool.name.toLowerCase().includes('quote'))).toBe(true)
  })

  test('treats empty configuration as allowing all tools', () => {
    process.env.LODGIFY_ENABLED_TOOL_SETS = '   '
    const { toolRegistry } = setupServer(createDummyClient())
    const tools = toolRegistry.getTools()

    expect(tools.length).toBeGreaterThan(0)
    expect(tools.some((tool) => tool.category === 'Property Management')).toBe(true)
    expect(tools.some((tool) => tool.category === 'Booking & Reservation Management')).toBe(true)
  })

  test('honors tool restrictions while running in read-only mode', () => {
    process.env.LODGIFY_ENABLED_TOOL_SETS = 'bookings,quotes'
    process.env.LODGIFY_READ_ONLY = 'true'
    process.env.LODGIFY_API_KEY =
      'valid-sandbox-api-key-that-is-long-enough-to-pass-validation-12345'

    const { toolRegistry, getClient } = setupServer()
    const tools = toolRegistry.getTools()

    expect(tools.length).toBeGreaterThan(0)

    const disallowed = tools.filter((tool) => {
      if (tool.category === 'Booking & Reservation Management') {
        return false
      }
      if (tool.category === 'Rates & Pricing' && tool.name.toLowerCase().includes('quote')) {
        return false
      }
      return true
    })

    expect(disallowed).toHaveLength(0)
    expect(getClient().isReadOnly()).toBe(true)
  })
})
