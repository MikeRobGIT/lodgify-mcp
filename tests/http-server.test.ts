import { afterAll, beforeAll, describe, expect, test } from 'bun:test'
import { request, type Server } from 'node:http'
import { createApp } from '../src/http-app.js'
import { LodgifyOrchestrator } from '../src/lodgify-orchestrator.js'

const TOKEN = 'test-token'
let server: Server
let url: string

// node:http, not fetch: other test files replace global.fetch with mocks
const send = (method: string, headers: Record<string, string>, body?: unknown) =>
  new Promise<{ status: number; text: string }>((resolve, reject) => {
    const req = request(`${url}/mcp`, { method, headers }, (res) => {
      let text = ''
      res.on('data', (c) => {
        text += c
      })
      res.on('end', () => resolve({ status: res.statusCode ?? 0, text }))
    })
    req.on('error', reject)
    if (body !== undefined) req.write(JSON.stringify(body))
    req.end()
  })

const post = (body: unknown, token = TOKEN) =>
  send(
    'POST',
    {
      'content-type': 'application/json',
      accept: 'application/json, text/event-stream',
      authorization: `Bearer ${token}`,
    },
    body,
  )

beforeAll(async () => {
  const app = createApp(TOKEN, new LodgifyOrchestrator({ apiKey: 'test-key' }))
  await new Promise<void>((resolve) => {
    server = app.listen(0, resolve)
  })
  url = `http://127.0.0.1:${(server.address() as { port: number }).port}`
})
afterAll(() => {
  server.close()
})

describe('stateless HTTP transport', () => {
  test('requires bearer token', async () => {
    expect((await post({}, 'wrong')).status).toBe(401)
    expect((await send('GET', {})).status).toBe(401)
  })

  test('initialize then concurrent same-id requests all succeed', async () => {
    const init = await post({
      jsonrpc: '2.0',
      id: 1,
      method: 'initialize',
      params: {
        protocolVersion: '2025-06-18',
        capabilities: {},
        clientInfo: { name: 't', version: '0' },
      },
    })
    expect(init.status).toBe(200)
    const list = { jsonrpc: '2.0', id: 2, method: 'tools/list', params: {} }
    const results = await Promise.all([post(list), post(list), post(list)])
    for (const r of results) {
      expect(r.status).toBe(200)
      expect(r.text).toContain('lodgify_list_properties')
    }
  })

  test('GET /mcp is 405', async () => {
    const r = await send('GET', { authorization: `Bearer ${TOKEN}` })
    expect(r.status).toBe(405)
  })
})
