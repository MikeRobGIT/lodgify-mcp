# Installation Guide

This guide covers all installation methods for the Lodgify MCP Server, from the simplest bunx usage to advanced deployment scenarios.

## Quick Installation (Recommended)

The fastest way to get started is using `bunx` or `npx` without any local installation:

### Bun (Fastest)

```json
{
  "mcpServers": {
    "lodgify": {
      "command": "bunx",
      "args": ["-y", "@mikerob/lodgify-mcp"],
      "env": {
        "LODGIFY_API_KEY": "your_lodgify_api_key_here"
      }
    }
  }
}
```

### NPM

```json
{
  "mcpServers": {
    "lodgify": {
      "command": "npx",
      "args": ["-y", "@mikerob/lodgify-mcp"],
      "env": {
        "LODGIFY_API_KEY": "your_lodgify_api_key_here"
      }
    }
  }
}
```

## Package Manager Installation

Install the package locally for better performance and version control:

### Using Bun

```bash
# Install locally
bun add @mikerob/lodgify-mcp

# Or install globally
bun install -g @mikerob/lodgify-mcp
```

### Using NPM

```bash
# Install locally
npm install @mikerob/lodgify-mcp

# Or install globally
npm install -g @mikerob/lodgify-mcp
```

### Using Yarn

```bash
# Install locally
yarn add @mikerob/lodgify-mcp

# Or install globally
yarn global add @mikerob/lodgify-mcp
```

### Using PNPM

```bash
# Install locally
pnpm add @mikerob/lodgify-mcp

# Or install globally
pnpm add -g @mikerob/lodgify-mcp
```

## Global Installation Configuration

After global installation, use the simplified command in your MCP configuration:

```json
{
  "mcpServers": {
    "lodgify": {
      "command": "lodgify-mcp",
      "env": {
        "LODGIFY_API_KEY": "your_lodgify_api_key_here"
      }
    }
  }
}
```

## Docker Installation

The server is available as a Docker image for containerized deployments:

### Pre-built Docker Image

```bash
# Pull and run
docker pull ghcr.io/mikerobgit/lodgify-mcp:latest

# Run interactively
docker run -i \
  -e LODGIFY_API_KEY="your_api_key_here" \
  ghcr.io/mikerobgit/lodgify-mcp:latest
```

### Docker Configuration in MCP

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
        "ghcr.io/mikerobgit/lodgify-mcp:latest"
      ]
    }
  }
}
```

### Custom Docker Build

```bash
# Clone and build
git clone https://github.com/mikerobgit/lodgify-mcp
cd lodgify-mcp

# Build image
docker build -t lodgify-mcp .

# Run custom image
docker run -i \
  -e LODGIFY_API_KEY="your_api_key_here" \
  lodgify-mcp
```

## Source Installation

Install directly from the GitHub repository for the latest development version:

### Clone and Install

```bash
# Clone repository
git clone https://github.com/mikerobgit/lodgify-mcp
cd lodgify-mcp

# Install dependencies
bun install  # or npm install

# Build the project
bun run build  # or npm run build
```

### Source Configuration

Use absolute paths in your MCP configuration:

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

### Using Bun Runtime

```json
{
  "mcpServers": {
    "lodgify": {
      "command": "bun",
      "args": ["/absolute/path/to/lodgify-mcp/src/server.ts"],
      "env": {
        "LODGIFY_API_KEY": "your_lodgify_api_key_here"
      }
    }
  }
}
```

## Environment Configuration

All installation methods support the same environment variables:

### Required Variables

```env
LODGIFY_API_KEY="your_lodgify_api_key_here"
```

### Optional Variables

```env
# Logging
LOG_LEVEL="info"        # Options: error | warn | info | debug
DEBUG_HTTP="0"          # Set to "1" for verbose HTTP debugging

# Security
LODGIFY_READ_ONLY="0"   # Set to "1" to disable all write operations

# Performance
REQUEST_TIMEOUT="30000" # Request timeout in milliseconds
RETRY_ATTEMPTS="5"      # Maximum retry attempts for failed requests
```

## MCP Client Configuration

### Claude Desktop

Add to `%APPDATA%\Claude\claude_desktop_config.json` (Windows) or `~/Library/Application Support/Claude/claude_desktop_config.json` (Mac):

```json
{
  "mcpServers": {
    "lodgify": {
      "command": "bunx",
      "args": ["-y", "@mikerob/lodgify-mcp"],
      "env": {
        "LODGIFY_API_KEY": "your_lodgify_api_key_here"
      }
    }
  }
}
```

### Continue (VS Code Extension)

Add to your Continue configuration:

```json
{
  "mcpServers": [
    {
      "name": "lodgify",
      "command": "bunx",
      "args": ["-y", "@mikerob/lodgify-mcp"],
      "env": {
        "LODGIFY_API_KEY": "your_lodgify_api_key_here"
      }
    }
  ]
}
```

### Custom MCP Client

For other MCP clients, use the stdio transport with the appropriate command:

```typescript
import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js'

const transport = new StdioClientTransport({
  command: 'bunx',
  args: ['-y', '@mikerob/lodgify-mcp'],
  env: {
    LODGIFY_API_KEY: 'your_lodgify_api_key_here'
  }
})

const client = new Client(
  { name: 'lodgify-client', version: '1.0.0' },
  { capabilities: {} }
)

await client.connect(transport)
```

## Installation Verification

### Health Check

After installation, verify the server is working:

```bash
# If installed globally
echo '{"jsonrpc": "2.0", "id": 1, "method": "tools/list"}' | lodgify-mcp

# If using bunx
echo '{"jsonrpc": "2.0", "id": 1, "method": "tools/list"}' | bunx -y @mikerob/lodgify-mcp

# If using Docker
echo '{"jsonrpc": "2.0", "id": 1, "method": "tools/list"}' | docker run -i --rm -e LODGIFY_API_KEY="test" ghcr.io/mikerobgit/lodgify-mcp:latest
```

### Expected Response

You should see a list of available tools:

```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "result": {
    "tools": [
      {
        "name": "lodgify_list_properties",
        "description": "List all properties with optional filtering and pagination"
      },
      // ... more tools
    ]
  }
}
```

## Troubleshooting Installation

### Common Issues

#### Permission Errors
```bash
# Fix npm permissions
npm config set prefix ~/.npm-global
export PATH=~/.npm-global/bin:$PATH

# Or use sudo (not recommended)
sudo npm install -g @mikerob/lodgify-mcp
```

#### Bun Not Found
```bash
# Install Bun
curl -fsSL https://bun.sh/install | bash

# Or using npm
npm install -g bun
```

#### Docker Permission Issues
```bash
# Add user to docker group (Linux)
sudo usermod -aG docker $USER

# Or use sudo
sudo docker run -i -e LODGIFY_API_KEY="test" ghcr.io/mikerobgit/lodgify-mcp:latest
```

#### Network Issues
```bash
# Configure npm registry
npm config set registry https://registry.npmjs.org/

# Configure proxy if needed
npm config set proxy http://proxy.company.com:8080
npm config set https-proxy http://proxy.company.com:8080
```

### Version Conflicts

Check installed versions:

```bash
# Global installations
npm list -g @mikerob/lodgify-mcp
bun list -g @mikerob/lodgify-mcp

# Local installations
npm list @mikerob/lodgify-mcp
bun list @mikerob/lodgify-mcp
```

Update to latest version:

```bash
# NPX/Bunx (always uses latest)
bunx -y @mikerob/lodgify-mcp  # automatically updates

# Global update
npm update -g @mikerob/lodgify-mcp
bun install -g @mikerob/lodgify-mcp

# Local update
npm update @mikerob/lodgify-mcp
bun update @mikerob/lodgify-mcp
```

### Clean Installation

Remove existing installation:

```bash
# Global removal
npm uninstall -g @mikerob/lodgify-mcp
bun remove -g @mikerob/lodgify-mcp

# Local removal
npm uninstall @mikerob/lodgify-mcp
bun remove @mikerob/lodgify-mcp

# Clean npm cache
npm cache clean --force

# Clean bun cache
bun cache clean
```

## Advanced Installation Scenarios

### Behind Corporate Firewall

Configure package managers for corporate environments:

```bash
# NPM configuration
npm config set registry http://internal-npm-registry.company.com/
npm config set proxy http://proxy.company.com:8080
npm config set https-proxy http://proxy.company.com:8080

# Bun configuration
export https_proxy=http://proxy.company.com:8080
export http_proxy=http://proxy.company.com:8080
```

### Air-Gapped Environments

For environments without internet access:

1. Download the package on a connected machine:
   ```bash
   npm pack @mikerob/lodgify-mcp
   ```

2. Transfer the `.tgz` file to the air-gapped environment

3. Install from local file:
   ```bash
   npm install -g ./mikerob-lodgify-mcp-*.tgz
   ```

### Multi-Version Management

Use different versions for different projects:

```bash
# Install specific version
npm install @mikerob/lodgify-mcp@0.1.9

# Use specific version with npx
npx @mikerob/lodgify-mcp@0.1.9

# Use specific version with bunx  
bunx @mikerob/lodgify-mcp@0.1.9
```

## Performance Considerations

### Installation Method Performance

| Method | Startup Time | Memory Usage | Best For |
|--------|-------------|--------------|----------|
| bunx | ~100ms | Low | Development, testing |
| npx | ~200ms | Medium | General use |
| Global npm | ~50ms | Low | Production, frequent use |
| Docker | ~500ms | High | Containerized deployments |
| Source | ~50ms | Low | Development, customization |

### Optimization Tips

1. **Use bunx for fastest startup** - Bun's runtime is significantly faster than Node.js
2. **Global installation for production** - Avoids download time on each startup
3. **Docker for isolation** - Best for production deployments with multiple services
4. **Source for development** - Hot reload and debugging capabilities

## Support

For installation issues:

- **GitHub Issues**: [Installation problems](https://github.com/mikerobgit/lodgify-mcp/issues)
- **Package Page**: [NPM package details](https://www.npmjs.com/package/@mikerob/lodgify-mcp)
- **Docker Hub**: [Container registry](https://github.com/mikerobgit/lodgify-mcp/pkgs/container/lodgify-mcp)
- **Documentation**: [Full documentation](https://github.com/mikerobgit/lodgify-mcp/tree/main/docs)