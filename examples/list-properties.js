#!/usr/bin/env node

/**
 * Example: List Properties with Pagination
 * 
 * This example demonstrates how to use the Lodgify MCP server
 * to list properties with pagination and filtering.
 */

import { LodgifyClient } from '../dist/lodgify.js'
import { config } from 'dotenv'

// Load environment variables
config()

async function listProperties() {
  // Initialize the client with your API key
  const client = new LodgifyClient(process.env.LODGIFY_API_KEY)
  
  try {
    console.log('Fetching properties from Lodgify...\n')
    
    // List first page of properties
    const properties = await client.listProperties({
      page: 1,
      limit: 10,
      includeDeleted: false,
    })
    
    // Check if we got results
    if (!Array.isArray(properties) || properties.length === 0) {
      console.log('No properties found.')
      return
    }
    
    console.log(`Found ${properties.length} properties:\n`)
    
    // Display each property
    properties.forEach((property, index) => {
      console.log(`${index + 1}. Property ID: ${property.id}`)
      console.log(`   Name: ${property.name || 'N/A'}`)
      console.log(`   Address: ${property.address || 'N/A'}`)
      console.log(`   City: ${property.city || 'N/A'}`)
      console.log(`   Country: ${property.country || 'N/A'}`)
      console.log(`   Status: ${property.status || 'Active'}`)
      console.log('')
    })
    
    // Get details for the first property
    if (properties[0]?.id) {
      console.log('Fetching details for first property...\n')
      const details = await client.getProperty(properties[0].id)
      
      console.log('Property Details:')
      console.log(JSON.stringify(details, null, 2))
    }
    
  } catch (error) {
    console.error('Error listing properties:', error.message)
    
    // Handle specific error types
    if (error.status === 401) {
      console.error('Authentication failed. Please check your API key.')
    } else if (error.status === 429) {
      console.error('Rate limited. The client should automatically retry.')
    } else if (error.detail) {
      console.error('Error details:', error.detail)
    }
    
    process.exit(1)
  }
}

// Run the example
listProperties().catch(console.error)