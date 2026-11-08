import { describe, expect, test } from 'bun:test'
import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js'
import { LodgifyOrchestrator } from '../src/lodgify-orchestrator.js'
import { setupServer } from '../src/mcp/server-setup.js'

// Lodgify's API answers wid=0 with an opaque .NET NullReferenceException (code 666),
// so the server must reject non-positive website IDs before any request is made.
async function connect() {
  const { server } = setupServer(new LodgifyOrchestrator({ apiKey: 'test-key', readOnly: true }))
  const client = new Client({ name: 'wid-test', version: '0.0.0' })
  const [a, b] = InMemoryTransport.createLinkedPair()
  await Promise.all([server.connect(a), client.connect(b)])
  return client
}

const TOOLS_WITH_WID: Array<{ name: string; args: Record<string, unknown> }> = [
  { name: 'lodgify_list_properties', args: {} },
  { name: 'lodgify_get_property', args: { id: 1 } },
  { name: 'lodgify_list_vacant_inventory', args: { from: '2030-01-01', to: '2030-01-05' } },
]

describe('wid validation', () => {
  for (const tool of TOOLS_WITH_WID) {
    for (const wid of [0, -5]) {
      test(`${tool.name} rejects wid=${wid} with an actionable message`, async () => {
        const client = await connect()
        const listed = await client.listTools()
        expect(listed.tools.some((t) => t.name === tool.name)).toBe(true)

        const res = (await client.callTool({
          name: tool.name,
          arguments: { ...tool.args, wid },
        })) as { isError?: boolean; content: Array<{ text: string }> }

        expect(res.isError).toBe(true)
        expect(res.content[0].text).toContain('wid must be a positive integer')
        expect(res.content[0].text).not.toContain('NullReference')
      })
    }
  }
})
