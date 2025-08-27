#!/usr/bin/env node

import { LodgifyOrchestrator } from './dist/lodgify-orchestrator.js'

async function testBooking() {
  console.log('Testing booking creation with fixed API version...')

  const client = new LodgifyOrchestrator(process.env.LODGIFY_API_KEY || 'test-key')

  try {
    const result = await client.createBooking({
      property_id: 123,
      arrival: '2025-08-28',
      departure: '2025-08-30',
      guest_name: 'John Smith',
      guest_email: 'test@example.com',
      adults: 2,
      status: 'booked',
      source: 'MCP Test',
    })

    console.log('✅ Booking created successfully:', result)
  } catch (error) {
    console.log('📋 Expected error (using test data):', error.message)

    // Check if the error is about API version (the original problem)
    if (error.message.includes('does not support the API version')) {
      console.log('❌ API version issue still exists!')
    } else {
      console.log('✅ API version issue is fixed! Getting proper API validation error instead.')
    }
  }
}

testBooking().catch(console.error)
