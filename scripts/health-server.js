#!/usr/bin/env node
/**
 * Simple HTTP health check server for Docker container testing
 * This runs separately from the MCP server which uses stdio
 */

const http = require('http')

const PORT = process.env.PORT || 3000

const server = http.createServer((req, res) => {
  if (req.url === '/health' && req.method === 'GET') {
    // Basic health check
    const health = {
      status: 'healthy',
      service: 'lodgify-mcp',
      version: '0.1.0',
      timestamp: new Date().toISOString(),
      mode: 'health-check'
    }

    res.writeHead(200, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify(health, null, 2))
  } else {
    res.writeHead(404, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify({ error: 'Not Found', message: 'Only /health endpoint is available' }))
  }
})

server.listen(PORT, () => {
  console.log(`Health check server running on port ${PORT}`)
})

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('Shutting down health server...')
  server.close(() => {
    process.exit(0)
  })
})

process.on('SIGINT', () => {
  console.log('Shutting down health server...')
  server.close(() => {
    process.exit(0)
  })
})