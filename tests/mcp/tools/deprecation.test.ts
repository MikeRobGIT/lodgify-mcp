/**
 * Tests for Tool Deprecation System
 * Critical user-facing feature that guides users through API migrations
 */

import { afterEach, beforeEach, describe, expect, it, mock, spyOn } from 'bun:test'
import type { McpServer, ToolCallback } from '@modelcontextprotocol/sdk/server/mcp.js'
import { z } from 'zod'
import { safeLogger } from '../../../src/logger'
import {
  DEPRECATED_TOOLS,
  generateDeprecationWarning,
  getDeprecatedTools,
  registerToolWithDeprecation,
} from '../../../src/mcp/tools/deprecation'
import type { DeprecationInfo } from '../../../src/mcp/utils/types'

describe('Tool Deprecation System - Critical User Migration Feature', () => {
  describe('generateDeprecationWarning', () => {
    it('should generate complete deprecation warning with replacement', () => {
      const info: DeprecationInfo = {
        since: '2.0.0',
        removeIn: '3.0.0',
        reason: 'API v1 is being phased out',
        replacement: 'lodgify_create_booking_v2',
      }

      const warning = generateDeprecationWarning('lodgify_create_booking', info)

      expect(warning).toContain('⚠️ **DEPRECATED** (since v2.0.0)')
      expect(warning).toContain('API v1 is being phased out')
      expect(warning).toContain("Please use 'lodgify_create_booking_v2' instead")
      expect(warning).toContain('This tool will be removed in v3.0.0')
    })

    it('should generate warning without replacement tool', () => {
      const info: DeprecationInfo = {
        since: '1.5.0',
        removeIn: '2.0.0',
        reason: 'Feature no longer supported by Lodgify API',
      }

      const warning = generateDeprecationWarning('old_feature', info)

      expect(warning).toContain('⚠️ **DEPRECATED** (since v1.5.0)')
      expect(warning).toContain('Feature no longer supported by Lodgify API')
      expect(warning).not.toContain('Please use')
      expect(warning).toContain('This tool will be removed in v2.0.0')
    })

    it('should generate warning without removal version', () => {
      const info: DeprecationInfo = {
        since: '1.0.0',
        reason: 'Replaced for better performance',
        replacement: 'new_tool',
      }

      const warning = generateDeprecationWarning('old_tool', info)

      expect(warning).toContain('⚠️ **DEPRECATED** (since v1.0.0)')
      expect(warning).toContain('Replaced for better performance')
      expect(warning).toContain("Please use 'new_tool' instead")
      expect(warning).not.toContain('will be removed')
    })

    it('should handle minimal deprecation info', () => {
      const info: DeprecationInfo = {
        since: '0.5.0',
        reason: 'Deprecated',
      }

      const warning = generateDeprecationWarning('minimal_tool', info)

      expect(warning).toBe('⚠️ **DEPRECATED** (since v0.5.0): Deprecated')
    })
  })

  describe('registerToolWithDeprecation', () => {
    let mockServer: McpServer
    let mockHandler: ToolCallback
    let originalDeprecatedTools: Record<string, DeprecationInfo>
    let registerToolSpy: any

    beforeEach(() => {
      // Save original state
      originalDeprecatedTools = { ...DEPRECATED_TOOLS }

      // Create mock for registerTool
      registerToolSpy = mock(() => {})

      // Create mock server
      mockServer = {
        registerTool: registerToolSpy,
      } as unknown as McpServer

      // Create mock handler
      mockHandler = mock(() =>
        Promise.resolve({
          content: [{ type: 'text', text: 'Success' }],
        }),
      ) as unknown as ToolCallback
    })

    afterEach(() => {
      // Restore original state
      Object.keys(DEPRECATED_TOOLS).forEach((key) => delete DEPRECATED_TOOLS[key])
      Object.assign(DEPRECATED_TOOLS, originalDeprecatedTools)
    })

    it('should register non-deprecated tool normally', () => {
      const toolConfig = {
        title: 'Test Tool',
        description: 'A test tool that is not deprecated',
        inputSchema: { test: z.string() },
      }

      registerToolWithDeprecation(mockServer, 'test_tool', toolConfig, mockHandler)

      expect(registerToolSpy).toHaveBeenCalledTimes(1)
      expect(registerToolSpy).toHaveBeenCalledWith('test_tool', toolConfig, mockHandler)
      expect(toolConfig.description).toBe('A test tool that is not deprecated')
    })

    it('should add deprecation warning to deprecated tool description', () => {
      // Add a deprecated tool
      DEPRECATED_TOOLS['old_booking_tool'] = {
        since: '1.0.0',
        removeIn: '2.0.0',
        reason: 'Use v2 API instead',
        replacement: 'new_booking_tool',
      }

      const toolConfig = {
        title: 'Old Booking Tool',
        description: 'Create bookings using old API',
        inputSchema: { bookingId: z.string() },
      }

      registerToolWithDeprecation(mockServer, 'old_booking_tool', toolConfig, mockHandler)

      expect(registerToolSpy).toHaveBeenCalledTimes(1)
      const [, registeredConfig] = registerToolSpy.mock.calls[0] as any

      expect(registeredConfig.description).toContain('⚠️ **DEPRECATED**')
      expect(registeredConfig.description).toContain('Use v2 API instead')
      expect(registeredConfig.description).toContain('new_booking_tool')
      expect(registeredConfig.description).toContain('Create bookings using old API')
    })

    it('should wrap handler to log deprecation warnings', async () => {
      // Spy on logger.warn
      const warnSpy = spyOn(safeLogger, 'warn')

      // Add a deprecated tool
      DEPRECATED_TOOLS['deprecated_rate_tool'] = {
        since: '1.5.0',
        removeIn: '3.0.0',
        reason: 'Performance improvements in new version',
        replacement: 'rate_tool_v2',
        logWarnings: true,
      }

      const toolConfig = {
        title: 'Deprecated Rate Tool',
        description: 'Get rates using old method',
        inputSchema: { propertyId: z.string() },
      }

      registerToolWithDeprecation(mockServer, 'deprecated_rate_tool', toolConfig, mockHandler)

      // Get the wrapped handler
      const [, , wrappedHandler] = registerToolSpy.mock.calls[0] as any

      // Call the wrapped handler
      await wrappedHandler({ propertyId: '123' })

      // Check that deprecation was logged
      expect(warnSpy).toHaveBeenCalledTimes(1)
      expect(warnSpy).toHaveBeenCalledWith("Deprecated tool 'deprecated_rate_tool' used", {
        tool: 'deprecated_rate_tool',
        deprecatedSince: '1.5.0',
        removeIn: '3.0.0',
        replacement: 'rate_tool_v2',
        reason: 'Performance improvements in new version',
      })

      // Check that original handler was called
      expect(mockHandler).toHaveBeenCalledTimes(1)
      expect(mockHandler).toHaveBeenCalledWith({ propertyId: '123' })

      // Restore the spy
      warnSpy.mockRestore()
    })

    it('should not log warnings when logWarnings is false', async () => {
      // Spy on logger.warn with a fresh spy
      const warnSpy = spyOn(safeLogger, 'warn')
      warnSpy.mockClear() // Clear any previous calls

      // Add a deprecated tool with logging disabled
      DEPRECATED_TOOLS['quiet_deprecated_tool'] = {
        since: '1.0.0',
        reason: 'Silent deprecation',
        logWarnings: false,
      }

      const toolConfig = {
        title: 'Quiet Tool',
        description: 'Tool with silent deprecation',
        inputSchema: {},
      }

      registerToolWithDeprecation(mockServer, 'quiet_deprecated_tool', toolConfig, mockHandler)

      // Get and call the wrapped handler
      const [, , wrappedHandler] = registerToolSpy.mock.calls[0] as any
      await wrappedHandler({})

      // Check that no warning was logged
      expect(warnSpy).not.toHaveBeenCalled()

      // But original handler should still be called
      expect(mockHandler).toHaveBeenCalledTimes(1)
      expect(mockHandler).toHaveBeenCalledWith({})

      // Restore the spy
      warnSpy.mockRestore()
    })
  })

  describe('getDeprecatedTools', () => {
    let originalDeprecatedTools: Record<string, DeprecationInfo>

    beforeEach(() => {
      originalDeprecatedTools = { ...DEPRECATED_TOOLS }
      Object.keys(DEPRECATED_TOOLS).forEach((key) => delete DEPRECATED_TOOLS[key])
    })

    afterEach(() => {
      Object.keys(DEPRECATED_TOOLS).forEach((key) => delete DEPRECATED_TOOLS[key])
      Object.assign(DEPRECATED_TOOLS, originalDeprecatedTools)
    })

    it('should return empty array when no tools are deprecated', () => {
      const tools = getDeprecatedTools()
      expect(tools).toEqual([])
    })

    it('should return all deprecated tools with full details', () => {
      // Add multiple deprecated tools
      DEPRECATED_TOOLS['tool_a'] = {
        since: '1.0.0',
        removeIn: '2.0.0',
        reason: 'Replaced by tool_b',
        replacement: 'tool_b',
      }

      DEPRECATED_TOOLS['tool_c'] = {
        since: '1.5.0',
        reason: 'No longer needed',
      }

      const tools = getDeprecatedTools()

      expect(tools).toHaveLength(2)

      expect(tools[0]).toEqual({
        tool: 'tool_a',
        deprecatedSince: '1.0.0',
        removeIn: '2.0.0',
        reason: 'Replaced by tool_b',
        replacement: 'tool_b',
        warning: expect.stringContaining('⚠️ **DEPRECATED**'),
      })

      expect(tools[1]).toEqual({
        tool: 'tool_c',
        deprecatedSince: '1.5.0',
        removeIn: 'TBD',
        reason: 'No longer needed',
        replacement: undefined,
        warning: expect.stringContaining('⚠️ **DEPRECATED**'),
      })
    })

    it('should provide TBD for missing removeIn version', () => {
      DEPRECATED_TOOLS['indefinite_tool'] = {
        since: '0.5.0',
        reason: 'May be removed in future',
      }

      const tools = getDeprecatedTools()

      expect(tools[0].removeIn).toBe('TBD')
    })
  })

  describe('Real-world Deprecation Scenarios', () => {
    let originalDeprecatedTools: Record<string, DeprecationInfo>

    beforeEach(() => {
      originalDeprecatedTools = { ...DEPRECATED_TOOLS }
    })

    afterEach(() => {
      Object.keys(DEPRECATED_TOOLS).forEach((key) => delete DEPRECATED_TOOLS[key])
      Object.assign(DEPRECATED_TOOLS, originalDeprecatedTools)
    })

    it('should handle API version migration scenario', () => {
      // Simulate deprecating v1 booking tools in favor of v2
      DEPRECATED_TOOLS['lodgify_create_booking_v1'] = {
        since: '2.0.0',
        removeIn: '3.0.0',
        reason: 'Lodgify API v1 is being sunset. V2 provides better performance and more features',
        replacement: 'lodgify_create_booking',
      }

      const warning = generateDeprecationWarning(
        'lodgify_create_booking_v1',
        DEPRECATED_TOOLS['lodgify_create_booking_v1'],
      )

      expect(warning).toContain('Lodgify API v1 is being sunset')
      expect(warning).toContain('lodgify_create_booking')
      expect(warning).toContain('3.0.0')
    })

    it('should handle removed feature scenario', () => {
      // Simulate a feature that Lodgify no longer supports
      DEPRECATED_TOOLS['lodgify_bulk_import'] = {
        since: '1.8.0',
        removeIn: '2.0.0',
        reason:
          'Lodgify has removed bulk import from their API. Use individual create operations instead',
      }

      const tools = getDeprecatedTools()
      const bulkImportTool = tools.find((t) => t.tool === 'lodgify_bulk_import')

      expect(bulkImportTool?.warning).toContain('removed bulk import')
      expect(bulkImportTool?.replacement).toBeUndefined()
    })

    it('should handle renamed tool scenario', () => {
      // Simulate a tool that was renamed for clarity
      DEPRECATED_TOOLS['get_bookings'] = {
        since: '1.2.0',
        removeIn: '2.0.0',
        reason: 'Renamed for consistency with other tools',
        replacement: 'lodgify_list_bookings',
      }

      const warning = generateDeprecationWarning('get_bookings', DEPRECATED_TOOLS['get_bookings'])

      expect(warning).toContain('Renamed for consistency')
      expect(warning).toContain('lodgify_list_bookings')
    })
  })
})
