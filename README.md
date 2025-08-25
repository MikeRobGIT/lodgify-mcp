# Lodgify MCP Server

[![npm version](https://badge.fury.io/js/lodgify-mcp.svg)](https://www.npmjs.com/package/lodgify-mcp)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

A Model Context Protocol (MCP) server that exposes Lodgify Public API v2 endpoints as tools for AI assistants like Claude. Built using the high-level McpServer SDK with enhanced metadata, capabilities declaration, and robust error handling.

## Quick Start

### Installation

```bash
# Using bun (recommended)
bun add lodgify-mcp

# Using npm
npm install lodgify-mcp

# Using yarn
yarn add lodgify-mcp
```

### Configuration

Configure your MCP client (like Claude Desktop) to connect to the Lodgify MCP Server:

#### Bun Installation (Recommended - Fastest)

```json
{
  "mcpServers": {
    "lodgify": {
      "command": "bunx",
      "args": ["-y", "lodgify-mcp"],
      "env": {
        "LODGIFY_API_KEY": "your_lodgify_api_key_here"
      }
    }
  }
}
```

#### NPM Installation

```json
{
  "mcpServers": {
    "lodgify": {
      "command": "npx",
      "args": ["-y", "lodgify-mcp"],
      "env": {
        "LODGIFY_API_KEY": "your_lodgify_api_key_here"
      }
    }
  }
}
```

📦 **[Alternative Installation Methods →](#alternative-installation-methods)** - Docker, direct from GitHub, and global installation options

#### Global Installation

```bash
# Install globally with bun
bun install -g lodgify-mcp

# Or with npm
npm install -g lodgify-mcp

# Then use in MCP config:
```

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

### Environment Variables

The server requires the following environment variables:

```env
# Required
LODGIFY_API_KEY="your_lodgify_api_key_here"

# Optional
LOG_LEVEL="info"        # Options: error | warn | info | debug
DEBUG_HTTP="0"          # Set to "1" for verbose HTTP debugging
```

The MCP server will automatically use the appropriate Lodgify API endpoints and return structured data that Claude can interpret and present in a user-friendly format.

## Features

- **🔧 15+ Lodgify API Tools**: Property management, bookings, availability, rates, quotes, and messaging
- **🔄 Automatic Retry Logic**: Smart handling of rate limits with exponential backoff
- **📝 Type-Safe**: Full TypeScript support with Zod validation
- **🛡️ Robust Error Handling**: Structured error responses with detailed context
- **📊 Configurable Logging**: Multiple log levels for debugging and monitoring
- **🚀 Modern Runtime**: Support for both Node.js 18+ and Bun 1.0+

## Available Tools

The server exposes the following Lodgify API endpoints as MCP tools:

### Property Management

- `lodgify_list_properties` - List all properties with filtering
- `lodgify_get_property` - Get detailed property information
- `lodgify_list_property_rooms` - List room types for a property
- `lodgify_list_deleted_properties` - List soft-deleted properties

### Booking Management

- `lodgify_list_bookings` - List all bookings with comprehensive filtering
- `lodgify_get_booking` - Get detailed booking information
- `lodgify_get_booking_payment_link` - Retrieve payment link for booking
- `lodgify_create_booking_payment_link` - Generate payment link
- `lodgify_update_key_codes` - Update access key codes

### Availability & Rates

- `lodgify_availability_property` - Check property availability
- `lodgify_availability_room` - Check room availability
- `lodgify_daily_rates` - Get daily pricing calendar
- `lodgify_rate_settings` - Get rate configuration

### Quotes & Messaging

- `lodgify_get_quote` - Generate detailed pricing quotes
- `lodgify_get_thread` - Retrieve messaging conversation

### Resources

- `lodgify://health` - Health check resource

## Example Prompts

Try these example prompts to interact with your Lodgify properties:

### 🔍 Property Discovery & Information

- "Show me all my properties"
- "Find properties with 'beach' in the name"
- "What properties do I have in Miami?"
- "Get details about my Beach House property"
- "Show me the rooms available in Ocean View Villa"
- "List any deleted properties in my account"

### 📅 Availability Management

- "When is the Beach House next available?"
- "Is Ocean View Villa available from December 20-27?"
- "Show me a calendar view of availability for my Miami property for the next 30 days"
- "Check if Sunset Cottage is available for Christmas week"
- "Find the next 7-day opening for the Lakefront Cabin"
- "What dates are blocked for my beachfront property in December?"

### 📋 Booking Operations

- "Show me all bookings for November"
- "List confirmed bookings for the Beach House"
- "Get details for booking BK-2024-001"
- "Create a booking for Ocean View Villa from Dec 15-20 for 2 adults and 1 child"
- "Update booking BK-2024-001 to add one more guest"
- "Generate a payment link for the Smith family booking"
- "Cancel the Johnson reservation"
- "Update the key code for the upcoming Wilson booking to 4567"

### 💰 Pricing & Rates

- "Get a quote for the Beach House from Dec 20-27 for 4 adults"
- "Show me the daily rates for Ocean View Villa in December"
- "Update rates for Sunset Cottage to $200/night for Christmas week"
- "Set holiday rates of $250/night from Dec 23-Jan 2 for the Lakefront Cabin"
- "What are the current rate settings for my Miami property?"
- "Calculate total cost for 5 nights at the Penthouse Suite for 2 adults with fees"

### 🚫 Blocking & Maintenance

- "Block the Beach House from Jan 10-15 for maintenance"
- "Make Ocean View Villa unavailable for the last week of January"
- "Set minimum stay to 3 nights for Sunset Cottage during December"
- "Update the Lakefront Cabin to require 7-night minimum for Christmas week"

### 📊 Reporting & Analytics

- "Show me all bookings arriving this week"
- "List bookings checking out today"
- "What bookings do I have for the holiday season?"
- "Show me upcoming arrivals for the next 7 days"
- "Get all bookings with payment pending"

### 🔧 Complex Workflows

- "Check availability for Beach House next week, and if available, create a quote for 2 adults"
- "Find my most popular property and show its availability for next month"
- "List all properties, then check which ones are available for New Year's Eve"
- "Show me properties with upcoming bookings in the next 30 days"
- "Find properties that are currently available and show their rates"

### 💡 Tips for Better Results

- Use property names naturally - the system will find them for you
- Specify date ranges in YYYY-MM-DD format for best compatibility
- If multiple properties have similar names, be specific (e.g., "Miami Beach House" vs "California Beach House")
- Check availability before attempting to create bookings
- Use specific status filters (confirmed, pending, cancelled) when listing bookings

## Documentation

📚 **[Tool Catalog →](https://github.com/mikerobgit/lodgify-mcp/blob/main/docs/TOOL_CATALOG.md)** - Complete API reference with parameters and examples

📖 **[Error Handling →](https://github.com/mikerobgit/lodgify-mcp/blob/main/docs/ERROR_HANDLING.md)** - JSON-RPC error codes, validation, and debugging

🔒 **[Security Best Practices →](https://github.com/mikerobgit/lodgify-mcp/blob/main/docs/SECURITY.md)** - API key management, deployment security, and compliance

🔧 **[Troubleshooting Guide →](https://github.com/mikerobgit/lodgify-mcp/blob/main/docs/TROUBLESHOOTING.md)** - Common issues, logging, and debugging tips

## Development

### Running from Source

```bash
# Clone the repository
git clone https://github.com/mikerobgit/lodgify-mcp
cd lodgify-mcp

# Install dependencies
bun install  # or npm install

# Setup environment
cp .env.example .env
# Edit .env and add your LODGIFY_API_KEY

# Build the project
bun run build  # or npm run build

# Run the server
bun start  # or npm start
```

### Testing

```bash
# Run all tests
bun test

# Run with coverage
bun test --coverage

# Watch mode
bun test --watch
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

## Alternative Installation Methods

### Docker

The server is also available as a Docker image for containerized deployments:

```bash
# Using pre-built image
docker run -i \
  -e LODGIFY_API_KEY="your_api_key_here" \
  ghcr.io/mikerobgit/lodgify-mcp:latest
```

For Docker configuration in MCP clients:

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

### Direct from GitHub

```bash
# Clone and install
git clone https://github.com/mikerobgit/lodgify-mcp
cd lodgify-mcp
npm install
npm run build

# Use in MCP config with absolute path
```

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

## Advanced Features

### MCPO REST API Integration

Transform the MCP server into a REST API with OpenAPI documentation using MCPO. This enables compatibility with services like OpenWebUI. See [MCPO Integration Guide](https://github.com/mikerobgit/lodgify-mcp/blob/main/docs/MCPO_INTEGRATION.md) for details.

### Complex Query Parameters

The server supports Lodgify's bracket notation for complex nested parameters:

```javascript
// Example: Complex room and guest parameters
params = {
  "roomTypes[0].Id": 123,
  "guest_breakdown[adults]": 2,
  "guest_breakdown[children]": 1
}
```

### Rate Limiting

Automatic retry logic with exponential backoff:

- Detects 429 responses
- Respects `Retry-After` header
- Maximum 5 retry attempts
- Exponential backoff up to 30 seconds

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

MIT License - see [LICENSE](LICENSE) file for details

## Support

For issues and questions:

- **GitHub Issues**: [Report bugs or request features](https://github.com/mikerobgit/lodgify-mcp/issues)
- **Lodgify API Documentation**: [https://docs.lodgify.com](https://docs.lodgify.com)
- **MCP Documentation**: [https://modelcontextprotocol.io](https://modelcontextprotocol.io)

## Acknowledgments

- Built with the [Model Context Protocol SDK](https://github.com/modelcontextprotocol/sdk)
- Powered by [Lodgify Public API v2](https://docs.lodgify.com)
- TypeScript support with [Zod](https://github.com/colinhacks/zod) validation
