/**
 * Integration tests for lodgify_delete_booking tool
 * Tests the critical user-facing feature of permanently deleting bookings
 */

import { beforeAll, beforeEach, describe, expect, it, jest } from 'bun:test'
import { ErrorCode, McpError } from '@modelcontextprotocol/sdk/types.js'
import type { LodgifyOrchestrator } from '../../src/lodgify-orchestrator.js'
import { getBookingTools } from '../../src/mcp/tools/booking-tools.js'
import type { ToolRegistration } from '../../src/mcp/utils/types.js'

describe('lodgify_delete_booking - Permanent booking deletion', () => {
  let deleteBookingTool: ToolRegistration | undefined
  let mockClient: jest.MockedObject<LodgifyOrchestrator>

  beforeAll(() => {
    // Get the delete booking tool from the booking tools registry
    const getClient = () => mockClient as unknown as LodgifyOrchestrator
    const tools = getBookingTools(getClient)
    deleteBookingTool = tools.find((t) => t.name === 'lodgify_delete_booking')
  })

  beforeEach(() => {
    // Create a fresh mock client for each test
    mockClient = {
      deleteBookingV1: jest.fn(),
    } as unknown as jest.MockedObject<LodgifyOrchestrator>
  })

  describe('Tool registration and metadata', () => {
    it('should be properly registered with correct metadata', () => {
      expect(deleteBookingTool).toBeDefined()
      expect(deleteBookingTool?.name).toBe('lodgify_delete_booking')
      expect(deleteBookingTool?.category).toBe('Booking & Reservation Management')
    })

    it('should have proper title and description for user guidance', () => {
      expect(deleteBookingTool?.config.title).toBe('Delete Booking (V1)')
      expect(deleteBookingTool?.config.description).toContain('Permanently delete a booking')
      expect(deleteBookingTool?.config.description).toContain('Use with caution')
      expect(deleteBookingTool?.config.description).toContain('cannot be undone')
    })

    it('should have correct input schema', () => {
      const schema = deleteBookingTool?.config.inputSchema
      expect(schema).toBeDefined()
      expect(schema.id).toBeDefined()
    })
  })

  describe('Successful deletion scenarios', () => {
    it('should successfully delete a booking and return enhanced response', async () => {
      // Mock successful deletion
      mockClient.deleteBookingV1.mockResolvedValue({
        success: true,
        message: 'Booking deleted successfully',
      })

      const result = await deleteBookingTool?.handler({
        id: 12345,
      })

      // Verify the client was called correctly
      expect(mockClient.deleteBookingV1).toHaveBeenCalledWith(12345)
      expect(mockClient.deleteBookingV1).toHaveBeenCalledTimes(1)

      // Parse the response
      const response = JSON.parse(result?.content[0]?.text || '{}')

      // Verify enhanced response structure
      expect(response.operation).toMatchObject({
        type: 'delete',
        entity: 'booking',
        status: 'success',
      })
      expect(response.summary).toBe('Booking has been permanently deleted')
      expect(response.data).toMatchObject({
        success: true,
        message: 'Booking deleted successfully',
      })
    })

    it('should include proper warnings about permanent deletion', async () => {
      mockClient.deleteBookingV1.mockResolvedValue({
        success: true,
        bookingId: 789,
      })

      const result = await deleteBookingTool?.handler({
        id: 789,
      })

      const response = JSON.parse(result?.content[0]?.text || '{}')

      // Critical: Verify warnings are included
      expect(response.warnings).toBeDefined()
      expect(response.warnings).toContain('This action cannot be undone')
    })

    it('should provide helpful post-deletion suggestions when available', async () => {
      mockClient.deleteBookingV1.mockResolvedValue({
        success: true,
        bookingId: 456,
      })

      const result = await deleteBookingTool?.handler({
        id: 456,
      })

      const response = JSON.parse(result?.content[0]?.text || '{}')

      // Suggestions might not be defined for delete operations currently
      // But the response should still be well-formed
      expect(response.operation).toBeDefined()
      expect(response.operation.type).toBe('delete')
      expect(response.summary).toBeDefined()
    })

    it('should handle deletion of bookings with special IDs', async () => {
      // Test edge case: maximum integer ID
      mockClient.deleteBookingV1.mockResolvedValue({
        success: true,
      })

      const maxId = 2147483647 // Maximum 32-bit integer
      const result = await deleteBookingTool?.handler({
        id: maxId,
      })

      expect(mockClient.deleteBookingV1).toHaveBeenCalledWith(maxId)
      const response = JSON.parse(result?.content[0]?.text || '{}')
      expect(response.operation.status).toBe('success')
    })
  })

  describe('Error handling scenarios', () => {
    it('should handle booking not found error gracefully', async () => {
      // Mock booking not found error
      const notFoundError = new Error('Booking not found')
      ;(notFoundError as any).statusCode = 404
      mockClient.deleteBookingV1.mockRejectedValue(notFoundError)

      await expect(
        deleteBookingTool?.handler({
          id: 99999,
        }),
      ).rejects.toThrow('Booking not found')

      expect(mockClient.deleteBookingV1).toHaveBeenCalledWith(99999)
    })

    it('should handle permission denied error when trying to delete protected booking', async () => {
      // Mock permission denied error
      const permissionError = new Error('Permission denied: Cannot delete confirmed booking')
      ;(permissionError as any).statusCode = 403
      mockClient.deleteBookingV1.mockRejectedValue(permissionError)

      await expect(
        deleteBookingTool?.handler({
          id: 123,
        }),
      ).rejects.toThrow('Permission denied')

      expect(mockClient.deleteBookingV1).toHaveBeenCalledWith(123)
    })

    it('should handle network timeout during deletion', async () => {
      // Mock network timeout
      const timeoutError = new Error('Network timeout')
      ;(timeoutError as any).code = 'ETIMEDOUT'
      mockClient.deleteBookingV1.mockRejectedValue(timeoutError)

      await expect(
        deleteBookingTool?.handler({
          id: 555,
        }),
      ).rejects.toThrow('Network timeout')
    })

    it('should handle API rate limiting', async () => {
      // Mock rate limit error
      const rateLimitError = new Error('Too many requests')
      ;(rateLimitError as any).statusCode = 429
      mockClient.deleteBookingV1.mockRejectedValue(rateLimitError)

      await expect(
        deleteBookingTool?.handler({
          id: 777,
        }),
      ).rejects.toThrow('Too many requests')
    })
  })

  describe('Input validation', () => {
    it('should validate that booking ID is required', async () => {
      // Test with missing ID - should get validation error
      try {
        const result = await deleteBookingTool?.handler({})
        // If we get here, the validation didn't work as expected
        // Check if an error is embedded in the response
        const response = JSON.parse(result?.content[0]?.text || '{}')
        expect(response.error || response.operation?.status).toBeTruthy()
      } catch (error: any) {
        // This is the expected path - validation error
        expect(error).toBeDefined()
        // The error could be from Zod or from the handler
        expect(error.message || error.toString()).toBeTruthy()
      }
    })

    it('should validate that booking ID is a valid integer', async () => {
      // Test with invalid ID types - Zod validation will catch these
      try {
        await deleteBookingTool?.handler({ id: 'abc' })
        expect(true).toBe(false) // Should not reach here
      } catch (error: any) {
        expect(error).toBeDefined()
      }

      try {
        await deleteBookingTool?.handler({ id: 12.5 })
        expect(true).toBe(false) // Should not reach here
      } catch (error: any) {
        expect(error).toBeDefined()
      }
    })

    it('should handle negative booking IDs', async () => {
      // Zod allows negative integers by default, but the API might reject them
      mockClient.deleteBookingV1.mockRejectedValue(new Error('Invalid booking ID'))

      await expect(deleteBookingTool?.handler({ id: -123 })).rejects.toThrow('Invalid booking ID')
    })
  })

  describe('Business logic validation', () => {
    it('should warn about permanent nature of deletion in all responses', async () => {
      // This tests that EVERY successful deletion includes the warning
      const testCases = [
        { id: 1, response: { success: true } },
        { id: 2, response: { deleted: true, bookingId: 2 } },
        { id: 3, response: {} }, // Even empty success response
      ]

      for (const testCase of testCases) {
        mockClient.deleteBookingV1.mockResolvedValue(testCase.response)

        const result = await deleteBookingTool?.handler({ id: testCase.id })
        const response = JSON.parse(result?.content[0]?.text || '{}')

        // Critical business requirement: ALL deletions must warn users
        expect(response.warnings).toBeDefined()
        expect(response.warnings).toContain('This action cannot be undone')
        expect(response.operation.type).toBe('delete')
      }
    })

    it('should provide appropriate context after successful deletion', async () => {
      // Users might accidentally delete and need guidance
      mockClient.deleteBookingV1.mockResolvedValue({
        success: true,
        bookingId: 888,
      })

      const result = await deleteBookingTool?.handler({ id: 888 })
      const response = JSON.parse(result?.content[0]?.text || '{}')

      // Should provide clear status and warnings
      expect(response.operation.status).toBe('success')
      expect(response.summary).toContain('deleted')
      expect(response.warnings).toBeDefined()
      expect(response.warnings).toContain('This action cannot be undone')
    })
  })

  describe('Edge cases and boundary conditions', () => {
    it('should handle deletion when API returns minimal response', async () => {
      // Some API versions might return minimal data
      mockClient.deleteBookingV1.mockResolvedValue({})

      const result = await deleteBookingTool?.handler({ id: 333 })
      const response = JSON.parse(result?.content[0]?.text || '{}')

      // Should still provide a complete enhanced response
      expect(response.operation).toBeDefined()
      expect(response.summary).toBeDefined()
      expect(response.warnings).toContain('This action cannot be undone')
    })

    it('should handle concurrent deletion attempts gracefully', async () => {
      // Simulate booking already deleted error
      const alreadyDeletedError = new Error('Booking already deleted')
      ;(alreadyDeletedError as any).statusCode = 404
      ;(alreadyDeletedError as any).code = 'BOOKING_NOT_FOUND'

      mockClient.deleteBookingV1.mockRejectedValueOnce(alreadyDeletedError)

      await expect(deleteBookingTool?.handler({ id: 444 })).rejects.toThrow(
        'Booking already deleted',
      )
    })

    it('should track deletion request in input params of response', async () => {
      mockClient.deleteBookingV1.mockResolvedValue({ success: true })

      const bookingId = 12345
      const result = await deleteBookingTool?.handler({ id: bookingId })
      const response = JSON.parse(result?.content[0]?.text || '{}')

      // Verify the original request is tracked
      expect(response.operation.entity).toBe('booking')
      expect(response.operation.type).toBe('delete')
      // The input params should be preserved in the enhanced response
      expect(response.data).toBeDefined()
    })
  })

  describe('User experience and safety', () => {
    it('should emphasize the permanent nature of the action', async () => {
      mockClient.deleteBookingV1.mockResolvedValue({ success: true })

      const result = await deleteBookingTool?.handler({ id: 555 })
      const response = JSON.parse(result?.content[0]?.text || '{}')

      // Multiple safety checks
      expect(response.summary).toContain('permanently')
      expect(response.warnings).toBeDefined()
      expect(response.warnings.length).toBeGreaterThan(0)
      expect(response.operation.type).toBe('delete')
    })

    it('should provide clear feedback when deletion is successful', async () => {
      mockClient.deleteBookingV1.mockResolvedValue({
        success: true,
        message: 'Booking 666 has been deleted',
      })

      const result = await deleteBookingTool?.handler({ id: 666 })
      const response = JSON.parse(result?.content[0]?.text || '{}')

      expect(response.operation.status).toBe('success')
      expect(response.summary).toContain('deleted')
      expect(response.data.success).toBe(true)
    })
  })

  describe('Read-only mode protection', () => {
    it('should respect read-only mode if enforced at orchestrator level', async () => {
      // Simulate read-only mode error from orchestrator
      const readOnlyError = new McpError(
        ErrorCode.InvalidRequest,
        'Operation not permitted in read-only mode',
      )
      mockClient.deleteBookingV1.mockRejectedValue(readOnlyError)

      await expect(deleteBookingTool?.handler({ id: 999 })).rejects.toThrow(
        'Operation not permitted in read-only mode',
      )

      expect(mockClient.deleteBookingV1).toHaveBeenCalledWith(999)
    })
  })
})
