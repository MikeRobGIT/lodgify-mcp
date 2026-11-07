import { describe, expect, test } from 'bun:test'
import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js'
import { LodgifyOrchestrator } from '../src/lodgify-orchestrator.js'
import { setupServer } from '../src/mcp/server-setup.js'

async function connect(readOnly: boolean) {
  const { server } = setupServer(new LodgifyOrchestrator({ apiKey: 'test-key', readOnly }))
  const client = new Client({ name: 'contract-test', version: '0.0.0' })
  const [a, b] = InMemoryTransport.createLinkedPair()
  await Promise.all([server.connect(a), client.connect(b)])
  return client
}

const READ_TOOLS = [
  'lodgify_daily_booking_summary',
  'lodgify_daily_rates',
  'lodgify_find_properties',
  'lodgify_get_booking',
  'lodgify_get_booking_payment_link',
  'lodgify_get_external_bookings',
  'lodgify_get_property',
  'lodgify_get_property_availability',
  'lodgify_get_quote',
  'lodgify_get_thread',
  'lodgify_list_bookings',
  'lodgify_list_deleted_properties',
  'lodgify_list_properties',
  'lodgify_list_property_rooms',
  'lodgify_list_vacant_inventory',
  'lodgify_list_webhooks',
  'lodgify_rate_settings',
]
const WRITE_TOOLS = [
  'lodgify_checkin_booking',
  'lodgify_checkout_booking',
  'lodgify_create_booking',
  'lodgify_create_booking_payment_link',
  'lodgify_create_booking_quote',
  'lodgify_delete_booking',
  'lodgify_subscribe_webhook',
  'lodgify_unsubscribe_webhook',
  'lodgify_update_booking',
  'lodgify_update_key_codes',
  'lodgify_update_rates',
]
const names = (tools: Array<{ name: string }>) => tools.map((t) => t.name).sort()

describe('SDK contract', () => {
  test('every tool declares all four annotation hints', async () => {
    const { tools } = await (await connect(false)).listTools()
    expect(tools.length).toBe(28)
    for (const t of tools) {
      const a = t.annotations
      expect(typeof a?.readOnlyHint).toBe('boolean')
      expect(typeof a?.destructiveHint).toBe('boolean')
      expect(typeof a?.idempotentHint).toBe('boolean')
      expect(typeof a?.openWorldHint).toBe('boolean')
      expect(JSON.stringify(t.inputSchema)).not.toContain('$ref')
    }
    expect(names(tools.filter((t) => t.annotations?.readOnlyHint))).toEqual(READ_TOOLS)
    expect(names(tools.filter((t) => !t.annotations?.readOnlyHint))).toEqual(WRITE_TOOLS)
  })

  test('read-only mode hides write tools', async () => {
    const { tools } = await (await connect(true)).listTools()
    expect(names(tools)).toEqual(READ_TOOLS)
  })

  test('instructions reflect read-only mode', async () => {
    expect((await connect(true)).getInstructions()).toContain('Read-only mode is ON')
    const rw = (await connect(false)).getInstructions()
    expect(rw).toContain('confirm with the user')
    expect(rw).not.toContain('Read-only mode is ON')
  })

  test('write tools are not callable in read-only mode', async () => {
    const res = await (await connect(true)).callTool({
      name: 'lodgify_delete_booking',
      arguments: { id: 1 },
    })
    expect(res.isError).toBe(true)
    expect((res.content as Array<{ text: string }>)[0].text).toContain('not found')
  })

  test('capabilities: no resource subscribe, logging level handled, instructions set', async () => {
    const client = await connect(false)
    expect(client.getServerCapabilities()?.resources?.subscribe).toBeFalsy()
    await client.setLoggingLevel('error')
    expect(client.getInstructions()).toContain('Lodgify')
  })

  test('invalid arguments come back as isError, not a protocol error', async () => {
    const res = await (await connect(false)).callTool({
      name: 'lodgify_get_property',
      arguments: { id: 'not-a-number' },
    })
    expect(res.isError).toBe(true)
  })

  test('handler failures are isError without a doubled MCP prefix', async () => {
    const res = (await (
      await connect(false)
    ).callTool({
      name: 'lodgify_list_bookings',
      arguments: { stayFilter: 'ArrivalDate' },
    })) as { isError?: boolean; content: Array<{ text: string }> }
    expect(res.isError).toBe(true)
    expect(res.content[0].text).not.toContain('MCP error -32602: MCP error')
  })
})
