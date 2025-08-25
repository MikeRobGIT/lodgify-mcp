# Unified Docker Setup Guide

This guide explains how to run both the Lodgify MCP Server and MCPO proxy together using the unified Docker Compose configuration.

## Overview

The unified setup provides:
- **lodgify-mcp**: Core MCP server (stdio-based) running in a container
- **lodgify-mcpo**: MCPO proxy that communicates with the MCP server and exposes REST API
- **Container-to-container communication**: MCPO connects to MCP server via Docker exec
- **Shared networking**: Both containers use the same Docker network
- **Health checks**: Automated health monitoring for both services
- **Development mode**: Hot reload support for both containers

## Architecture

```
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│   OpenWebUI     │────│   MCPO Proxy    │────│   MCP Server    │
│   (REST API)    │    │   (Port 8000)   │    │   (stdio)       │
└─────────────────┘    └──────────────────┘    └─────────────────┘
                              │                          │
                              └──────── Docker ──────────┘
                                      Network
```

## Quick Start

### 1. Environment Setup

Create your `.env` file:
```bash
cp .env.example .env
```

Edit `.env` with your configuration:
```env
# Required
LODGIFY_API_KEY="your_lodgify_api_key_here"

# Optional
NODE_ENV="production"
LOG_LEVEL="info"
MCPO_PORT="8000"
MCPO_API_KEY="your_mcpo_secret_key"
```

### 2. Start Both Services

**Production mode**:
```bash
bun run unified:up
```

**Development mode** (with hot reload):
```bash
bun run unified:dev
```

### 3. Verify Services

Check that both containers are running:
```bash
docker ps
```

Test the MCPO REST API:
```bash
curl http://localhost:8000/health
curl http://localhost:8000/docs
```

## Commands Reference

### Basic Operations
```bash
# Start both services in background
bun run unified:up

# Start in development mode (foreground, hot reload)
bun run unified:dev

# Stop both services
bun run unified:down

# View logs from both containers
bun run unified:logs

# Restart both services
bun run unified:restart

# Rebuild containers
bun run unified:build
```

### Advanced Operations
```bash
# View logs from specific service
docker-compose -f docker-compose.unified.yml logs -f lodgify-mcp
docker-compose -f docker-compose.unified.yml logs -f lodgify-mcpo

# Check service health
docker-compose -f docker-compose.unified.yml ps

# Execute commands in running containers
docker-compose -f docker-compose.unified.yml exec lodgify-mcp sh
docker-compose -f docker-compose.unified.yml exec lodgify-mcpo sh

# Scale services (if needed)
docker-compose -f docker-compose.unified.yml up --scale lodgify-mcp=1
```

## Service Configuration

### MCP Server Container
- **Image**: `ghcr.io/mikerobgit/lodgify-mcp:latest`
- **Network**: Internal only (no exposed ports)
- **Communication**: stdio via Docker exec
- **Health Check**: Node.js process validation
- **Resources**: 256MB memory limit, 0.5 CPU limit

### MCPO Proxy Container
- **Image**: Custom build with Dockerfile.mcpo
- **Port**: 8000 (REST API)
- **Communication**: Docker exec to MCP container
- **Health Check**: HTTP health endpoint
- **Resources**: 512MB memory limit, 1.0 CPU limit

## Container Communication

The MCPO proxy communicates with the MCP server using Docker exec:

```bash
# MCPO runs this command to communicate with MCP
docker exec -i lodgify-mcp-server node dist/server.js
```

This approach provides:
- **Isolation**: Each service runs in its own container
- **Reliability**: No network dependencies between containers
- **Security**: stdio communication is secure and contained
- **Performance**: Direct container execution without network overhead

## Development Mode

Development mode provides:
- **Hot reload**: Both containers watch for file changes
- **Debug logging**: Enhanced logging for troubleshooting
- **Volume mounts**: Source code mounted for live editing
- **Development tools**: Additional debugging capabilities

Start development mode:
```bash
bun run unified:dev
```

This will:
1. Build containers with development configuration
2. Mount source code volumes
3. Enable hot reload for both services
4. Use development environment variables

## Environment Variables

### MCP Server Variables
- `LODGIFY_API_KEY` - Your Lodgify API key (required)
- `NODE_ENV` - Environment mode (default: production)
- `LOG_LEVEL` - Logging level (default: info)

### MCPO Proxy Variables
- `MCPO_PORT` - REST API port (default: 8000)
- `MCPO_API_KEY` - API key for REST authentication
- `MCPO_CONFIG` - Configuration file path
- `MCP_SERVER_COMMAND` - Docker command to reach MCP server
- `MCP_SERVER_ARGS` - Arguments for MCP server connection

## Networking

The unified setup creates a dedicated Docker network:
- **Network Name**: `lodgify-unified-network`
- **Driver**: bridge
- **Subnet**: 172.21.0.0/16
- **Internal Communication**: Container-to-container via Docker exec
- **External Access**: MCPO REST API on port 8000

## Health Monitoring

Both services include health checks:

### MCP Server Health
- **Check**: Node.js process validation
- **Interval**: 30 seconds
- **Timeout**: 10 seconds
- **Retries**: 3

### MCPO Proxy Health
- **Check**: HTTP GET /health endpoint
- **Interval**: 30 seconds
- **Timeout**: 10 seconds
- **Retries**: 3
- **Start Period**: 90 seconds (allows time for MCP server startup)

## Troubleshooting

### Check Service Status
```bash
# View all container status
docker-compose -f docker-compose.unified.yml ps

# Check specific container health
docker inspect --format='{{.State.Health.Status}}' lodgify-mcp-server
docker inspect --format='{{.State.Health.Status}}' lodgify-mcpo-proxy
```

### View Logs
```bash
# All logs
bun run unified:logs

# Specific service logs
docker-compose -f docker-compose.unified.yml logs -f lodgify-mcp
docker-compose -f docker-compose.unified.yml logs -f lodgify-mcpo
```

### Test Container Communication
```bash
# Test if MCPO can reach MCP server
docker exec lodgify-mcpo-proxy docker exec -i lodgify-mcp-server node -e "console.log('MCP reachable')"

# Test MCP server directly
docker exec -i lodgify-mcp-server node dist/server.js
```

### Common Issues

**1. MCPO can't connect to MCP server**
```bash
# Check if MCP container is running
docker ps | grep lodgify-mcp-server

# Check MCP container health
docker inspect --format='{{.State.Health.Status}}' lodgify-mcp-server

# Restart MCP container
docker-compose -f docker-compose.unified.yml restart lodgify-mcp
```

**2. Port conflicts**
```bash
# Check if port 8000 is in use
lsof -i :8000

# Use different port
MCPO_PORT=8001 bun run unified:up
```

**3. Environment variable issues**
```bash
# Check environment variables in containers
docker exec lodgify-mcp-server env | grep LODGIFY
docker exec lodgify-mcpo-proxy env | grep MCPO
```

**4. Docker socket permission issues**
```bash
# Check Docker socket permissions
ls -la /var/run/docker.sock

# Add current user to docker group (requires logout/login)
sudo usermod -a -G docker $USER
```

## Security Considerations

- **API Keys**: Never commit API keys to version control
- **Network Isolation**: Services communicate via internal Docker network
- **Container Security**: Both containers run with limited privileges
- **Health Monitoring**: Automated health checks prevent unhealthy containers
- **Logging**: Structured logging with size limits to prevent disk exhaustion

## Performance Tuning

### Resource Limits
Adjust resource limits in docker-compose.unified.yml:
```yaml
deploy:
  resources:
    limits:
      cpus: '1.0'      # Increase for higher load
      memory: 512M     # Increase for complex operations
```

### Logging Configuration
Optimize logging for performance:
```yaml
logging:
  driver: json-file
  options:
    max-size: "10m"    # Increase for more detailed logs
    max-file: "3"      # Increase for longer retention
```

## Integration Examples

### OpenWebUI Integration
1. Start unified setup: `bun run unified:up`
2. Configure OpenWebUI to use `http://localhost:8000`
3. Set MCPO API key in OpenWebUI settings

### Custom Applications
Use the REST API client example:
```bash
node examples/mcpo-client.js
```

Or integrate directly:
```javascript
const response = await fetch('http://localhost:8000/lodgify/list_properties', {
  method: 'POST',
  headers: {
    'Authorization': 'Bearer your-mcpo-api-key',
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({})
});
```

## Advanced Configuration

### Custom MCPO Configuration
Create custom configuration for specific needs:
```json
{
  "mcpServers": {
    "lodgify-mcp": {
      "command": "docker",
      "args": ["exec", "-i", "lodgify-mcp-server", "node", "dist/server.js"],
      "env": {
        "LODGIFY_API_KEY": "${LODGIFY_API_KEY}",
        "LOG_LEVEL": "debug"
      }
    }
  }
}
```

### Multi-Environment Setup
Use different docker-compose files for different environments:
```bash
# Production
docker-compose -f docker-compose.unified.yml up -d

# Staging
docker-compose -f docker-compose.unified.yml -f docker-compose.staging.yml up -d

# Development
bun run unified:dev
```