import { afterEach, describe, expect, it, mock } from 'bun:test'
import type { ToolCallback } from '@modelcontextprotocol/sdk/server/mcp.js'
import { ResourceRegistry } from '../src/mcp/resources/registry.js'
import { registerResources } from '../src/mcp/resources/resources.js'
import { DEPRECATED_TOOLS, registerToolWithDeprecation } from '../src/mcp/tools/deprecation.js'
import { ToolRegistry } from '../src/mcp/tools/registry.js'

describe('MCP infrastructure additional coverage', () => {
  const originalApiKey = process.env.LODGIFY_API_KEY
  const loadSetupServer = async () =>
    (await import(`../src/mcp/server-setup.ts?case=${Math.random()}`)).setupServer

  afterEach(() => {
    mock.restore()
    if (originalApiKey === undefined) {
      delete process.env.LODGIFY_API_KEY
    } else {
      process.env.LODGIFY_API_KEY = originalApiKey
    }
    delete DEPRECATED_TOOLS.legacy_tool
  })

  it('registers tools by category and supports clearing the tool registry', () => {
    const registry = new ToolRegistry()
    const handler = mock(async () => ({ content: [{ type: 'text', text: 'ok' }] }))

    registry.register({
      name: 'tool_a',
      category: 'Property Management',
      config: { title: 'Tool A', description: 'desc', inputSchema: {} },
      handler,
    })
    registry.register({
      name: 'tool_b',
      category: 'Rates & Pricing',
      config: { title: 'Tool B', description: 'desc', inputSchema: {} },
      handler,
    })

    expect(registry.getTools()).toHaveLength(2)
    expect(registry.getCategories()['Property Management']).toHaveLength(1)
    expect(registry.getCategories()['Rates & Pricing']).toHaveLength(1)

    const server = { registerTool: mock(() => undefined) }
    registry.registerAll(server as never)
    expect(server.registerTool).toHaveBeenCalledTimes(2)

    registry.clear()
    expect(registry.getTools()).toHaveLength(0)
  })

  it('registers resources with the MCP server and returns registered resources', () => {
    const registry = new ResourceRegistry()
    const handler = mock(async (uri: URL) => ({
      contents: [{ uri: uri.href, mimeType: 'application/json', text: '{}' }],
    }))

    registry.register({
      name: 'health',
      uri: 'lodgify://health',
      config: { title: 'Health', description: 'desc', mimeType: 'application/json' },
      handler,
    })

    expect(registry.getResources()).toHaveLength(1)

    const server = { registerResource: mock(() => undefined) }
    registry.registerAll(server as never)

    expect(server.registerResource).toHaveBeenCalledWith(
      'health',
      'lodgify://health',
      expect.any(Object),
      expect.any(Function),
    )
  })

  it('returns healthy and unhealthy health resource payloads based on dependency checks', async () => {
    const registered = new Map<string, Record<string, unknown>>()
    const registry = {
      register: mock((resource: Record<string, unknown>) => {
        registered.set(resource.uri as string, resource)
      }),
    }

    process.env.LODGIFY_API_KEY = 'sandbox-key-that-is-long-enough-for-validation-1234'
    registerResources(
      registry as never,
      () =>
        ({
          properties: {
            listProperties: mock(async () => ({ data: [] })),
          },
        }) as never,
    )
    const healthHandler = registered.get('lodgify://health')?.handler as (uri: URL) => Promise<{
      contents: Array<{ text: string }>
    }>

    const healthy = JSON.parse((await healthHandler(new URL('lodgify://health'))).contents[0].text)
    expect(healthy.status).toBe('healthy')
    expect(healthy.dependencies.lodgifyApi.status).toBe('healthy')
    expect(healthy.dependencies.environment.status).toBe('healthy')

    delete process.env.LODGIFY_API_KEY
    const secondRegistered = new Map<string, Record<string, unknown>>()
    registerResources(
      {
        register: mock((resource: Record<string, unknown>) => {
          secondRegistered.set(resource.uri as string, resource)
        }),
      } as never,
      () =>
        ({
          properties: {
            listProperties: mock(async () => {
              throw new Error('network down')
            }),
          },
        }) as never,
    )

    const unhealthyHandler = secondRegistered.get('lodgify://health')?.handler as (
      uri: URL,
    ) => Promise<{
      contents: Array<{ text: string }>
    }>
    const unhealthy = JSON.parse(
      (await unhealthyHandler(new URL('lodgify://health'))).contents[0].text,
    )

    expect(unhealthy.status).toBe('unhealthy')
    expect(unhealthy.dependencies.lodgifyApi.status).toBe('unhealthy')
    expect(unhealthy.dependencies.environment.status).toBe('unhealthy')
  })

  it('returns deprecation recommendations for empty and non-empty registries', async () => {
    const emptyResources = new Map<string, Record<string, unknown>>()
    registerResources(
      {
        register: mock((resource: Record<string, unknown>) => {
          emptyResources.set(resource.uri as string, resource)
        }),
      } as never,
      () => ({ properties: { listProperties: mock(async () => ({ data: [] })) } }) as never,
    )

    const emptyHandler = emptyResources.get('lodgify://deprecations')?.handler as (
      uri: URL,
    ) => Promise<{
      contents: Array<{ text: string }>
    }>
    const emptyPayload = JSON.parse(
      (await emptyHandler(new URL('lodgify://deprecations'))).contents[0].text,
    )
    expect(emptyPayload.totalDeprecatedTools).toBe(0)
    expect(emptyPayload.recommendations).toContain('No deprecated tools - all tools are current')

    DEPRECATED_TOOLS.legacy_tool = {
      since: '0.1.0',
      removeIn: '1.0.0',
      reason: 'Replaced with better behavior',
      replacement: 'lodgify_get_property_availability',
    }

    const filledResources = new Map<string, Record<string, unknown>>()
    registerResources(
      {
        register: mock((resource: Record<string, unknown>) => {
          filledResources.set(resource.uri as string, resource)
        }),
      } as never,
      () => ({ properties: { listProperties: mock(async () => ({ data: [] })) } }) as never,
    )

    const filledHandler = filledResources.get('lodgify://deprecations')?.handler as (
      uri: URL,
    ) => Promise<{
      contents: Array<{ text: string }>
    }>
    const filledPayload = JSON.parse(
      (await filledHandler(new URL('lodgify://deprecations'))).contents[0].text,
    )

    expect(filledPayload.totalDeprecatedTools).toBe(1)
    expect(filledPayload.deprecations[0].tool).toBe('legacy_tool')
    expect(
      filledPayload.recommendations.some((item: string) =>
        item.includes('Update your integration'),
      ),
    ).toBe(true)
  })

  it('wraps deprecated tools during registration and keeps setup server helpers usable', async () => {
    const setupServer = await loadSetupServer()
    const server = { registerTool: mock(() => undefined) }
    const callback = mock(async () => ({
      content: [{ type: 'text', text: 'ok' }],
    })) as unknown as ToolCallback<Record<string, never>>
    DEPRECATED_TOOLS.legacy_tool = {
      since: '0.1.0',
      reason: 'Legacy implementation',
      replacement: 'new_tool',
    }

    const config = { title: 'Legacy', description: 'original description', inputSchema: {} }
    registerToolWithDeprecation(server as never, 'legacy_tool', config, callback)

    expect(server.registerTool).toHaveBeenCalledTimes(1)
    expect(config.description).toContain('DEPRECATED')
    const wrappedHandler = server.registerTool.mock.calls[0][2] as (
      input: Record<string, never>,
    ) => Promise<unknown>
    await wrappedHandler({})
    expect(callback).toHaveBeenCalled()

    const injectedClient = { marker: 'injected' }
    const setup = setupServer(injectedClient as never)
    expect(setup.getClient()).toBe(injectedClient)
    await expect(setup.cleanup()).resolves.toBeUndefined()
  })

  it('lazily creates the orchestrator when setupServer has no injected client', async () => {
    const setupServer = await loadSetupServer()
    process.env.LODGIFY_API_KEY = 'sandbox-key-that-is-long-enough-for-validation-1234'
    const setup = setupServer()

    const client = setup.getClient()
    expect(client).toBeDefined()
    expect(typeof client.getHealthStatus).toBe('function')
  })
})
