// Bootstrap module for HTTP transport. Sets MCP_TRANSPORT before logger
// initialization so stdout logging is enabled. Must be imported before
// any module that imports the logger.
process.env.MCP_TRANSPORT = 'http'
