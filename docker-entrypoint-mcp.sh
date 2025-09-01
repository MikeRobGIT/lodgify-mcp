#!/bin/sh
# Simple MCP entrypoint for stdio communication
set -e

# Check for required environment variable
if [ -z "$LODGIFY_API_KEY" ] || [ "$LODGIFY_API_KEY" = "your_lodgify_api_key_here" ]; then
    # For MCP, we should let the server handle the error reporting
    # Don't exit here, let the server start and report via JSON-RPC
    export LODGIFY_API_KEY="invalid-key-mcp-will-report-error"
fi

# Execute the MCP server
# If CMD is provided, use it; otherwise default to the server
if [ $# -eq 0 ]; then
    exec node /app/dist/server.js
else
    exec "$@"
fi