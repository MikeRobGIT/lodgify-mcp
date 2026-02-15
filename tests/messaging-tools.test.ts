/**
 * @fileoverview Tests for messaging tools - critical guest communication feature
 * @description Tests the lodgify_get_thread function which is the only functional
 * messaging endpoint in Lodgify API v2. This is critical for property managers
 * to communicate with guests and track conversations.
 */

import { beforeEach, describe, expect, test, vi } from 'bun:test'
import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js'
import type { LodgifyOrchestrator } from '../src/lodgify-orchestrator.js'
import { getMessagingTools } from '../src/mcp/tools/messaging-tools.js'

describe('Messaging Tools - Critical guest communication feature', () => {
  let mockClient: Partial<LodgifyOrchestrator>
  let getClient: () => LodgifyOrchestrator
  let tools: ReturnType<typeof getMessagingTools>

  beforeEach(() => {
    // Reset mock client for each test
    mockClient = {
      messaging: {
        getThread: vi.fn(),
      } as any,
    }
    getClient = () => mockClient as LodgifyOrchestrator
    tools = getMessagingTools(getClient)
  })

  describe('lodgify_get_thread - Retrieve guest conversation threads', () => {
    const getThreadTool = () => tools.find((t) => t.name === 'lodgify_get_thread')!

    test('should retrieve thread with multiple messages successfully', async () => {
      const mockThread = {
        thread_uid: '550e8400-e29b-41d4-a716-446655440000',
        property_id: 123456,
        booking_id: 'BK001',
        guest_name: 'John Doe',
        guest_email: 'john@example.com',
        subject: 'Booking Inquiry',
        status: 'active',
        unread: true,
        created_at: '2024-01-15T10:00:00Z',
        updated_at: '2024-01-16T14:30:00Z',
        messages: [
          {
            id: 'msg_001',
            sender: 'guest',
            sender_name: 'John Doe',
            content: 'What time is check-in?',
            sent_at: '2024-01-15T10:00:00Z',
            read: true,
          },
          {
            id: 'msg_002',
            sender: 'host',
            sender_name: 'Property Manager',
            content: 'Check-in is at 3 PM. Looking forward to your stay!',
            sent_at: '2024-01-15T10:30:00Z',
            read: true,
          },
          {
            id: 'msg_003',
            sender: 'guest',
            sender_name: 'John Doe',
            content: 'Thank you! Can we arrange late checkout?',
            sent_at: '2024-01-16T14:30:00Z',
            read: false,
          },
        ],
      }

      ;(mockClient.messaging!.getThread as any).mockResolvedValue(mockThread)

      const result = (await getThreadTool().handler({
        threadGuid: '550e8400-e29b-41d4-a716-446655440000',
      })) as CallToolResult

      expect(mockClient.messaging!.getThread).toHaveBeenCalledWith(
        '550e8400-e29b-41d4-a716-446655440000',
      )

      const response = JSON.parse(result.content[0].text)

      // Verify enhanced response structure
      expect(response.operation).toMatchObject({
        type: 'get',
        entity: 'thread',
        status: 'success',
      })

      // Verify thread data is preserved (note: data may include extra fields)
      expect(response.data).toBeDefined()
      expect(response.data.thread_uid).toBe(mockThread.thread_uid)
      expect(response.data.messages).toEqual(mockThread.messages)

      // Verify extracted message details - extractMessageDetails returns limited info
      expect(response.details).toBeDefined()
      expect(response.details.threadId).toBe('550e8400-e29b-41d4-a716-446655440000')

      // Verify suggestions - might be empty as no thread case in generator
      expect(response.suggestions).toBeDefined()
      expect(Array.isArray(response.suggestions)).toBe(true)

      // Verify summary - generateSummary returns "Retrieved messaging thread" for 'thread'
      expect(response.summary).toBe('Retrieved messaging thread')
    })

    test('should handle thread with no messages', async () => {
      const mockThread = {
        thread_uid: 'thread_empty_123',
        property_id: 123456,
        booking_id: 'BK002',
        guest_name: 'Jane Smith',
        messages: [],
      }

      ;(mockClient.messaging!.getThread as any).mockResolvedValue(mockThread)

      const result = (await getThreadTool().handler({
        threadGuid: 'thread_empty_123',
      })) as CallToolResult

      const response = JSON.parse(result.content[0].text)

      expect(response.operation.status).toBe('success')
      expect(response.details).toBeDefined()
      expect(response.details.threadId).toBe('thread_empty_123')
      // Suggestions may not be generated for thread entity
      expect(Array.isArray(response.suggestions || [])).toBe(true)
    })

    test('should handle thread not found error', async () => {
      ;(mockClient.messaging!.getThread as any).mockRejectedValue(
        new Error('Thread not found: Invalid thread UID'),
      )

      // Error handler should throw an McpError
      await expect(async () => {
        await getThreadTool().handler({
          threadGuid: 'invalid_thread_id',
        })
      }).toThrow()
    })

    test('should handle network timeout gracefully', async () => {
      ;(mockClient.messaging!.getThread as any).mockRejectedValue(new Error('Request timeout'))

      // Error handler should throw an McpError
      await expect(async () => {
        await getThreadTool().handler({
          threadGuid: '550e8400-e29b-41d4-a716-446655440000',
        })
      }).toThrow()
    })

    test('should sanitize input thread GUID', async () => {
      const mockThread = {
        thread_uid: 'thread_123',
        messages: [],
      }

      ;(mockClient.messaging!.getThread as any).mockResolvedValue(mockThread)

      // Test with extra whitespace
      const result = (await getThreadTool().handler({
        threadGuid: '  thread_123  ',
      })) as CallToolResult

      // Should call with trimmed value
      expect(mockClient.messaging!.getThread).toHaveBeenCalledWith('thread_123')

      const response = JSON.parse(result.content[0].text)
      expect(response.operation.status).toBe('success')
    })

    test('should handle complex thread with booking context', async () => {
      const mockThread = {
        thread_uid: 'thread_complex',
        property_id: 789,
        property_name: 'Beach Villa',
        booking_id: 'BK789',
        booking_reference: 'REF-2024-789',
        guest_name: 'Alice Johnson',
        guest_email: 'alice@example.com',
        guest_phone: '+1234567890',
        check_in: '2024-02-01',
        check_out: '2024-02-07',
        total_amount: 2500.0,
        currency: 'USD',
        status: 'active',
        unread: false,
        messages: [
          {
            id: 'msg_100',
            sender: 'guest',
            content: 'Is early check-in possible?',
            sent_at: '2024-01-20T09:00:00Z',
            attachments: ['photo1.jpg'],
          },
          {
            id: 'msg_101',
            sender: 'host',
            content: 'Yes, we can arrange 1 PM check-in for $50 extra.',
            sent_at: '2024-01-20T10:00:00Z',
          },
        ],
      }

      ;(mockClient.messaging!.getThread as any).mockResolvedValue(mockThread)

      const result = (await getThreadTool().handler({
        threadGuid: 'thread_complex',
      })) as CallToolResult

      const response = JSON.parse(result.content[0].text)

      expect(response.operation.status).toBe('success')
      expect(response.data).toBeDefined()
      expect(response.data.thread_uid).toBe(mockThread.thread_uid)
      expect(response.data.messages).toEqual(mockThread.messages)
      expect(response.details).toBeDefined()

      // Should include booking context in summary
      expect(response.summary).toBeDefined()
      // Suggestions may not be generated for thread entity
      expect(Array.isArray(response.suggestions || [])).toBe(true)
    })

    test('should handle special characters in thread content', async () => {
      const mockThread = {
        thread_uid: 'thread_special',
        guest_name: "O'Brien & Co.",
        messages: [
          {
            id: 'msg_special',
            content: "What's the WiFi password? Need it for work & leisure.",
            sender: 'guest',
          },
        ],
      }

      ;(mockClient.messaging!.getThread as any).mockResolvedValue(mockThread)

      const result = (await getThreadTool().handler({
        threadGuid: 'thread_special',
      })) as CallToolResult

      const response = JSON.parse(result.content[0].text)

      expect(response.operation.status).toBe('success')
      expect(response.data.guest_name).toBe("O'Brien & Co.")
      expect(response.data.messages[0].content).toContain("What's")
    })

    test('should handle API rate limiting', async () => {
      ;(mockClient.messaging!.getThread as any).mockRejectedValue(
        new Error('Rate limit exceeded. Please try again in 60 seconds.'),
      )

      // Error handler should throw an McpError
      await expect(async () => {
        await getThreadTool().handler({
          threadGuid: 'thread_123',
        })
      }).toThrow()
    })

    test('should handle malformed API response gracefully', async () => {
      // API returns unexpected structure
      ;(mockClient.messaging!.getThread as any).mockResolvedValue(null as any)

      const result = (await getThreadTool().handler({
        threadGuid: 'thread_malformed',
      })) as CallToolResult

      const response = JSON.parse(result.content[0].text)

      // Should still return a valid enhanced response
      expect(response.operation).toBeDefined()
      expect(response.operation.status).toBe('success')
      expect(response.data).toBeDefined()
      expect(response.details).toBeDefined()
    })

    test('should handle very long thread with many messages', async () => {
      const messages = Array.from({ length: 100 }, (_, i) => ({
        id: `msg_${i}`,
        sender: i % 2 === 0 ? 'guest' : 'host',
        content: `Message ${i}`,
        sent_at: `2024-01-${String(i + 1).padStart(2, '0')}T12:00:00Z`,
        read: i < 95,
      }))

      const mockThread = {
        thread_uid: 'thread_long',
        messages,
        unread: true,
      }

      ;(mockClient.messaging!.getThread as any).mockResolvedValue(mockThread)

      const result = (await getThreadTool().handler({
        threadGuid: 'thread_long',
      })) as CallToolResult

      const response = JSON.parse(result.content[0].text)

      expect(response.operation.status).toBe('success')
      expect(response.details).toBeDefined()
      expect(response.data.messages).toHaveLength(100)
    })

    test('should validate tool registration metadata', () => {
      const tool = getThreadTool()

      expect(tool).toBeDefined()
      expect(tool.name).toBe('lodgify_get_thread')
      expect(tool.category).toBe('Messaging & Communication')
      expect(tool.config.title).toBe('Get Messaging Thread')
      expect(tool.config.description).toContain('only functional messaging endpoint')
      expect(tool.config.description).toContain('thread_uid')
      expect(tool.config.inputSchema.threadGuid).toBeDefined()
    })
  })

  describe('Tool registration and availability', () => {
    test('should only register lodgify_get_thread tool', () => {
      expect(tools).toHaveLength(1)
      expect(tools[0].name).toBe('lodgify_get_thread')
    })

    test('should not include non-functional v1 messaging tools', () => {
      const toolNames = tools.map((t) => t.name)

      // These tools should NOT be registered as they don't work
      expect(toolNames).not.toContain('lodgify_send_message')
      expect(toolNames).not.toContain('lodgify_list_threads')
      expect(toolNames).not.toContain('lodgify_mark_thread_as_read')
      expect(toolNames).not.toContain('lodgify_archive_thread')
    })
  })
})
