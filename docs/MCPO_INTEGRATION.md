# MCPO Integration Guide

Complete guide to using MCPO (MCP-to-OpenAPI proxy) with the Lodgify MCP Server to expose REST API endpoints for cloud services like OpenWebUI.

## Table of Contents

- [Overview](#overview)
- [Architecture](#architecture)
- [Installation](#installation)
- [Configuration](#configuration)
- [Usage](#usage)
- [Docker Setup](#docker-setup)
- [OpenWebUI Integration](#openwebui-integration)
- [API Documentation](#api-documentation)
- [Troubleshooting](#troubleshooting)
- [Examples](#examples)

## Overview

MCPO (MCP-to-OpenAPI proxy) transforms the Lodgify MCP Server from a stdio-based Model Context Protocol server into a REST API with automatic OpenAPI documentation. This enables:

- **Cloud Compatibility**: Works with cloud-based services like OpenWebUI
- **REST API Access**: All Lodgify MCP tools accessible via HTTP endpoints
- **Interactive Documentation**: Automatic Swagger UI generation
- **Authentication**: Secure API key-based access
- **Hot Reload**: Configuration changes without restart

## Architecture

```
┌─────────────────┐    HTTP     ┌─────────────────┐    stdio    ┌─────────────────┐
│                 │   Requests  │                 │   MCP       │                 │
│   HTTP Client   │ ──────────→ │   MCPO Proxy    │ ──────────→ │ Lodgify MCP     │
│   (OpenWebUI)   │             │   (Port 8000)   │  Protocol   │   Server        │
│                 │ ←────────── │                 │ ←────────── │                 │
└─────────────────┘  JSON/REST  └─────────────────┘             └─────────────────┘
                                         │
                                         ▼
                                ┌─────────────────┐
                                │                 │
                                │ Lodgify API v2  │
                                │                 │
                                └─────────────────┘
```

### Key Components

1. **MCPO Proxy**: Python-based HTTP server that translates REST requests to MCP calls
2. **Lodgify MCP Server**: Node.js/Bun server implementing MCP protocol
3. **Configuration Files**: JSON files defining server commands and environment
4. **Docker Support**: Containerized deployment with multi-stage builds

## Installation

### Prerequisites

- **Python 3.8+** (for MCPO)
- **Node.js 18+** or **Bun 1.0+** (for Lodgify MCP Server)
- **Valid Lodgify API Key**

### Install MCPO

Choose one of the following methods:

#### Option 1: pip (Recommended)
```bash
pip install mcpo
```

#### Option 2: uv (Faster startup)
```bash
# Using uv for lightning-fast startup
uvx mcpo --help
```

### Install Lodgify MCP Server

```bash
# Clone the repository
git clone https://github.com/your-org/lodgify-mcp.git
cd lodgify-mcp

# Install dependencies
bun install  # or npm install

# Build the server
bun run build
```

## Configuration

### Environment Variables

Create a `.env` file in the project root:

```bash
# Required
LODGIFY_API_KEY=your_lodgify_api_key_here

# Optional MCPO settings
MCPO_PORT=8000
MCPO_API_KEY=your_mcpo_api_key
LOG_LEVEL=info
NODE_ENV=production
```

### Configuration Files

The project includes three MCPO configuration files:

#### 1. Production Configuration (`mcpo.config.json`)
```json
{
  "mcpServers": {
    "lodgify-mcp": {
      "command": "bun",
      "args": ["run", "start"],
      "env": {
        "LODGIFY_API_KEY": "your_lodgify_api_key_here",
        "LOG_LEVEL": "info"
      }
    }
  }
}
```

#### 2. Development Configuration (`mcpo.dev.json`)
```json
{
  "mcpServers": {
    "lodgify-mcp-dev": {
      "command": "bun",
      "args": ["run", "dev"],
      "env": {
        "LODGIFY_API_KEY": "your_lodgify_api_key_here",
        "LOG_LEVEL": "debug",
        "DEBUG_HTTP": "1"
      }
    }
  }
}
```

#### 3. Docker Configuration (`mcpo.docker.json`)
```json
{
  "mcpServers": {
    "lodgify-mcp-docker": {
      "command": "docker",
      "args": [
        "run", "--rm", "-i",
        "-e", "LODGIFY_API_KEY=your_lodgify_api_key_here",
        "-e", "LOG_LEVEL=info",
        "lodgify-mcp:latest",
        "node", "dist/server.js"
      ]
    }
  }
}
```

## Usage

### Local Development

#### 1. Using Startup Script (Recommended)

```bash
# Start with default configuration
./scripts/start-mcpo.sh

# Start with custom settings
./scripts/start-mcpo.sh -p 9000 -c mcpo.dev.json -d

# Windows users
.\scripts\start-mcpo.ps1 -Port 9000 -Config mcpo.dev.json -Debug
```

#### 2. Direct MCPO Command

```bash
# Start MCPO proxy
mcpo --port 8000 --api-key "your-api-key" --config mcpo.config.json

# With hot reload for development
mcpo --port 8000 --api-key "dev-key" --config mcpo.dev.json --hot-reload
```

#### 3. NPM/Bun Scripts

```bash
# Start MCPO proxy
bun run mcpo:start

# Start in development mode
bun run mcpo:dev

# Build Docker image with MCPO
bun run mcpo:docker:build

# Test MCPO endpoints
bun run mcpo:test
```

### Production Deployment

#### Option 1: Direct Deployment
```bash
# Set production environment variables
export LODGIFY_API_KEY=your_production_api_key
export MCPO_API_KEY=your_secure_mcpo_key

# Start MCPO with production config
mcpo --port 8000 --api-key "$MCPO_API_KEY" --config mcpo.config.json
```

#### Option 2: Docker Deployment (Recommended)
```bash
# Build MCPO-enabled image
docker build -f Dockerfile.mcpo -t lodgify-mcpo .

# Run with environment variables
docker run -d \
  --name lodgify-mcpo \
  -p 8000:8000 \
  -e LODGIFY_API_KEY=your_api_key \
  -e MCPO_API_KEY=your_mcpo_key \
  lodgify-mcpo:latest mcpo
```

## Docker Setup

### Docker Compose (Recommended)

#### Production Profile
```bash
# Start MCPO service
docker-compose -f docker-compose.mcpo.yml --profile mcpo up

# With override for development
docker-compose -f docker-compose.mcpo.yml -f docker-compose.mcpo.override.yml up
```

#### Development Profile
```bash
# Start development MCPO with hot reload
docker-compose -f docker-compose.mcpo.yml --profile mcpo-dev up

# Include Swagger UI for API docs
docker-compose -f docker-compose.mcpo.yml --profile docs up
```

### Multi-Stage Docker Build

The `Dockerfile.mcpo` uses a multi-stage build process:

1. **Stage 1**: Build Lodgify MCP Server (Bun/Node.js)
2. **Stage 2**: Install MCPO (Python)
3. **Stage 3**: Combine both in minimal runtime image

Benefits:
- **Smaller Images**: Only runtime dependencies included
- **Security**: Non-root user execution
- **Efficiency**: Optimized layer caching

## OpenWebUI Integration

### Setup Steps

1. **Install OpenWebUI**
   ```bash
   docker run -d --name open-webui -p 3000:8080 ghcr.io/open-webui/open-webui:main
   ```

2. **Start MCPO Proxy**
   ```bash
   docker run -d --name lodgify-mcpo -p 8000:8000 \
     -e LODGIFY_API_KEY=your_key \
     lodgify-mcpo:latest mcpo
   ```

3. **Configure OpenWebUI**
   - Navigate to OpenWebUI admin panel
   - Add external API: `http://localhost:8000`
   - Set API key if required
   - Enable Lodgify tools in chat interface

### Network Configuration

For Docker networking:
```yaml
# docker-compose.yml
networks:
  mcpo-openwebui:
    driver: bridge

services:
  lodgify-mcpo:
    networks:
      - mcpo-openwebui
    
  open-webui:
    networks:
      - mcpo-openwebui
    environment:
      - EXTERNAL_API_BASE_URL=http://lodgify-mcpo:8000
```

## API Documentation

### Interactive Documentation

Once MCPO is running, access interactive API documentation:

- **Swagger UI**: http://localhost:8000/docs
- **ReDoc**: http://localhost:8000/redoc (if available)
- **OpenAPI Spec**: http://localhost:8000/openapi.json

### Available Endpoints

MCPO automatically generates REST endpoints for all Lodgify MCP tools:

#### Property Management
- `POST /lodgify/list_properties` - List all properties
- `POST /lodgify/get_property` - Get property details
- `POST /lodgify/list_property_rooms` - List property room types
- `POST /lodgify/list_deleted_properties` - List deleted properties

#### Booking Management
- `POST /lodgify/list_bookings` - List bookings with filters
- `POST /lodgify/get_booking` - Get booking details
- `POST /lodgify/create_booking_payment_link` - Create payment link
- `POST /lodgify/update_key_codes` - Update access codes

#### Availability & Rates
- `POST /lodgify/check_next_availability` - Find next available dates
- `POST /lodgify/get_availability_calendar` - Get availability calendar
- `POST /lodgify/daily_rates` - Get daily rate information
- `POST /lodgify/get_quote` - Generate booking quotes

### Authentication

All endpoints require API key authentication:

```bash
curl -X POST "http://localhost:8000/lodgify/list_properties" \
  -H "Authorization: Bearer your-mcpo-api-key" \
  -H "Content-Type: application/json" \
  -d '{}'
```

## Troubleshooting

### Common Issues

#### 1. MCPO Not Starting

**Symptoms**: `mcpo: command not found`

**Solutions**:
```bash
# Install MCPO
pip install mcpo

# Or use uvx
uvx mcpo --version

# Check PATH
echo $PATH
which mcpo
```

#### 2. Lodgify MCP Server Connection Failed

**Symptoms**: HTTP 500 errors, "Failed to start MCP server"

**Diagnosis**:
```bash
# Test MCP server directly
bun run start

# Check configuration
cat mcpo.config.json

# Verify API key
echo $LODGIFY_API_KEY
```

**Solutions**:
- Verify `LODGIFY_API_KEY` is set and valid
- Check configuration file paths
- Ensure MCP server builds successfully
- Review logs: `tail -f logs/mcpo.log`

#### 3. API Key Authentication Failed

**Symptoms**: HTTP 401/403 responses

**Solutions**:
```bash
# Check MCPO API key
curl -H "Authorization: Bearer your-key" http://localhost:8000/docs

# Reset API key
export MCPO_API_KEY=new-secure-key
./scripts/start-mcpo.sh restart
```

#### 4. Port Already in Use

**Symptoms**: `Address already in use` error

**Solutions**:
```bash
# Check what's using port 8000
lsof -i :8000
netstat -tulpn | grep 8000

# Use different port
./scripts/start-mcpo.sh -p 8001

# Or stop conflicting service
./scripts/start-mcpo.sh stop
```

#### 5. Docker Issues

**Symptoms**: Container fails to start, network errors

**Solutions**:
```bash
# Check Docker logs
docker logs lodgify-mcpo

# Verify environment variables
docker exec lodgify-mcpo env | grep LODGIFY

# Check network connectivity
docker exec lodgify-mcpo curl -f http://localhost:8000/docs
```

### Debug Mode

Enable verbose logging:

```bash
# Environment variable
export LOG_LEVEL=debug
export DEBUG_HTTP=1

# Command line
./scripts/start-mcpo.sh -d

# Docker
docker run -e LOG_LEVEL=debug lodgify-mcpo
```

### Health Checks

Verify system health:

```bash
# Test script
./scripts/start-mcpo.sh test

# Manual checks
curl -f http://localhost:8000/health
curl -f http://localhost:8000/docs
curl -f http://localhost:8000/openapi.json

# Docker health check
docker inspect --format='{{.State.Health.Status}}' lodgify-mcpo
```

## Examples

### Basic REST API Usage

```javascript
// Example client usage
const baseUrl = 'http://localhost:8000';
const apiKey = 'your-mcpo-api-key';

// List properties
const response = await fetch(`${baseUrl}/lodgify/list_properties`, {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${apiKey}`,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({})
});

const properties = await response.json();
console.log('Properties:', properties);
```

### OpenWebUI Tool Usage

In OpenWebUI chat:
```
Please show me available properties using the Lodgify system.
```

The AI will automatically call the MCPO REST endpoint and display results.

### Advanced Configuration

```json
{
  "mcpServers": {
    "lodgify-mcp-advanced": {
      "command": "bun",
      "args": ["run", "start"],
      "env": {
        "LODGIFY_API_KEY": "your_key",
        "LOG_LEVEL": "info",
        "RATE_LIMIT_MAX": "100",
        "RATE_LIMIT_WINDOW": "3600"
      },
      "timeout": 30000,
      "retries": 3
    }
  }
}
```

## Performance Optimization

### Caching

Enable response caching:
```bash
mcpo --port 8000 --cache-ttl 300 --config mcpo.config.json
```

### Rate Limiting

Configure rate limits:
```json
{
  "rateLimit": {
    "windowMs": 900000,
    "max": 100
  }
}
```

### Monitoring

Monitor MCPO performance:
- Response times via `/metrics` endpoint
- Health status via `/health`
- Logs in `logs/mcpo.log`

## Security Considerations

1. **API Key Management**
   - Use strong, unique API keys
   - Rotate keys regularly
   - Store securely (environment variables, secrets management)

2. **Network Security**
   - Use HTTPS in production
   - Implement firewall rules
   - Consider VPN or private networks

3. **Access Control**
   - Restrict API access by IP if possible
   - Monitor access logs
   - Implement request logging

4. **Container Security**
   - Run as non-root user (already implemented)
   - Use minimal base images
   - Regular security updates

---

**Next Steps**: After setting up MCPO, see the [examples/mcpo-client.js](../examples/mcpo-client.js) for practical usage examples.