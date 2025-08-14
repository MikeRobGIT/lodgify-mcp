#!/usr/bin/env node

/**
 * Example: Check Property and Room Availability
 * 
 * This example demonstrates how to check availability
 * for both entire properties and specific room types.
 */

import { LodgifyClient } from '../dist/lodgify.js'
import { config } from 'dotenv'

// Load environment variables
config()

async function checkAvailability() {
  const client = new LodgifyClient(process.env.LODGIFY_API_KEY)
  
  try {
    // Get a property to check availability for
    console.log('Fetching properties...\n')
    const properties = await client.listProperties({ limit: 1 })
    
    if (!properties || properties.length === 0) {
      console.log('No properties found.')
      return
    }
    
    const property = properties[0]
    const propertyId = property.id
    console.log(`Checking availability for property: ${propertyId}`)
    console.log(`Property name: ${property.name || 'N/A'}\n`)
    
    // Define date range for availability check
    const dateRange = {
      from: '2025-12-15',
      to: '2025-12-22',
    }
    
    console.log(`Date range: ${dateRange.from} to ${dateRange.to}\n`)
    
    // Check property availability
    console.log('=== Property Availability ===')
    try {
      const propertyAvailability = await client.getAvailabilityProperty(
        propertyId,
        dateRange
      )
      
      if (propertyAvailability.available !== undefined) {
        console.log(`Overall availability: ${propertyAvailability.available ? 'Available' : 'Not Available'}`)
      }
      
      if (propertyAvailability.dates && Array.isArray(propertyAvailability.dates)) {
        console.log('\nDaily availability:')
        propertyAvailability.dates.forEach(day => {
          const status = day.available ? '✅ Available' : '❌ Booked'
          const price = day.price ? ` - $${day.price}` : ''
          console.log(`  ${day.date}: ${status}${price}`)
        })
      }
      
      if (propertyAvailability.minimumStay) {
        console.log(`\nMinimum stay: ${propertyAvailability.minimumStay} nights`)
      }
      
    } catch (error) {
      console.log('Could not check property availability:', error.message)
    }
    
    // Check room availability if rooms exist
    console.log('\n=== Room Availability ===')
    
    // First, get rooms for the property
    try {
      const rooms = await client.listPropertyRooms(propertyId)
      
      if (!rooms || rooms.length === 0) {
        console.log('No rooms found for this property.')
      } else {
        console.log(`Found ${rooms.length} room type(s)\n`)
        
        // Check availability for each room type
        for (const room of rooms.slice(0, 3)) { // Check first 3 rooms
          try {
            console.log(`Room: ${room.name || room.id}`)
            
            const roomAvailability = await client.getAvailabilityRoom(
              propertyId,
              room.id,
              dateRange
            )
            
            if (roomAvailability.available !== undefined) {
              console.log(`  Status: ${roomAvailability.available ? 'Available' : 'Not Available'}`)
            }
            
            if (roomAvailability.quantity !== undefined) {
              console.log(`  Units available: ${roomAvailability.quantity}`)
            }
            
            if (roomAvailability.price) {
              console.log(`  Total price: $${roomAvailability.price}`)
            }
            
            console.log('')
            
          } catch (error) {
            console.log(`  Could not check availability: ${error.message}`)
            console.log('')
          }
        }
      }
    } catch (error) {
      console.log('Could not list rooms:', error.message)
    }
    
    // Check daily rates
    console.log('=== Daily Rates ===')
    try {
      const rates = await client.getDailyRates({
        propertyId,
        ...dateRange,
      })
      
      if (rates.rates && Array.isArray(rates.rates)) {
        console.log('Daily rates:')
        rates.rates.slice(0, 7).forEach(rate => {
          console.log(`  ${rate.date}: $${rate.rate || 'N/A'}`)
        })
      }
      
    } catch (error) {
      console.log('Could not fetch daily rates:', error.message)
    }
    
  } catch (error) {
    console.error('Error checking availability:', error.message)
    
    if (error.detail) {
      console.error('Error details:', JSON.stringify(error.detail, null, 2))
    }
    
    process.exit(1)
  }
}

// Run the example
checkAvailability().catch(console.error)