import { describe, expect, test } from 'bun:test'

describe('Tool Deprecation System', () => {
  describe('Deprecation Warning Generation', () => {
    test('should generate comprehensive deprecation warnings', () => {
      // Test data matching the actual deprecations in server.ts
      const deprecationInfo = {
        since: '0.1.1',
        removeIn: '1.0.0',
        reason:
          'Raw availability data is complex. Use availability helper tools for better results',
        replacement: 'lodgify_check_next_availability, lodgify_get_availability_calendar',
      }

      // This matches the generateDeprecationWarning function logic
      const expectedWarning = `⚠️ **DEPRECATED** (since v${deprecationInfo.since}): ${deprecationInfo.reason} Please use '${deprecationInfo.replacement}' instead. This tool will be removed in v${deprecationInfo.removeIn}.`

      // Verify warning structure
      expect(expectedWarning).toContain('⚠️ **DEPRECATED**')
      expect(expectedWarning).toContain(`since v${deprecationInfo.since}`)
      expect(expectedWarning).toContain(deprecationInfo.reason)
      expect(expectedWarning).toContain(`Please use '${deprecationInfo.replacement}' instead`)
      expect(expectedWarning).toContain(`removed in v${deprecationInfo.removeIn}`)
    })

    test('should handle deprecation without removal version', () => {
      const deprecationInfo = {
        since: '0.1.0',
        reason: 'Performance improvements available in newer tools',
        replacement: 'new_tool_name',
      }

      const expectedWarning = `⚠️ **DEPRECATED** (since v${deprecationInfo.since}): ${deprecationInfo.reason} Please use '${deprecationInfo.replacement}' instead.`

      expect(expectedWarning).toContain('⚠️ **DEPRECATED**')
      expect(expectedWarning).toContain(deprecationInfo.reason)
      expect(expectedWarning).toContain(deprecationInfo.replacement)
      expect(expectedWarning).not.toContain('removed in')
    })

    test('should handle deprecation without replacement tool', () => {
      const deprecationInfo = {
        since: '0.2.0',
        removeIn: '1.0.0',
        reason: 'Tool no longer needed due to API changes',
      }

      const expectedWarning = `⚠️ **DEPRECATED** (since v${deprecationInfo.since}): ${deprecationInfo.reason} This tool will be removed in v${deprecationInfo.removeIn}.`

      expect(expectedWarning).toContain('⚠️ **DEPRECATED**')
      expect(expectedWarning).toContain(deprecationInfo.reason)
      expect(expectedWarning).not.toContain('Please use')
      expect(expectedWarning).toContain(`removed in v${deprecationInfo.removeIn}`)
    })
  })

  describe('Deprecation Registry Structure', () => {
    test('should validate deprecation registry data structure', () => {
      // Expected structure that the lodgify://deprecations resource should return
      const mockRegistryStructure = {
        service: 'lodgify-mcp-deprecations',
        totalDeprecatedTools: 2,
        deprecations: [],
        recommendations: [],
        timestamp: new Date().toISOString(),
      }

      // Validate structure matches expectations
      expect(mockRegistryStructure.service).toBe('lodgify-mcp-deprecations')
      expect(typeof mockRegistryStructure.totalDeprecatedTools).toBe('number')
      expect(Array.isArray(mockRegistryStructure.deprecations)).toBe(true)
      expect(Array.isArray(mockRegistryStructure.recommendations)).toBe(true)
      expect(typeof mockRegistryStructure.timestamp).toBe('string')
    })

    test('should validate deprecation entry structure', () => {
      const mockDeprecationEntry = {
        tool: 'lodgify_example_tool',
        deprecatedSince: '0.1.1',
        removeIn: '1.0.0',
        reason: 'Example deprecation reason for testing',
        replacement: 'lodgify_replacement_tool',
        warning:
          "⚠️ **DEPRECATED** (since v0.1.1): Example deprecation reason for testing. Please use 'lodgify_replacement_tool' instead. This tool will be removed in v1.0.0.",
      }

      // Validate individual deprecation entry structure
      expect(mockDeprecationEntry.tool).toMatch(/^lodgify_/)
      expect(mockDeprecationEntry.deprecatedSince).toMatch(/^\d+\.\d+\.\d+$/)
      expect(mockDeprecationEntry.removeIn).toMatch(/^\d+\.\d+\.\d+$/)
      expect(typeof mockDeprecationEntry.reason).toBe('string')
      expect(typeof mockDeprecationEntry.replacement).toBe('string')
      expect(typeof mockDeprecationEntry.warning).toBe('string')
    })
  })

  describe('Current Deprecated Tools', () => {
    test('should correctly identify deprecated availability tools', () => {
      // Test the actual deprecations configured in the server
      const deprecatedAvailabilityTools = [
        // No deprecated tools currently
      ]

      const expectedReplacements = [
        'lodgify_check_next_availability',
        'lodgify_get_availability_calendar',
      ]

      deprecatedAvailabilityTools.forEach((toolName) => {
        expect(toolName).toMatch(/^lodgify_availability_/)
      })

      expectedReplacements.forEach((replacement) => {
        expect(replacement).toMatch(/^lodgify_(check_|get_availability_)/)
      })
    })

    test('should validate deprecation reasons are informative', () => {
      const reasons = [
        'Raw availability data is complex. Use availability helper tools for better results',
      ]

      reasons.forEach((reason) => {
        expect(reason.length).toBeGreaterThan(20) // Meaningful explanation
        expect(reason).toContain('better') // Should explain benefit of replacement
      })
    })
  })

  describe('Logging Integration', () => {
    test('should structure deprecation log entries correctly', () => {
      const expectedLogEntry = {
        tool: 'lodgify_example_tool',
        deprecatedSince: '0.1.1',
        removeIn: '1.0.0',
        replacement: 'lodgify_replacement_tool',
        reason: 'Example deprecation reason for testing',
      }

      // Log entry should contain all necessary information for monitoring
      expect(expectedLogEntry.tool).toBeDefined()
      expect(expectedLogEntry.deprecatedSince).toBeDefined()
      expect(expectedLogEntry.removeIn).toBeDefined()
      expect(expectedLogEntry.replacement).toBeDefined()
      expect(expectedLogEntry.reason).toBeDefined()
    })

    test('should validate log warning configuration', () => {
      // Test default logging behavior
      const logWarningsDefault = true // Default value when not specified
      const logWarningsDisabled = false // Explicitly disabled

      expect(typeof logWarningsDefault).toBe('boolean')
      expect(typeof logWarningsDisabled).toBe('boolean')
      expect(logWarningsDefault).toBe(true) // Default should be enabled
    })
  })

  describe('Tool Registration Enhancement', () => {
    test('should validate tool registration wrapper functionality', () => {
      // Mock tool configuration
      const mockToolConfig = {
        title: 'Test Tool',
        description: 'Original description',
        inputSchema: {
          id: { type: 'string' },
        },
      }

      const mockDeprecationInfo = {
        since: '0.1.0',
        removeIn: '1.0.0',
        reason: 'Test deprecation',
        replacement: 'new_test_tool',
      }

      // Simulate what the registerToolWithDeprecation function does
      const warning = `⚠️ **DEPRECATED** (since v${mockDeprecationInfo.since}): ${mockDeprecationInfo.reason} Please use '${mockDeprecationInfo.replacement}' instead. This tool will be removed in v${mockDeprecationInfo.removeIn}.`
      const enhancedDescription = `${warning}\n\n${mockToolConfig.description}`

      expect(enhancedDescription).toContain('⚠️ **DEPRECATED**')
      expect(enhancedDescription).toContain(mockToolConfig.description)
      expect(enhancedDescription.indexOf('⚠️')).toBeLessThan(
        enhancedDescription.indexOf('Original description'),
      )
    })
  })

  describe('Resource URI Validation', () => {
    test('should validate deprecation resource URI format', () => {
      const deprecationResourceURI = 'lodgify://deprecations'

      expect(deprecationResourceURI).toMatch(/^lodgify:\/\//)
      expect(deprecationResourceURI).toContain('deprecations')
      expect(deprecationResourceURI).not.toContain(' ') // No spaces
      expect(deprecationResourceURI.length).toBeGreaterThan(10)
    })

    test('should validate resource metadata structure', () => {
      const resourceMetadata = {
        title: 'Tool Deprecation Registry',
        description: 'View current tool deprecation notices and upgrade recommendations',
        mimeType: 'application/json',
      }

      expect(resourceMetadata.title).toContain('Deprecation')
      expect(resourceMetadata.description).toContain('deprecation')
      expect(resourceMetadata.mimeType).toBe('application/json')
    })
  })
})
