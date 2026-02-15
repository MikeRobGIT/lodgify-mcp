/**
 * @fileoverview Tests for lodgify_get_thread messaging tool - critical guest communication feature
 * @description Validates thread retrieval functionality that property managers depend on daily
 * @author Lodgify MCP Server Test Suite
 * @since Test Coverage Session 21
 */

import { beforeEach, describe, expect, mock, test } from 'bun:test'
import { createTestServer } from '../test-server.js'

describe('lodgify_get_thread - Critical User-Facing Guest Communication Feature', () => {
  let testServer: any
  let mockClient: any

  beforeEach(() => {
    // Create a mock client with messaging methods
    mockClient = {
      // Other required methods for test server
      listProperties: mock(() => Promise.resolve()),
      getProperty: mock(() => Promise.resolve()),
      listPropertyRooms: mock(() => Promise.resolve()),
      listDeletedProperties: mock(() => Promise.resolve()),
      getDailyRates: mock(() => Promise.resolve()),
      getRateSettings: mock(() => Promise.resolve()),
      listBookings: mock(() => Promise.resolve()),
      getBooking: mock(() => Promise.resolve()),
      getBookingPaymentLink: mock(() => Promise.resolve()),
      createBookingPaymentLink: mock(() => Promise.resolve()),
      updateKeyCodes: mock(() => Promise.resolve()),
      checkinBooking: mock(() => Promise.resolve()),
      checkoutBooking: mock(() => Promise.resolve()),
      getExternalBookings: mock(() => Promise.resolve()),
      getQuote: mock(() => Promise.resolve()),
      getThread: mock(() => Promise.resolve()), // The main method we're testing
      listWebhooks: mock(() => Promise.resolve()),
      subscribeWebhook: mock(() => Promise.resolve()),
      unsubscribeWebhook: mock(() => Promise.resolve()),
      createBooking: mock(() => Promise.resolve()),
      updateBooking: mock(() => Promise.resolve()),
      deleteBooking: mock(() => Promise.resolve()),
      updateRates: mock(() => Promise.resolve()),
    }

    // Create test server with the mock client
    testServer = createTestServer(mockClient)
  })

  describe('Tool Registration', () => {
    test('should register the get_thread tool correctly', async () => {
      const response = await testServer.listTools()
      const toolNames = response.tools.map((t: { name: string }) => t.name)

      expect(toolNames).toContain('lodgify_get_thread')

      const getThreadTool = response.tools.find(
        (t: { name: string }) => t.name === 'lodgify_get_thread',
      )
      expect(getThreadTool).toBeDefined()
      expect(getThreadTool.description).toContain('messaging thread')
    })
  })

  describe('Thread Retrieval - Critical for Guest Communication', () => {
    test('should retrieve thread with multiple messages for guest support', async () => {
      // Mock a thread with guest conversation history
      const mockThread = {
        thread_uid: '550e8400-e29b-41d4-a716-446655440000',
        booking_id: 'BK12345',
        property_name: 'Sunset Villa',
        guest_name: 'John Doe',
        unread: true,
        last_message_date: '2024-03-15T10:30:00Z',
        messages: [
          {
            id: 'msg_001',
            sender: 'guest',
            sender_name: 'John Doe',
            message: 'What is the WiFi password?',
            timestamp: '2024-03-14T15:00:00Z',
            read: true,
          },
          {
            id: 'msg_002',
            sender: 'host',
            sender_name: 'Property Manager',
            message: 'The WiFi password is SunsetVilla2024. Let me know if you need anything else!',
            timestamp: '2024-03-14T15:30:00Z',
            read: true,
          },
          {
            id: 'msg_003',
            sender: 'guest',
            sender_name: 'John Doe',
            message: 'Thank you! Also, is early check-in possible?',
            timestamp: '2024-03-15T10:30:00Z',
            read: false,
          },
        ],
        participants: [
          { type: 'guest', name: 'John Doe', email: 'john@example.com' },
          { type: 'host', name: 'Property Manager', email: 'manager@property.com' },
        ],
      }

      mockClient.getThread.mockResolvedValue(mockThread)

      const response = await testServer.callTool('lodgify_get_thread', {
        threadGuid: '550e8400-e29b-41d4-a716-446655440000',
      })

      expect(mockClient.getThread).toHaveBeenCalledWith('550e8400-e29b-41d4-a716-446655440000')

      const result = JSON.parse(response.content[0].text)

      // Verify the thread data is preserved
      expect(result).toEqual(mockThread)

      // Check critical fields
      expect(result.thread_uid).toBe('550e8400-e29b-41d4-a716-446655440000')
      expect(result.messages).toBeInstanceOf(Array)
      expect(result.messages.length).toBe(3)
      expect(result.unread).toBe(true)
    })

    test('should handle thread with no messages (new conversation)', async () => {
      const mockEmptyThread = {
        thread_uid: 'empty-thread-123',
        booking_id: 'BK99999',
        property_name: 'Beach House',
        guest_name: 'Jane Smith',
        unread: false,
        messages: [],
        participants: [
          { type: 'guest', name: 'Jane Smith', email: 'jane@example.com' },
          { type: 'host', name: 'Property Manager', email: 'manager@property.com' },
        ],
      }

      mockClient.getThread.mockResolvedValue(mockEmptyThread)

      const response = await testServer.callTool('lodgify_get_thread', {
        threadGuid: 'empty-thread-123',
      })

      const result = JSON.parse(response.content[0].text)

      expect(result.thread_uid).toBe('empty-thread-123')
      expect(result.messages).toEqual([])
    })

    test('should handle thread with unread messages requiring urgent attention', async () => {
      const mockUrgentThread = {
        thread_uid: 'urgent-thread-456',
        booking_id: 'BK77777',
        property_name: 'Mountain Lodge',
        guest_name: 'Emergency Guest',
        unread: true,
        unread_count: 5,
        last_message_date: '2024-03-15T22:45:00Z',
        messages: [
          {
            id: 'urgent_msg_001',
            sender: 'guest',
            sender_name: 'Emergency Guest',
            message: 'URGENT: The heating system is not working!',
            timestamp: '2024-03-15T22:45:00Z',
            read: false,
            priority: 'high',
          },
        ],
        participants: [
          { type: 'guest', name: 'Emergency Guest', email: 'urgent@example.com' },
          { type: 'host', name: 'Property Manager', email: 'manager@property.com' },
        ],
      }

      mockClient.getThread.mockResolvedValue(mockUrgentThread)

      const response = await testServer.callTool('lodgify_get_thread', {
        threadGuid: 'urgent-thread-456',
      })

      const result = JSON.parse(response.content[0].text)

      expect(result.unread).toBe(true)
      expect(result.unread_count).toBe(5)
      expect(result.messages[0].priority).toBe('high')
    })

    test('should handle complex thread with attachments and system messages', async () => {
      const mockComplexThread = {
        thread_uid: 'complex-thread-789',
        booking_id: 'BK55555',
        messages: [
          {
            id: 'msg_sys_001',
            sender: 'system',
            message: 'Booking confirmed',
            timestamp: '2024-03-10T10:00:00Z',
            type: 'system',
          },
          {
            id: 'msg_att_001',
            sender: 'guest',
            sender_name: 'Photo Guest',
            message: 'Here is my ID for verification',
            timestamp: '2024-03-11T14:00:00Z',
            attachments: [{ type: 'image', url: 'https://example.com/id.jpg', name: 'id.jpg' }],
          },
        ],
      }

      mockClient.getThread.mockResolvedValue(mockComplexThread)

      const response = await testServer.callTool('lodgify_get_thread', {
        threadGuid: 'complex-thread-789',
      })

      const result = JSON.parse(response.content[0].text)

      expect(result.messages).toHaveLength(2)
      expect(result.messages[1].attachments).toBeDefined()
      expect(result.messages[1].attachments[0].type).toBe('image')
    })
  })

  describe('Error Handling - Maintaining Guest Communication Reliability', () => {
    test('should handle thread not found error gracefully', async () => {
      mockClient.getThread.mockRejectedValue(new Error('Thread not found'))

      const response = await testServer.callTool('lodgify_get_thread', {
        threadGuid: 'non-existent-thread',
      })

      expect(response.isError).toBe(true)
      const result = JSON.parse(response.content[0].text)
      expect(result.error).toBe(true)
      expect(result.message).toContain('Thread not found')
    })

    test('should handle network timeout when retrieving critical messages', async () => {
      mockClient.getThread.mockRejectedValue(new Error('Network timeout'))

      const response = await testServer.callTool('lodgify_get_thread', {
        threadGuid: 'timeout-thread-123',
      })

      expect(response.isError).toBe(true)
      const result = JSON.parse(response.content[0].text)
      expect(result.error).toBe(true)
      expect(result.message).toContain('Network timeout')
    })

    test('should handle unauthorized access to thread', async () => {
      mockClient.getThread.mockRejectedValue(new Error('401 Unauthorized'))

      const response = await testServer.callTool('lodgify_get_thread', {
        threadGuid: 'private-thread-456',
      })

      expect(response.isError).toBe(true)
      const result = JSON.parse(response.content[0].text)
      expect(result.error).toBe(true)
      expect(result.message).toContain('401')
    })

    test('should handle empty thread GUID', async () => {
      const response = await testServer.callTool('lodgify_get_thread', {
        threadGuid: '',
      })

      // The test server will still call getThread with empty string
      // The validation would happen in the actual MCP tool handler
      expect(mockClient.getThread).toHaveBeenCalledWith('')
    })
  })

  describe('Edge Cases - Ensuring Robust Guest Communication', () => {
    test('should handle thread with very long conversation history', async () => {
      const messages = Array.from({ length: 100 }, (_, i) => ({
        id: `msg_${i}`,
        sender: i % 2 === 0 ? 'guest' : 'host',
        message: `Message ${i}`,
        timestamp: new Date(Date.now() - i * 3600000).toISOString(),
      }))

      const mockLongThread = {
        thread_uid: 'long-thread-999',
        messages,
        pagination: {
          total: 100,
          page: 1,
          per_page: 100,
        },
      }

      mockClient.getThread.mockResolvedValue(mockLongThread)

      const response = await testServer.callTool('lodgify_get_thread', {
        threadGuid: 'long-thread-999',
      })

      const result = JSON.parse(response.content[0].text)

      expect(result.messages).toHaveLength(100)
      expect(result.pagination.total).toBe(100)
    })

    test('should handle thread with special characters in messages', async () => {
      const mockSpecialThread = {
        thread_uid: 'special-thread-111',
        messages: [
          {
            id: 'special_msg_001',
            sender: 'guest',
            message: 'Hello! 🏖️ When can we check in? ¿Habla español?',
            timestamp: '2024-03-15T10:00:00Z',
          },
        ],
      }

      mockClient.getThread.mockResolvedValue(mockSpecialThread)

      const response = await testServer.callTool('lodgify_get_thread', {
        threadGuid: 'special-thread-111',
      })

      const result = JSON.parse(response.content[0].text)

      expect(result.messages[0].message).toContain('🏖️')
      expect(result.messages[0].message).toContain('¿')
    })

    test('should handle minimal thread response', async () => {
      const mockMinimalThread = {
        thread_uid: 'minimal-thread-222',
        // Minimal response with just the thread ID
      }

      mockClient.getThread.mockResolvedValue(mockMinimalThread)

      const response = await testServer.callTool('lodgify_get_thread', {
        threadGuid: 'minimal-thread-222',
      })

      const result = JSON.parse(response.content[0].text)

      expect(result.thread_uid).toBe('minimal-thread-222')
    })

    test('should handle thread with alternative ID format', async () => {
      // The messaging client accepts both UUID and custom formats like "thread_123"
      const mockCustomThread = {
        thread_uid: 'thread_123',
        booking_id: 'BK98765',
        messages: [],
      }

      mockClient.getThread.mockResolvedValue(mockCustomThread)

      const response = await testServer.callTool('lodgify_get_thread', {
        threadGuid: 'thread_123',
      })

      const result = JSON.parse(response.content[0].text)

      expect(result.thread_uid).toBe('thread_123')
    })
  })

  describe('Business-Critical Scenarios', () => {
    test('should handle guest complaint thread requiring immediate attention', async () => {
      const mockComplaintThread = {
        thread_uid: 'complaint-thread-333',
        booking_id: 'BK11111',
        property_name: 'City Apartment',
        guest_name: 'Unhappy Guest',
        priority: 'high',
        sentiment: 'negative',
        messages: [
          {
            id: 'complaint_001',
            sender: 'guest',
            sender_name: 'Unhappy Guest',
            message: 'The apartment was not clean when we arrived. Very disappointed!',
            timestamp: '2024-03-15T16:00:00Z',
            sentiment: 'negative',
            tags: ['complaint', 'cleanliness'],
          },
        ],
      }

      mockClient.getThread.mockResolvedValue(mockComplaintThread)

      const response = await testServer.callTool('lodgify_get_thread', {
        threadGuid: 'complaint-thread-333',
      })

      const result = JSON.parse(response.content[0].text)

      expect(result.priority).toBe('high')
      expect(result.sentiment).toBe('negative')
      expect(result.messages[0].tags).toContain('complaint')
    })

    test('should handle pre-arrival questions thread', async () => {
      const mockPreArrivalThread = {
        thread_uid: 'pre-arrival-444',
        booking_id: 'BK22222',
        check_in_date: '2024-03-20',
        messages: [
          {
            id: 'pre_001',
            sender: 'guest',
            message: 'What time is check-in? Do you provide towels?',
            timestamp: '2024-03-18T09:00:00Z',
          },
          {
            id: 'pre_002',
            sender: 'guest',
            message: 'Also, is there parking available?',
            timestamp: '2024-03-18T09:15:00Z',
          },
        ],
      }

      mockClient.getThread.mockResolvedValue(mockPreArrivalThread)

      const response = await testServer.callTool('lodgify_get_thread', {
        threadGuid: 'pre-arrival-444',
      })

      const result = JSON.parse(response.content[0].text)

      expect(result.messages).toHaveLength(2)
      expect(result.check_in_date).toBe('2024-03-20')
    })
  })
})
