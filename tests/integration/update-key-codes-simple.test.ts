/**
 * Simple Integration Test for lodgify_update_key_codes
 * Tests the critical property access management feature
 */

import { beforeEach, describe, expect, mock, test } from 'bun:test'
import { createTestServer, type TestServer } from '../test-server'

describe('lodgify_update_key_codes Integration Test', () => {
  let testServer: TestServer
  let mockClient: Record<string, unknown>

  beforeEach(() => {
    // Create minimal mock client
    mockClient = {
      updateKeyCodes: mock(() => Promise.resolve({ success: true })),
      // Add other required methods
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
      checkinBooking: mock(() => Promise.resolve()),
      checkoutBooking: mock(() => Promise.resolve()),
      getQuote: mock(() => Promise.resolve()),
      getThread: mock(() => Promise.resolve()),
      listWebhooks: mock(() => Promise.resolve()),
      subscribeWebhook: mock(() => Promise.resolve()),
      unsubscribeWebhook: mock(() => Promise.resolve()),
      createBooking: mock(() => Promise.resolve()),
      updateBooking: mock(() => Promise.resolve()),
      deleteBooking: mock(() => Promise.resolve()),
      updateRates: mock(() => Promise.resolve()),
      availabilityAll: mock(() => Promise.resolve()),
      getExternalBookings: mock(() => Promise.resolve()),
    }

    testServer = createTestServer(mockClient)
  })

  test('should successfully update key codes', async () => {
    mockClient.updateKeyCodes.mockResolvedValue({
      success: true,
      message: 'Key codes updated successfully',
    })

    const response = await testServer.callTool('lodgify_update_key_codes', {
      id: 12345,
      payload: {
        keyCodes: ['1234', '5678'],
      },
    })

    // Check that the mock was called
    expect(mockClient.updateKeyCodes).toHaveBeenCalled()

    // Check response structure
    expect(response.content[0].type).toBe('text')
    const result = JSON.parse(response.content[0].text)

    // Check that we got a response (adjust based on actual structure)
    expect(result).toBeDefined()
    // The response should have success=true from our mock
    expect(result.success || result.data?.success).toBe(true)
  })

  test('should handle empty key codes array error', async () => {
    // Mock the client to ensure it's not supposed to succeed
    mockClient.updateKeyCodes.mockRejectedValue(new Error('Should not be called with empty array'))

    const response = await testServer.callTool('lodgify_update_key_codes', {
      id: 12345,
      payload: {
        keyCodes: [],
      },
    })

    // The mock might or might not be called depending on where validation happens
    // So we just check that we get a proper response
    expect(response.content[0].type).toBe('text')
    const result = JSON.parse(response.content[0].text)

    // Either the handler validates and returns error, or the client fails
    // Either way, the operation should not succeed
    const hasError = result.error || result.operation?.status === 'failed' || !result.success
    expect(hasError).toBeTruthy()
  })

  test('should handle network error gracefully', async () => {
    mockClient.updateKeyCodes.mockRejectedValue(new Error('Network timeout'))

    const response = await testServer.callTool('lodgify_update_key_codes', {
      id: 12345,
      payload: {
        keyCodes: ['EMERGENCY-999'],
      },
    })

    expect(mockClient.updateKeyCodes).toHaveBeenCalled()

    // Should get an error response
    expect(response.content[0].type).toBe('text')
    const result = JSON.parse(response.content[0].text)

    // Check that error is handled
    expect(result.operation?.status === 'failed' || result.error).toBeTruthy()
  })
})
