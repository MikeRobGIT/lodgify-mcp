#!/bin/sh
# Simple MCP entrypoint for stdio communication
set -e

# Check for required environment variable
if [ -z "$LODGIFY_API_KEY" ] || [ "$LODGIFY_API_KEY" = "your_lodgify_api_key_here" ]; then
    echo "ERROR: LODGIFY_API_KEY is not set or contains default value" >&2
    exit 1
fi

# Execute the command directly for stdio communication
exec "$@"