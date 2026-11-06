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

describe('SDK contract', () => {
  test('every tool declares all four annotation hints', async () => {
    const { tools } = await (await connect(false)).listTools()
    expect(tools.length).toBe(27)
    for (const t of tools) {
      const a = t.annotations
      expect(typeof a?.readOnlyHint).toBe('boolean')
      expect(typeof a?.destructiveHint).toBe('boolean')
      expect(typeof a?.idempotentHint).toBe('boolean')
      expect(typeof a?.openWorldHint).toBe('boolean')
      expect(JSON.stringify(t.inputSchema)).not.toContain('$ref')
    }
    expect(tools.filter((t) => !t.annotations?.readOnlyHint).length).toBe(11)
  })

  test('read-only mode hides write tools', async () => {
    const { tools } = await (await connect(true)).listTools()
    expect(tools.length).toBe(16)
    expect(tools.every((t) => t.annotations?.readOnlyHint === true)).toBe(true)
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

  test('handler failures are isError JSON without a doubled MCP prefix', async () => {
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
