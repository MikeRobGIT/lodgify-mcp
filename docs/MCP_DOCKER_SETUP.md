# MCP Docker Setup Guide

## Understanding MCP and Docker

Model Context Protocol (MCP) servers communicate via **stdio** (standard input/output), not HTTP. This is a fundamental difference from typical web services that affects how Docker containers must be configured.

### Key Points:
- MCP servers are spawned by MCP clients and communicate through pipes
- They don't listen on network ports
- They don't run as daemons or long-running services
- Health checks via HTTP are not applicable

## Configuration Options

### Option 1: Local MCP Server (Recommended)

Run the MCP server directly on your host machine:

```json
{
  "mcpServers": {
    "lodgify-local": {
      "command": "node",
      "args": ["dist/server.js"],
      "env": {
        "LODGIFY_API_KEY": "your_api_key_here",
        "LOG_LEVEL": "info"
      }
    }
  }
}
```

Build and use:
```bash
bun install
bun run build
# Then restart your MCP client
```

### Option 2: Docker with stdio

If you must use Docker, configure it for stdio communication:

```json
{
  "mcpServers": {
    "lodgify-docker": {
      "command": "docker",
      "args": [
        "run",
        "--rm",
        "-i",
        "-e",
        "LODGIFY_API_KEY=your_api_key_here",
        "-e",
        "LOG_LEVEL=info",
        "ghcr.io/mikerobgit/lodgify-mcp:latest",
        "node",
        "dist/server.js"
      ]
    }
  }
}
```

### Option 3: Build Custom MCP Docker Image

Use the simplified `Dockerfile.mcp`:

```bash
# Build the MCP-optimized image
docker build -f Dockerfile.mcp -t lodgify-mcp:mcp .

# Use in .mcp.json
{
  "mcpServers": {
    "lodgify-mcp": {
      "command": "docker",
      "args": [
        "run",
        "--rm",
        "-i",
        "-e",
        "LODGIFY_API_KEY=your_api_key_here",
        "lodgify-mcp:mcp"
      ]
    }
  }
}
```

## Common Issues

### "Failed to reconnect" Error
This occurs when:
1. The Docker container expects HTTP communication instead of stdio
2. The entrypoint script has health check logic for HTTP
3. The command doesn't directly execute the MCP server

### Solution
- Use direct command execution: `["node", "dist/server.js"]`
- Remove HTTP health checks from entrypoint
- Ensure `-i` flag for interactive mode in docker run

### API Key Validation Errors
The API key must:
- Be at least 32 characters long
- Contain only: `a-z`, `A-Z`, `0-9`, `+`, `/`, `=`, `_`, `-`
- Not contain obvious test patterns (unless in sandbox mode)

## Testing the MCP Server

Test locally first:
```bash
# Build
bun run build

# Test with MCP protocol
echo '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2024-11-05","capabilities":{},"clientInfo":{"name":"test","version":"1.0.0"}}}' | \
  LODGIFY_API_KEY="your_key" node dist/server.js

# Should return initialization response
```

## Docker Compose Note

The `docker-compose.yml` file is designed for traditional HTTP services, not MCP. For MCP:
- Don't use docker-compose 
- Configure directly in `.mcp.json`
- Use `docker run` with stdio flags

## Recommendations

1. **Use local installation** for simplicity and performance
2. If Docker is required, use the simplified MCP-specific configuration
3. Avoid HTTP-based health checks and port mappings for MCP servers
4. Test locally before containerizing