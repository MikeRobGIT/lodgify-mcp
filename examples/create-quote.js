#!/usr/bin/env node

/**
 * Example: Create a Quote with Complex Parameters
 * 
 * This example demonstrates how to use bracket notation
 * for complex nested parameters when creating a quote.
 */

import { LodgifyClient } from '../dist/lodgify.js'
import { config } from 'dotenv'

// Load environment variables
config()

async function createQuote() {
  const client = new LodgifyClient(process.env.LODGIFY_API_KEY)
  
  try {
    // First, get a property to create a quote for
    console.log('Fetching properties...\n')
    const properties = await client.listProperties({ limit: 1 })
    
    if (!properties || properties.length === 0) {
      console.log('No properties found. Please create a property first.')
      return
    }
    
    const propertyId = properties[0].id
    console.log(`Using property: ${propertyId}\n`)
    
    // Create a quote with complex parameters
    // Note: This uses bracket notation for nested objects
    const quoteParams = {
      // Date range
      from: '2025-12-20',
      to: '2025-12-27',
      
      // Room types with bracket notation
      'roomTypes[0].Id': properties[0].roomTypes?.[0]?.id || 999,
      'roomTypes[0].quantity': 1,
      
      // Guest breakdown with bracket notation
      'guest_breakdown[adults]': 2,
      'guest_breakdown[children]': 1,
      'guest_breakdown[infants]': 0,
      
      // Additional options
      currency: 'USD',
      includeExtras: true,
      includeAvailability: true,
    }
    
    console.log('Creating quote with parameters:')
    console.log(JSON.stringify(quoteParams, null, 2))
    console.log('')
    
    const quote = await client.getQuote(propertyId, quoteParams)
    
    console.log('Quote generated successfully!\n')
    console.log('Quote Details:')
    console.log(`- Check-in: ${quoteParams.from}`)
    console.log(`- Check-out: ${quoteParams.to}`)
    console.log(`- Guests: ${quoteParams['guest_breakdown[adults]']} adults, ${quoteParams['guest_breakdown[children]']} children`)
    console.log(`- Total Amount: ${quote.totalAmount || 'N/A'} ${quote.currency || 'USD'}`)
    
    if (quote.breakdown) {
      console.log('\nPrice Breakdown:')
      console.log(`- Nights: ${quote.breakdown.nights || 'N/A'}`)
      console.log(`- Price per night: ${quote.breakdown.pricePerNight || 'N/A'}`)
      console.log(`- Cleaning fee: ${quote.breakdown.cleaningFee || 0}`)
      console.log(`- Service fee: ${quote.breakdown.serviceFee || 0}`)
    }
    
    if (quote.availability) {
      console.log(`\nAvailability: ${quote.availability.available ? 'Available' : 'Not Available'}`)
    }
    
    console.log('\nFull Quote Response:')
    console.log(JSON.stringify(quote, null, 2))
    
  } catch (error) {
    console.error('Error creating quote:', error.message)
    
    if (error.status === 400) {
      console.error('Bad request. The property might not have the specified room types or dates might be invalid.')
    } else if (error.status === 404) {
      console.error('Property not found.')
    }
    
    if (error.detail) {
      console.error('Error details:', JSON.stringify(error.detail, null, 2))
    }
    
    process.exit(1)
  }
}

// Run the example
createQuote().catch(console.error)