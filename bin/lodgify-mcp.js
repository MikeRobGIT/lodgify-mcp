#!/usr/bin/env node

// ES module wrapper for npx compatibility
import('../dist/server.js').then(module => {
  const main = module.main;
  if (typeof main !== 'function') {
    console.error('Error: main is not a function. Module exports:', Object.keys(module));
    console.error('Module:', module);
    process.exit(1);
  }
  
  main().catch((error) => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
}).catch(error => {
  console.error('Failed to import server:', error);
  process.exit(1);
});