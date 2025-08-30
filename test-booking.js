import dotenv from 'dotenv'
import { LodgifyOrchestrator } from './dist/lodgify-orchestrator.js'

// Load environment variables
dotenv.config()

// Validate required environment variables
if (!process.env.LODGIFY_API_KEY || process.env.LODGIFY_API_KEY.trim() === '') {
  console.error('❌ Error: LODGIFY_API_KEY environment variable is required but not set or empty')
  console.error('Please set LODGIFY_API_KEY in your .env file or environment')
  process.exit(1)
}

const client = new LodgifyOrchestrator({
  apiKey: process.env.LODGIFY_API_KEY,
  readOnly: false,
})

// Utility function for async sleep/delay
async function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

async function testBooking() {
  try {
    console.log('Creating test booking for Toucan property...')

    // Generate dynamic dates relative to today
    const today = new Date()
    const arrivalDate = new Date(today)
    arrivalDate.setDate(today.getDate() + 7) // 7 days from today
    const departureDate = new Date(today)
    departureDate.setDate(today.getDate() + 8) // 8 days from today

    const arrivalStr = arrivalDate.toISOString().split('T')[0] // YYYY-MM-DD format
    const departureStr = departureDate.toISOString().split('T')[0] // YYYY-MM-DD format

    console.log(`Using dates: arrival ${arrivalStr}, departure ${departureStr}`)

    const booking = await client.bookingsV1.createBookingV1({
      property_id: 684855,
      room_type_id: 751902,
      arrival: arrivalStr,
      departure: departureStr,
      guest_name: 'Test Guest',
      guest_email: 'test@example.com',
      adults: 2,
      children: 0,
      status: 'booked',
      source: 'CLI Test',
    })

    console.log('✅ Booking created successfully!')

    // Safely extract booking ID with proper validation
    const bookingId = typeof booking === 'number' ? booking : booking?.id

    // Validate that bookingId exists and is a valid integer
    if (!bookingId || !Number.isInteger(bookingId) || bookingId <= 0) {
      const errorMessage = `Invalid booking ID: ${JSON.stringify(
        bookingId,
      )}. Expected a positive integer, but got: ${typeof bookingId} ${bookingId}`
      console.error('❌ Error:', errorMessage)
      throw new Error(errorMessage)
    }

    console.log('Booking ID:', bookingId)

    // Wait a moment
    console.log('\nWaiting 3 seconds before deletion...')
    await sleep(3000)

    // Delete the booking
    console.log('Deleting booking ID:', bookingId)
    await client.bookingsV1.deleteBookingV1(bookingId)
    console.log('✅ Booking deleted successfully!')
  } catch (error) {
    console.error('❌ Error:', error.message)
    if (error.details) {
      console.error('Details:', error.details)
    }
    // Log the full error stack for better debugging
    console.error('Stack trace:', error.stack || error)
    // Set exit code to indicate failure
    process.exitCode = 1
  }
}

testBooking().catch((err) => {
  console.error('Unhandled error in testBooking:', err)
  process.exit(1)
})
