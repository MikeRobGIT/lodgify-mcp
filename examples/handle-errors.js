#!/usr/bin/env node

/**
 * Example: Error Handling and Retry Behavior
 * 
 * This example demonstrates how the Lodgify client handles
 * various error scenarios including rate limiting, network
 * errors, and validation errors.
 */

import { LodgifyClient } from '../dist/lodgify.js'
import { config } from 'dotenv'

// Load environment variables
config()

async function demonstrateErrorHandling() {
  const client = new LodgifyClient(process.env.LODGIFY_API_KEY)
  
  console.log('=== Error Handling Examples ===\n')
  
  // Example 1: Handling 404 Not Found
  console.log('1. Handling 404 Not Found Error:')
  try {
    await client.getProperty('non-existent-property-id')
  } catch (error) {
    console.log(`   Status: ${error.status}`)
    console.log(`   Message: ${error.message}`)
    console.log(`   Path: ${error.path}`)
    if (error.detail) {
      console.log(`   Details: ${JSON.stringify(error.detail)}`)
    }
  }
  console.log('')
  
  // Example 2: Handling missing required parameters
  console.log('2. Handling Missing Required Parameters:')
  try {
    await client.getProperty('')
  } catch (error) {
    console.log(`   Error: ${error.message}`)
  }
  console.log('')
  
  // Example 3: Handling invalid quote parameters
  console.log('3. Handling Invalid Quote Parameters:')
  try {
    // Try to get a quote with missing required params
    await client.getQuote('prop-123', {})
  } catch (error) {
    console.log(`   Status: ${error.status || 'N/A'}`)
    console.log(`   Message: ${error.message}`)
    if (error.detail) {
      console.log(`   Validation errors: ${JSON.stringify(error.detail, null, 2)}`)
    }
  }
  console.log('')
  
  // Example 4: Demonstrating retry logic (simulated)
  console.log('4. Rate Limiting and Retry Logic:')
  console.log('   The client automatically retries on 429 responses:')
  console.log('   - Uses exponential backoff: 1s, 2s, 4s, 8s, 16s')
  console.log('   - Respects Retry-After header if present')
  console.log('   - Maximum 5 retry attempts')
  console.log('   - Maximum delay of 30 seconds')
  console.log('')
  
  // Example 5: Handling authentication errors
  console.log('5. Handling Authentication Errors:')
  try {
    // Create a client with invalid API key
    const invalidClient = new LodgifyClient('invalid-api-key')
    await invalidClient.listProperties()
  } catch (error) {
    console.log(`   Status: ${error.status}`)
    console.log(`   Message: ${error.message}`)
    console.log('   Resolution: Check your API key in .env file')
  }
  console.log('')
  
  // Example 6: Error response structure
  console.log('6. Error Response Structure:')
  console.log('   All errors follow this format:')
  console.log(JSON.stringify({
    error: true,
    message: 'Human-readable error message',
    status: 'HTTP status code',
    path: 'API endpoint path',
    detail: 'Additional error details from API (optional)',
  }, null, 2))
  console.log('')
  
  // Example 7: Network error handling
  console.log('7. Network Error Handling:')
  console.log('   Network errors are caught and wrapped:')
  console.log('   - Connection timeouts')
  console.log('   - DNS resolution failures')
  console.log('   - Network unreachable')
  console.log('   All result in status: 0 with descriptive message')
  console.log('')
  
  // Example 8: Best practices
  console.log('=== Best Practices for Error Handling ===\n')
  console.log('1. Always wrap API calls in try-catch blocks')
  console.log('2. Check error.status to determine error type:')
  console.log('   - 400: Bad request (invalid parameters)')
  console.log('   - 401: Authentication failed (check API key)')
  console.log('   - 403: Forbidden (insufficient permissions)')
  console.log('   - 404: Resource not found')
  console.log('   - 429: Rate limited (auto-retry enabled)')
  console.log('   - 500+: Server errors')
  console.log('')
  console.log('3. Use error.detail for additional context')
  console.log('4. Log errors appropriately based on severity')
  console.log('5. Provide user-friendly error messages')
  console.log('6. Implement fallback strategies for critical operations')
  
  console.log('\n=== Error Handling Demo Complete ===')
}

// Run the example
demonstrateErrorHandling().catch(console.error)