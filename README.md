# Lodgify MCP Server

[![npm version](https://badge.fury.io/js/%40mikerob%2Flodgify-mcp.svg)](https://www.npmjs.com/package/@mikerob/lodgify-mcp)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![CI](https://github.com/MikeRobGIT/lodgify-mcp/actions/workflows/ci.yml/badge.svg)](https://github.com/MikeRobGIT/lodgify-mcp/actions)
[![npm downloads](https://img.shields.io/npm/dm/%40mikerob%2Flodgify-mcp)](https://www.npmjs.com/package/@mikerob/lodgify-mcp)
[![npm bundle size](https://img.shields.io/bundlephobia/minzip/%40mikerob%2Flodgify-mcp)](https://bundlephobia.com/package/@mikerob/lodgify-mcp)
[![node-current](https://img.shields.io/node/v/%40mikerob%2Flodgify-mcp)](https://www.npmjs.com/package/@mikerob/lodgify-mcp)

[![GitHub stars](https://img.shields.io/github/stars/MikeRobGIT/lodgify-mcp?style=social)](https://github.com/MikeRobGIT/lodgify-mcp)
[![GitHub issues](https://img.shields.io/github/issues/MikeRobGIT/lodgify-mcp)](https://github.com/MikeRobGIT/lodgify-mcp/issues)
[![PRs Welcome](https://img.shields.io/badge/PRs-welcome-brightgreen.svg)](https://github.com/MikeRobGIT/lodgify-mcp/pulls)
[![MCP Compatible](https://img.shields.io/badge/MCP-Compatible-purple.svg)](https://modelcontextprotocol.io)
[![TypeScript](https://img.shields.io/badge/TypeScript-Ready-blue.svg)](https://www.typescriptlang.org/)

A Model Context Protocol (MCP) server that exposes Lodgify Public API endpoints as tools for AI assistants like Claude. Built with a modular architecture using the registry pattern, featuring 15+ focused modules, centralized error handling, and comprehensive type safety.

## Read-Only Mode Enforcement

The Lodgify MCP server includes comprehensive read-only mode enforcement to prevent accidental or unauthorized write operations. When enabled, all write operations (POST, PUT, PATCH, DELETE) are blocked before any network requests are made.

### Enabling Read-Only Mode

**Environment Variable:**

```bash
LODGIFY_READ_ONLY=1
```

**Constructor Parameter:**

```typescript
const client = new LodgifyOrchestrator({
  apiKey: 'your-api-key',
  readOnly: true
})
```

### Protected Operations

The following operations are blocked in read-only mode:

- Creating, updating, or deleting bookings
- Creating or updating rates
- Subscribing/unsubscribing to webhooks
- Sending messages or updating thread status
- Updating property availability settings
- All V1 API write operations

### Allowed Operations

Read operations are always allowed:

- Listing properties, bookings, and webhooks
- Getting property details, booking information, and rates
- Checking availability and getting quotes
- Retrieving message threads and payment links

### Error Handling

When a write operation is attempted in read-only mode, a `ReadOnlyModeError` is thrown with:

- Status code 403 (Forbidden)
- Clear explanation of the restriction
- Guidance on how to enable write mode

For detailed information, see [Security Documentation](docs/SECURITY.md).

## Quick Start

### Installation

```bash
# Using bun (recommended)
bun add @mikerob/lodgify-mcp

# Using npm
npm install @mikerob/lodgify-mcp

# Using yarn
yarn add @mikerob/lodgify-mcp
```

### Configuration

Configure your MCP client (like Claude Desktop) to connect to the Lodgify MCP Server:

#### Bun Installation (Recommended - Fastest)

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

#### NPM Installation

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

📦 **[Alternative Installation Methods →](#alternative-installation-methods)** - Docker, direct from GitHub, and global installation options

#### Global Installation

```bash
# Install globally with bun
bun install -g @mikerob/lodgify-mcp

# Or with npm
npm install -g @mikerob/lodgify-mcp

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
LODGIFY_READ_ONLY="0"   # Set to "1" to disable all write operations (POST/PUT/DELETE)
```

#### Read-Only Mode

Setting `LODGIFY_READ_ONLY="1"` enables read-only mode, which:

- Blocks all write operations (POST, PUT, DELETE requests)
- Only allows safe read operations (GET requests)
- Returns helpful error messages for blocked operations
- Ideal for demo environments, testing, or when you want to prevent accidental data modifications

Read-only mode affects these tools:

- `lodgify_create_booking` - Blocked (creates new bookings)
- `lodgify_update_booking` - Blocked (modifies existing bookings)
- `lodgify_delete_booking` - Blocked (deletes bookings)
- `lodgify_create_rate` - Blocked (creates new rates)
- `lodgify_update_rate` - Blocked (modifies existing rates)
- `lodgify_create_booking_payment_link` - Blocked (creates payment links)
- `lodgify_update_key_codes` - Blocked (updates access codes)
- `lodgify_update_property_availability` - Blocked (modifies availability)
- `lodgify_subscribe_webhook` - Blocked (creates webhook subscriptions)
- `lodgify_delete_webhook` - Blocked (deletes webhook subscriptions)

All read operations (list properties, get bookings, check availability, etc.) continue to work normally.

The MCP server will automatically use the appropriate Lodgify API endpoints and return structured data that Claude can interpret and present in a user-friendly format.

## Features

- **🔧 20+ Lodgify API Tools**: Property management, bookings, availability, rates, quotes, and messaging
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
- `lodgify_find_properties` - Search properties by name or get property IDs from bookings
- `lodgify_list_deleted_properties` - List soft-deleted properties

### Booking Management

- `lodgify_list_bookings` - List all bookings with comprehensive filtering
- `lodgify_get_booking` - Get detailed booking information
- `lodgify_get_booking_payment_link` - Retrieve payment link for booking
- `lodgify_create_booking_payment_link` - Generate payment link
- `lodgify_update_key_codes` - Update access key codes
- `lodgify_create_booking` - Create new bookings (v1 API)
- `lodgify_update_booking` - Update existing bookings (v1 API)
- `lodgify_delete_booking` - Delete bookings (v1 API)

### Availability & Rates

- `lodgify_check_next_availability` - Find next available dates for a property
- `lodgify_check_date_range_availability` - Check if specific dates are available
- `lodgify_get_availability_calendar` - Get visual calendar view of availability
- `lodgify_daily_rates` - Get daily pricing calendar
- `lodgify_rate_settings` - Get rate configuration
- `lodgify_update_rates` - Update property rates (v1 API)

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
- "Generate a payment link for the Smith family booking"
- "Update the key code for the upcoming Wilson booking to 4567"

### 💰 Pricing & Rates

- "Get a quote for the Beach House from Dec 20-27 for 4 adults"
- "Show me the daily rates for Ocean View Villa in December"
- "What are the current rate settings for my Miami property?"
- "Calculate total cost for 5 nights at the Penthouse Suite for 2 adults with fees"
- "Update rates for property 123, room type 456 to $200/night from Dec 23-30"

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

## Architecture

The server uses a modular architecture with clear separation of concerns:

- **Registry Pattern**: Central registries manage all tools and resources
- **Tool Categories**: Tools organized by domain (property, booking, availability, rate, webhook, messaging)
- **Error Handling**: Centralized error processing with automatic sanitization
- **Type Safety**: Full TypeScript with Zod validation schemas
- **Module Size**: Each module is under 250 lines for maintainability

See [Modular Architecture Documentation](docs/MODULAR_ARCHITECTURE.md) for detailed information.

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
