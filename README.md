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

### API Key Rotation

To rotate your LODGIFY_API_KEY safely:

1. Create a new API key in your Lodgify account settings
2. Deploy the new key as `LODGIFY_API_KEY` (keep the old key valid temporarily)
3. Verify server health and tool calls are working correctly
4. Revoke the old key in Lodgify

**Tip**: For zero-downtime rotation, use a two-step rollout (staging → production) and monitor error rates during the transition.

## HTTP Transport Support (Streamable)

The MCP server now supports HTTP transport using **Streamable HTTP transport** - the modern replacement for SSE (Server-Sent Events). This enables remote connections from Claude Desktop, Anthropic Messages API, and other MCP clients over the network.

### Running the HTTP Server

```bash
# Development mode (with Bun)
bun run dev:http

# Production mode (compiled)
npm run build
npm run start:http

# With custom port and authentication
MCP_PORT=8080 MCP_TOKEN=your-secure-token-here npm run start:http
```

### HTTP Configuration

Configure the HTTP server with these environment variables:

```env
# HTTP Server Configuration
MCP_PORT="3000"                             # Port for HTTP server (default: 3000)
MCP_TOKEN="your-secure-bearer-token-here"   # Bearer token for authentication (min 16 chars)
```

**Security Note**: Always set `MCP_TOKEN` in production. Without it, the server runs in development mode with no authentication.

### Connecting via HTTP

To connect to the HTTP server from an MCP client:

1. **Initialize a session** with POST to `/mcp`:
```json
POST /mcp
Authorization: Bearer your-secure-bearer-token-here
Content-Type: application/json

{
  "jsonrpc": "2.0",
  "method": "initialize",
  "params": {
    "protocolVersion": "2025-03-26",
    "capabilities": {}
  },
  "id": 1
}
```

2. **Use the session ID** returned in the `Mcp-Session-Id` header for subsequent requests
3. **Send requests** with the session ID header:
```json
POST /mcp
Authorization: Bearer your-secure-bearer-token-here
Mcp-Session-Id: <session-id-from-initialize>
Content-Type: application/json

{
  "jsonrpc": "2.0",
  "method": "tools/list",
  "id": 2
}
```

### Available HTTP Endpoints

| Endpoint | Method | Description | Authentication |
|----------|--------|-------------|----------------|
| `/mcp` | GET/POST/DELETE | Main MCP endpoint for Streamable transport | Required |
| `/health` | GET | Health check with server status | Not required |
| `/sessions` | GET | List active sessions (admin) | Required |
| `/sessions/:id` | DELETE | Terminate a specific session (admin) | Required |

### Session Management

- Sessions are automatically created on initialization requests
- Session IDs are provided via the `Mcp-Session-Id` header
- Sessions are cleaned up automatically when connections close
- Multiple concurrent sessions are supported

### Docker Support for HTTP Mode

To run the HTTP server in Docker:

```dockerfile
# In docker-compose.yml
services:
  lodgify-mcp:
    image: lodgify-mcp:latest
    ports:
      - "3000:3000"
    environment:
      LODGIFY_API_KEY: ${LODGIFY_API_KEY}
      MCP_PORT: 3000
      MCP_TOKEN: ${MCP_TOKEN}
    command: npm run start:http
```

### Advantages of HTTP Transport

- **Remote Access**: Connect from any network location
- **Session Persistence**: Maintain state across multiple requests
- **Authentication**: Bearer token protection for secure access
- **Scalability**: Support multiple concurrent client sessions
- **Monitoring**: Health checks and session management endpoints
- **Modern Protocol**: Uses Streamable HTTP transport (replacement for SSE)

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
- **📅 Intelligent Date Validation**: Feedback-based system that helps LLMs self-correct date issues

## Intelligent Date Validation

The MCP server includes sophisticated date validation with feedback-based correction to handle LLM date cutoff issues:

### How It Works

- **Issue Detection**: Identifies when LLMs provide outdated dates (e.g., 2024 when current year is 2025)
- **Structured Feedback**: Provides detailed validation feedback instead of silent corrections
- **Context-Aware Guidance**: Different validation rules based on tool context:
  - **Availability searches**: Warns about past dates, suggests current date
  - **Booking creation**: Validates future dates with detailed suggestions
  - **Rate queries**: Allows past/future dates with appropriate context
- **Self-Correction Support**: Returns actionable suggestions for LLMs to fix issues

### Example Scenarios

1. **LLM provides outdated year**:
   - Input: `"2024-09-15"` (when current year is 2025)
   - Feedback: `{ "message": "The date '2024-09-15' appears to be from a previous year (2024). Current year is 2025.", "suggestions": ["If you meant this year, use: 2025-09-15", "Current date: 2025-08-31"], "severity": "warning" }`

2. **Past date for availability search**:
   - Input: Check availability from `"2025-08-01"` (if today is 2025-08-31)
   - Feedback: `{ "message": "The date '2025-08-01' is 30 days in the past. Availability operations typically require future dates.", "suggestions": ["Did you mean a future date?", "Today's date: 2025-08-31"], "severity": "warning" }`

3. **Invalid date range**:
   - Input: Check-in `"2025-09-20"`, Check-out `"2025-09-15"`
   - Error: `{ "message": "Invalid date range: end date '2025-09-15' is before start date '2025-09-20'.", "suggestions": ["Ensure the end date is after the start date", "Check if the dates were entered in the correct order"], "severity": "error" }`

### Validation Modes

Date validation uses different approaches per tool type:
- **HARD**: Rejects invalid dates with clear error feedback
- **SOFT**: Warns about issues but allows processing with feedback messages
- **Context-Aware**: Adapts validation rules based on business logic and tool requirements

### Feedback Structure

All validation feedback includes:
- **Message**: Human-readable description of the issue
- **Severity**: `error`, `warning`, or `info`
- **Suggestions**: Actionable steps to resolve the issue
- **Current Date**: System date for context
- **Original Input**: Exact input provided for traceability

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