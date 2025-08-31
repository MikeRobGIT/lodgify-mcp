# Lodgify MCP Server

[![npm version](https://badge.fury.io/js/%40mikerob%2Flodgify-mcp.svg)](https://www.npmjs.com/package/@mikerob/lodgify-mcp)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![CI](https://github.com/MikeRobGIT/lodgify-mcp/actions/workflows/ci.yml/badge.svg)](https://github.com/MikeRobGIT/lodgify-mcp/actions)
[![MCP Compatible](https://img.shields.io/badge/MCP-Compatible-purple.svg)](https://modelcontextprotocol.io)

A Model Context Protocol (MCP) server that connects AI assistants like Claude to the Lodgify property management API. Get instant access to your properties, bookings, availability, and rates through natural language.

## Quick Start

### Installation with Bunx (Recommended)

The fastest way to get started - no local installation required:

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

### Alternative with NPX

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

### Environment Configuration

Required environment variable:

```env
LODGIFY_API_KEY="your_lodgify_api_key_here"
```

Optional settings:

```env
LODGIFY_READ_ONLY="1"   # Prevent write operations (recommended for testing)
LOG_LEVEL="info"        # Options: error | warn | info | debug
DEBUG_HTTP="0"          # Set to "1" for verbose HTTP debugging
```

## What You Can Do

Ask Claude natural language questions about your Lodgify properties:

### 🏨 Property Management
- "Show me all my properties"
- "Get details about Ocean View Villa"
- "What room types are available in my beach house?"

### 📅 Availability & Bookings
- "When is the Beach House next available?"
- "Show me all bookings for November"
- "Is property 123 available December 20-27?"
- "Get details for booking BK-2024-001"

### 💰 Rates & Pricing
- "What are the daily rates for Ocean View Villa in December?"
- "Get a quote for 4 adults from Dec 20-27"
- "Show me current rate settings for property 123"

### 🔧 Management Tasks
- "Create a payment link for the Smith booking"
- "Update key codes for reservation BK001"
- "Show me a calendar view of availability for next month"

## Features

- **🚀 Zero Installation**: Run directly with `bunx` - no local setup required
- **🔧 20+ API Tools**: Complete property management, bookings, and availability
- **🛡️ Read-Only Mode**: Safe testing with write operation protection
- **📝 Type-Safe**: Full TypeScript with input validation
- **🔄 Smart Retries**: Automatic rate limit handling with exponential backoff
- **📊 Comprehensive**: Properties, bookings, availability, rates, quotes, and more

## Documentation

📚 **[Complete API Reference →](docs/API_REFERENCE.md)** - All tools with parameters and examples

📖 **[Installation Guide →](docs/INSTALLATION.md)** - Docker, source, and global installation options

🔧 **[Development Setup →](docs/DEVELOPMENT.md)** - Contributing, testing, and architecture

🔒 **[Security Guide →](docs/SECURITY.md)** - API key management and best practices

🐛 **[Troubleshooting →](docs/TROUBLESHOOTING.md)** - Common issues and debugging

📋 **[Tool Catalog →](docs/TOOL_CATALOG.md)** - Complete tool reference

🏗️ **[Architecture →](docs/MODULAR_ARCHITECTURE.md)** - System design and patterns

## Support

- **GitHub Issues**: [Report bugs or request features](https://github.com/mikerobgit/lodgify-mcp/issues)
- **Lodgify API Docs**: [https://docs.lodgify.com](https://docs.lodgify.com)
- **MCP Protocol**: [https://modelcontextprotocol.io](https://modelcontextprotocol.io)

## License

MIT License - see [LICENSE](LICENSE) file for details

---

Built with ❤️ for the [Model Context Protocol](https://modelcontextprotocol.io) community