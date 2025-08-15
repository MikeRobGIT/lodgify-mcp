# Lodgify MCP Server

A Model Context Protocol (MCP) server that exposes Lodgify Public API v2 endpoints as tools for AI assistants like Claude. Built using the high-level McpServer SDK with enhanced metadata, capabilities declaration, and robust error handling.

## Configuration

### MCP Client Configuration

Configure your MCP client (like Claude Desktop) to connect to the Lodgify MCP Server. Choose one of the following methods:

#### Method 1: Docker (Recommended)

Use the pre-built Docker image from GitHub Container Registry:

```json
{
  "mcpServers": {
    "lodgify": {
      "command": "docker",
      "args": [
        "run",
        "--rm",
        "-i",
        "-e", "LODGIFY_API_KEY=your_api_key_here",
        "-e", "LOG_LEVEL=info",
        "ghcr.io/mikerobgit/lodgify-mcp:latest"
      ]
    }
  }
}
```

#### Method 2: Local Docker Build

If you've built the image locally:

```json
{
  "mcpServers": {
    "lodgify": {
      "command": "docker",
      "args": [
        "run",
        "--rm",
        "-i",
        "--env-file", "/absolute/path/to/.env",
        "lodgify-mcp:latest"
      ]
    }
  }
}
```

#### Method 3: Direct Bun

If you're using Bun runtime:

```json
{
  "mcpServers": {
    "lodgify": {
      "command": "bun",
      "args": ["run", "/absolute/path/to/lodgify-mcp/dist/server.js"],
      "env": {
        "LODGIFY_API_KEY": "your_lodgify_api_key_here"
      }
    }
  }
}
```

#### Method 4: Direct Node.js

If you've installed and built the server locally:

```json
{
  "mcpServers": {
    "lodgify": {
      "command": "node",
      "args": ["/absolute/path/to/lodgify-mcp/dist/server.js"],
      "env": {
        "LODGIFY_API_KEY": "your_lodgify_api_key_here"
      }
    }
  }
}
```

**Note**: Replace `/absolute/path/to/lodgify-mcp/` with the actual absolute path to your installation directory.

### Environment Variables

Create a `.env` file with the following variables:

```env
# Required
LODGIFY_API_KEY="your_lodgify_api_key_here"

# Optional
LOG_LEVEL="info"        # Options: error | warn | info | debug
DEBUG_HTTP="0"          # Set to "1" for verbose HTTP debugging
```

## Installation

### Using Docker (Recommended)

The easiest way to run the Lodgify MCP Server is using Docker:

```bash
# Quick start with Docker
docker run -p 3000:3000 \
  -e LODGIFY_API_KEY="your_api_key_here" \
  ghcr.io/mikerobgit/lodgify-mcp:latest
```

### Using Docker Compose

For development and production deployments:

```bash
# Clone the repository
git clone https://github.com/mikerobgit/lodgify-mcp
cd lodgify-mcp

# Setup environment
cp .env.example .env
# Edit .env and add your LODGIFY_API_KEY

# Development mode (with hot reload)
docker-compose --profile dev up

# Production mode
docker-compose --profile production up -d

# View logs
docker-compose logs -f lodgify-mcp
```

### Using Bun

```bash
bun install
cp .env.example .env
# Edit .env and add your LODGIFY_API_KEY
bun run build
bun start
```

## Development

### Docker Development

#### Building the Image

```bash
# Build for local development
docker build -t lodgify-mcp:latest .

# Build with specific port
docker build --build-arg PORT=8080 -t lodgify-mcp:latest .

# Multi-platform build (for M1 Macs and Linux)
docker buildx build --platform linux/amd64,linux/arm64 -t lodgify-mcp:latest .
```

#### Running Containers

```bash
# Run with environment file
docker run -p 3000:3000 --env-file .env lodgify-mcp:latest

# Run with individual environment variables
docker run -p 3000:3000 \
  -e LODGIFY_API_KEY="your_api_key" \
  -e LOG_LEVEL=debug \
  -e DEBUG_HTTP=1 \
  lodgify-mcp:latest

# Run in detached mode with auto-restart
docker run -d \
  --name lodgify-mcp \
  --restart unless-stopped \
  -p 3000:3000 \
  --env-file .env \
  lodgify-mcp:latest

# Check container health
docker inspect --format='{{.State.Health.Status}}' lodgify-mcp

# View container logs
docker logs -f lodgify-mcp
```

#### Docker Compose Commands

```bash
# Start development environment
docker-compose --profile dev up

# Start production environment
docker-compose --profile production up -d

# Rebuild and start
docker-compose --profile dev up --build

# Stop all services
docker-compose down

# Remove volumes and networks
docker-compose down -v

# View service logs
docker-compose logs -f lodgify-mcp-dev

# Execute commands in running container
docker-compose exec lodgify-mcp-dev sh

# Check service health
docker-compose ps
```

#### Debugging Docker Issues

```bash
# Check environment variables
docker run --rm lodgify-mcp:latest env

# Run with shell for debugging
docker run -it --entrypoint sh lodgify-mcp:latest

# Validate environment before starting
docker run --rm --env-file .env lodgify-mcp:latest /app/scripts/env-check.sh

# Check container resource usage
docker stats lodgify-mcp

# Inspect image layers
docker history lodgify-mcp:latest
```

### Running Tests

Tests are written using Bun's built-in test runner.

```bash
# Run all tests
bun test

# Run with coverage
bun test --coverage

# Watch mode
bun test --watch

# Run specific test file
bun test lodgify.test.ts

# Run tests matching a pattern
bun test --test-name-pattern "429 retry"
```

### Linting and Formatting

```bash
# Check code style
npm run lint

# Format code
npm run format

# Type checking
npm run typecheck
```

### Building

```bash
# Compile TypeScript
npm run build

# Development mode (with hot reload)
npm run dev
```

## Documentation

📚 **[Tool Catalog →](docs/TOOL_CATALOG.md)** - Complete API reference with parameters and examples

📖 **[Error Handling →](docs/ERROR_HANDLING.md)** - JSON-RPC error codes, validation, and debugging

🔒 **[Security Best Practices →](docs/SECURITY.md)** - API key management, deployment security, and compliance

🔧 **[Troubleshooting Guide →](docs/TROUBLESHOOTING.md)** - Common issues, logging, and debugging tips

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## License

MIT License - see LICENSE file for details

## Support

For issues and questions:

- GitHub Issues: [Report bugs or request features](https://github.com/mikerobgit/lodgify-mcp/issues)
- Lodgify API Documentation: [https://docs.lodgify.com](https://docs.lodgify.com)
- MCP Documentation: [https://modelcontextprotocol.io](https://modelcontextprotocol.io)
