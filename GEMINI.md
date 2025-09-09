# GEMINI.md

This file provides guidance to Gemini Code Assist when working with code in this repository.

## Project Overview

This is a Model Context Protocol (MCP) server that exposes Lodgify Public API v2 endpoints as MCP tools, enabling AI assistants to interact with Lodgify's property management system programmatically.

## Core Architecture

### Technology Stack

- Runtime: Bun ≥ 1.0 (or Node.js ≥ 18)
- Language: TypeScript
- Protocol: MCP over stdio
- SDK: @modelcontextprotocol/sdk
- Validation: Zod schemas
- HTTP Client: Native fetch with custom retry logic

### Key Components

1. MCP Server (`src/server.ts`)
   - Minimal entry point that initializes the modular MCP server
   - Coordinates server setup and starts the stdio transport
   - Delegates all functionality to modular components

2. MCP Modules (`src/mcp/`)
   - Registry Pattern: Central registries for tools and resources
   - Tool Modules (`src/mcp/tools/`): Organized by category (property, booking, availability, rate, webhook, messaging)
   - Resource Modules (`src/mcp/resources/`): Health check and system monitoring
   - Error Handling (`src/mcp/errors/`): Centralized error processing and sanitization
   - Server Setup (`src/mcp/server-setup.ts`): Server initialization and configuration
   - Schemas (`src/mcp/schemas/`): Shared Zod validation schemas
   - Utils (`src/mcp/utils/`): TypeScript types and interfaces

3. Lodgify Orchestrator (`src/lodgify-orchestrator.ts`)
   - Unified API for all Lodgify endpoints (v1 and v2)
   - Centralized authentication and configuration
   - Read-only mode support for operational safety
   - Health monitoring and status reporting

4. Core Modules (`src/core/`)
   - HTTP client (`src/core/http/`) with retry and rate limiting
   - Error handling (`src/core/errors/`) with structured error types
   - Rate limiter (`src/core/rate-limiter/`) with sliding window implementation
   - Retry logic (`src/core/retry/`) with exponential backoff

5. API Modules (`src/api/v1/`, `src/api/v2/`)
   - Modular API client implementations
   - TypeScript interfaces for all endpoints
   - Specialized clients for bookings, properties, rates, webhooks, etc.

## Development Commands

```bash
# Initial setup
bun install
cp .env.example .env  # Configure LODGIFY_API_KEY

# Development
bun dev              # Run TypeScript directly (Bun has built-in TS support)
bun run build        # Compile TypeScript to dist/
bun test             # Run unit tests
bun test --watch     # Run tests in watch mode
bun run lint         # Run ESLint
bun run typecheck    # Run TypeScript type checking

# Production
bun start            # Run compiled server from dist/
```

## Environment Configuration

Required environment variables in `.env`:

- `LODGIFY_API_KEY`: Your Lodgify API key (required)
- `LOG_LEVEL`: Logging level (error|warn|info|debug, default: info)
- `DEBUG_HTTP`: Set to "1" for verbose HTTP debugging (optional)

## Tool Implementation Pattern

When implementing new Lodgify tools, follow this modular pattern:

1. Tool Module Creation in appropriate category file (`src/mcp/tools/[category]-tools.ts`):
   - Define Zod schema for input validation
   - Create tool registration object with name, category, config, and handler
   - Use closure-based `getClient()` to access the Lodgify orchestrator
   - Export tool registration for the registry

2. Registry Integration in `src/mcp/tools/register-all.ts`:
   - Import the new tool module
   - Add tool to the appropriate category registration
   - Tools are automatically registered when server starts

3. Client Method in `lodgify-orchestrator.ts`:
   - Build URL with path parameters
   - Pass query parameters through bracket notation flattener
   - Handle response and errors consistently

4. Error Handling:
   - Errors are automatically processed through centralized error handler
   - Sanitization removes sensitive data before returning to user
   - McpError codes are applied based on error type

## Testing Strategy

- Unit Tests: Focus on HTTP client retry logic, query flattening, error formatting
- Integration Tests: Mock or live test each tool with sample inputs
- Contract Tests: Validate tool outputs against expected shapes
- Smoke Tests: Sequential execution of all tools with test credentials

## MCP Tool Catalog

For a complete reference of all available Lodgify MCP tools with detailed parameters and examples, see:
**[@docs/TOOL_CATALOG.md](./docs/TOOL_CATALOG.md)**

### Tool Categories Summary

The server implements 30+ MCP tools across these categories:

- **Property Management** - List, get, search properties and rooms
- **Booking & Reservation** - Full CRUD operations for bookings, check-in/out, payment links
- **Rates & Pricing** - View and update rates, get pricing quotes
- **Availability** - Check property availability for date ranges
- **Messaging** - Thread management for guest communications
- **Webhooks** - Event subscription management
- **Resources** - Health check and system status

## Query Parameter Handling

The client supports bracket notation for complex nested parameters:

```javascript
// Example: roomTypes[0].Id=123&guest_breakdown[adults]=2
params = {
  "roomTypes[0].Id": 123,
  "guest_breakdown[adults]": 2
}
```

## Rate Limiting Strategy

1. Detect 429 responses
2. Check for `Retry-After` header (use if present)
3. Otherwise use exponential backoff: 2^attempt seconds (max 30s)
4. Maximum 5 retry attempts
5. Log retry attempts with timing information

## Security Considerations

- API keys are loaded from environment variables only
- Never log raw API keys or sensitive data
- Mask PII fields in error messages and logs
- Use structured logging with appropriate levels
- Document key rotation procedures in README

## Code Quality Standards

- All tools must have Zod validation schemas
- TypeScript strict mode enabled
- Comprehensive error handling with typed errors
- Unit test coverage target: ≥90% for client code
- Integration tests for all MCP tools
- Clear separation between MCP server and HTTP client layers

## Debugging

When testing the MCP server during development:

1) Stop the currently running server process (Ctrl+C).
2) Restart locally via:
   - `bun dev` (hot re-run) or
   - `bun run build && bun start` (from `dist/`).
3) If using an MCP client (e.g., Gemini or VS Code), restart the MCP session after code changes. Hot-reload is not supported.
4) For CLI testing, re-run `node dist/server.js` after each change.

## Task Master AI Instructions

Import Task Master's development workflow commands and guidelines, treat as if import is in the main GEMINI.md file.
