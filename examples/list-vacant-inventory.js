#!/usr/bin/env node

/**
 * Example: Using the lodgify_list_vacant_inventory MCP tool
 *
 * This example demonstrates how to find all vacant properties for a given date range.
 * The tool aggregates availability across multiple properties in a single call,
 * making it efficient for finding available inventory.
 */

import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js'
import { spawn } from 'child_process'

async function main() {
  // Start the MCP server as a subprocess
  const serverProcess = spawn('node', ['../dist/server.js'], {
    stdio: ['pipe', 'pipe', 'pipe'],
    env: {
      ...process.env,
      LODGIFY_API_KEY: process.env.LODGIFY_API_KEY, // Make sure API key is set
    },
  })

  // Create MCP client with stdio transport
  const transport = new StdioClientTransport({
    // Connect to the server's stdio
    writer: serverProcess.stdin,
    reader: serverProcess.stdout,
  })

  const client = new Client(
    {
      name: 'lodgify-example-client',
      version: '1.0.0',
    },
    {
      capabilities: {},
    },
  )

  // Connect to the server
  await client.connect(transport)

  try {
    // Example 1: Find all vacant properties for a date range
    console.log('\n=== Example 1: Find all vacant properties ===\n')

    const vacantInventory = await client.callTool('lodgify_list_vacant_inventory', {
      from: '2025-03-15',
      to: '2025-03-20',
      includeRooms: true, // Include room details
      limit: 10, // Check up to 10 properties
    })

    const result1 = JSON.parse(vacantInventory.content?.[0]?.text || '{}')
    console.log(`Summary: ${result1.summary}`)
    console.log(`\nVacant Properties:`)

    if (result1.data?.properties) {
      result1.data.properties.forEach((prop) => {
        if (prop.available) {
          console.log(`  - ${prop.name || prop.id} (ID: ${prop.id})`)
          if (prop.rooms?.length > 0) {
            console.log(`    Rooms:`)
            prop.rooms.forEach((room) => {
              console.log(`      - ${room.name} (Available: ${room.available})`)
            })
          }
        }
      })
    }

    if (result1.suggestions?.length > 0) {
      console.log(`\nSuggestions:`)
      result1.suggestions.forEach((suggestion) => {
        console.log(`  - ${suggestion}`)
      })
    }

    // Example 2: Check specific properties for vacancy
    console.log('\n=== Example 2: Check specific properties ===\n')

    const specificCheck = await client.callTool('lodgify_list_vacant_inventory', {
      from: '2025-04-01',
      to: '2025-04-07',
      propertyIds: ['684855', '684856'], // Check only these properties
      includeRooms: true,
    })

    const result2 = JSON.parse(specificCheck.content?.[0]?.text || '{}')
    console.log(`Summary: ${result2.summary}`)

    if (result2.details) {
      console.log(`\nInventory Details:`)
      console.log(`  Properties checked: ${result2.details.propertiesChecked}`)
      console.log(`  Available properties: ${result2.details.availableProperties}`)
      console.log(`  Vacant count: ${result2.details.vacantCount}`)
    }

    // Example 3: Find properties without room details (faster)
    console.log('\n=== Example 3: Quick availability check ===\n')

    const quickCheck = await client.callTool('lodgify_list_vacant_inventory', {
      from: '2025-05-15',
      to: '2025-05-20',
      includeRooms: false, // Don't fetch room details for speed
      limit: 50, // Check more properties since we're not fetching room details
    })

    const result3 = JSON.parse(quickCheck.content?.[0]?.text || '{}')
    console.log(`Summary: ${result3.summary}`)

    if (result3.data?.counts) {
      console.log(`\nStatistics:`)
      console.log(`  Total properties checked: ${result3.data.counts.propertiesChecked}`)
      console.log(`  Available: ${result3.data.counts.availableProperties}`)
      console.log(`  Unavailable: ${result3.data.counts.unavailableProperties}`)
    }

    // Example 4: Handle error scenarios
    console.log('\n=== Example 4: Error handling ===\n')

    try {
      const invalidDateRange = await client.callTool('lodgify_list_vacant_inventory', {
        from: '2025-03-20', // End date before start date
        to: '2025-03-15',
        includeRooms: true,
      })

      const errorResult = JSON.parse(invalidDateRange.content?.[0]?.text || '{}')
      if (errorResult.operation?.status === 'failed') {
        console.log(`Error detected: ${errorResult.summary}`)
        if (errorResult.warnings?.length > 0) {
          console.log(`Warnings:`)
          errorResult.warnings.forEach((warning) => {
            console.log(`  - ${warning}`)
          })
        }
      }
    } catch (error) {
      console.log(`Tool error: ${error.message}`)
    }

  } catch (error) {
    console.error('Error:', error)
  } finally {
    // Disconnect from server
    await client.close()
    serverProcess.kill()
  }
}

// Run the example
main().catch(console.error)