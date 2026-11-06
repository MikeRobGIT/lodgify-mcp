import { afterEach, beforeEach, describe, expect, mock, test } from 'bun:test'

describe('server entrypoint', () => {
  const originalExit = process.exit
  const originalOn = process.on

  beforeEach(() => {
    mock.restore()
  })

  afterEach(() => {
    process.exit = originalExit
    process.on = originalOn
    mock.restore()
  })

  async function loadServerModule(options?: {
    setupError?: Error
    startError?: Error
    toolCount?: number
    resourceCount?: number
  }) {
    const closeMock = mock(async () => {})
    const setupServerMock = mock(() => {
      if (options?.setupError) {
        throw options.setupError
      }

      return {
        server: { close: closeMock },
        toolRegistry: {
          getTools: () => Array.from({ length: options?.toolCount ?? 2 }),
        },
        resourceRegistry: {
          getResources: () => Array.from({ length: options?.resourceCount ?? 1 }),
        },
      }
    })
    const startServerMock = mock(async () => {
      if (options?.startError) {
        throw options.startError
      }
    })
    const configMock = mock(() => ({}))
    const infoMock = mock(() => {})
    const errorMock = mock(() => {})
    const handlers: Record<string, () => Promise<void>> = {}
    const onMock = mock((event: string, handler: () => Promise<void>) => {
      handlers[event] = handler
      return process
    })
    const exitMock = mock((_code?: number) => undefined as never)

    process.on = onMock as typeof process.on
    process.exit = exitMock as typeof process.exit

    mock.module('dotenv', () => ({
      config: configMock,
    }))

    mock.module('../src/logger.js', () => ({
      safeLogger: {
        info: infoMock,
        error: errorMock,
        warn: mock(() => {}),
        debug: mock(() => {}),
      },
    }))

    mock.module('../src/mcp/server-setup.js', () => ({
      setupServer: setupServerMock,
      startServer: startServerMock,
    }))

    await import(`../src/server.ts?case=${Math.random()}`)
    await Promise.resolve()
    await Promise.resolve()

    return {
      closeMock,
      configMock,
      errorMock,
      exitMock,
      handlers,
      infoMock,
      onMock,
      setupServerMock,
      startServerMock,
    }
  }

  test('starts the server and registers shutdown handlers', async () => {
    const loaded = await loadServerModule({ toolCount: 3, resourceCount: 2 })

    expect(loaded.configMock).toHaveBeenCalledTimes(1)
    expect(loaded.setupServerMock).toHaveBeenCalledTimes(1)
    expect(loaded.startServerMock).toHaveBeenCalledTimes(1)
    expect(loaded.onMock).toHaveBeenCalledTimes(2)
    expect(loaded.handlers.SIGINT).toBeDefined()
    expect(loaded.handlers.SIGTERM).toBeDefined()
    expect(loaded.infoMock).toHaveBeenCalledWith('Lodgify MCP server starting...')
    expect(loaded.infoMock).toHaveBeenCalledWith('Tools registered: 3')
    expect(loaded.infoMock).toHaveBeenCalledWith('Resources registered: 2')
    expect(loaded.infoMock).toHaveBeenCalledWith(
      'Lodgify MCP server (refactored) started successfully',
    )

    await loaded.handlers.SIGINT?.()

    expect(loaded.closeMock).toHaveBeenCalledTimes(1)
    expect(loaded.exitMock).toHaveBeenCalledWith(0)
  })

  test('logs startup failures and exits with code 1', async () => {
    const loaded = await loadServerModule({ startError: new Error('boom') })

    expect(loaded.setupServerMock).toHaveBeenCalledTimes(1)
    expect(loaded.startServerMock).toHaveBeenCalledTimes(1)
    expect(loaded.errorMock).toHaveBeenCalledWith('Failed to start server:', expect.any(Error))
    expect(loaded.exitMock).toHaveBeenCalledWith(1)
  })
})
