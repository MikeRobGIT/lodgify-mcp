#!/usr/bin/env node

// ES module wrapper for npx compatibility
// Import and explicitly call the main function
const { main } = await import('../dist/server.js');

// Call main and handle errors
main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});