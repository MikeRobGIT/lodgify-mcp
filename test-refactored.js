#!/usr/bin/env node

/**
 * Test the refactored MCP server
 */

import { setupServer } from './dist/mcp/server-setup.js'

async function test() {
  try {
    const { toolRegistry, resourceRegistry } = setupServer()

    console.log('✅ Server setup successful')
    console.log(`📦 Tools registered: ${toolRegistry.getTools().length}`)
    console.log(`📚 Resources registered: ${resourceRegistry.getResources().length}`)

    // List all tools by category
    const categories = toolRegistry.getCategories()
    console.log('\n🔧 Tools by category:')
    for (const [category, tools] of Object.entries(categories)) {
      console.log(`  ${category}: ${tools.length} tools`)
      for (const tool of tools) {
        console.log(`    - ${tool.name}`)
      }
    }

    console.log('\n✅ All modules loaded successfully!')
  } catch (error) {
    console.error('❌ Error:', error)
    process.exit(1)
  }
}

test()
