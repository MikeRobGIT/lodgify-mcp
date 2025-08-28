# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a Model Context Protocol (MCP) server that exposes Lodgify Public API v2 endpoints as MCP tools, enabling AI assistants to interact with Lodgify's property management system programmatically.

## Core Architecture

### Technology Stack
- **Runtime**: Bun ≥ 1.0 (or Node.js ≥ 18)
- **Language**: TypeScript
- **Protocol**: MCP over stdio
- **SDK**: @modelcontextprotocol/sdk
- **Validation**: Zod schemas
- **HTTP Client**: Native fetch with custom retry logic

### Key Components

1. **MCP Server** (`src/server.ts`)
   - Registers all Lodgify tools with the MCP SDK
   - Handles tool invocations and resource queries
   - Manages stdio communication with MCP clients

2. **Lodgify Orchestrator** (`src/lodgify-orchestrator.ts`)
   - Unified API for all Lodgify endpoints (v1 and v2)
   - Centralized authentication and configuration
   - Read-only mode support for operational safety
   - Health monitoring and status reporting

3. **Core Modules** (`src/core/`)
   - HTTP client (`src/core/http/`) with retry and rate limiting
   - Error handling (`src/core/errors/`) with structured error types
   - Rate limiter (`src/core/rate-limiter/`) with sliding window implementation
   - Retry logic (`src/core/retry/`) with exponential backoff

4. **API Modules** (`src/api/v1/`, `src/api/v2/`)
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

When implementing new Lodgify tools, follow this pattern:

1. **Tool Registration** in `server.ts`:
   - Define Zod schema for input validation
   - Register tool with descriptive name and description
   - Map to appropriate Lodgify client method

2. **Client Method** in `lodgify.ts`:
   - Build URL with path parameters
   - Pass query parameters through bracket notation flattener
   - Handle response and errors consistently

3. **Error Handling**:
   - Return structured errors with status, path, and details
   - Preserve Lodgify error payloads when available
   - Apply retry logic only for 429 responses

## Testing Strategy

- **Unit Tests**: Focus on HTTP client retry logic, query flattening, error formatting
- **Integration Tests**: Mock or live test each tool with sample inputs
- **Contract Tests**: Validate tool outputs against expected shapes
- **Smoke Tests**: Sequential execution of all tools with test credentials

## MCP Tool Catalog

The server implements these Lodgify v2 endpoints as MCP tools:

### Properties
- `lodgify.list_properties` - GET /v2/properties
- `lodgify.get_property` - GET /v2/properties/{id}
- `lodgify.list_property_rooms` - GET /v2/properties/{id}/rooms
- `lodgify.list_deleted_properties` - GET /v2/deletedProperties

### Rates
- `lodgify.daily_rates` - GET /v2/rates/calendar
- `lodgify.rate_settings` - GET /v2/rates/settings

### Bookings
- `lodgify.list_bookings` - GET /v2/reservations/bookings
- `lodgify.get_booking` - GET /v2/reservations/bookings/{id}
- `lodgify.get_booking_payment_link` - GET /v2/reservations/bookings/{id}/quote/paymentLink
- `lodgify.create_booking_payment_link` - POST /v2/reservations/bookings/{id}/quote/paymentLink
- `lodgify.update_key_codes` - PUT /v2/reservations/bookings/{id}/keyCodes

### Availability
- `lodgify.availability_room` - GET /v2/availability/{propertyId}/{roomTypeId}
- `lodgify.availability_property` - GET /v2/availability/{propertyId}

### Quotes & Messaging
- `lodgify.get_quote` - GET /v2/quote/{propertyId}
- `lodgify.get_thread` - GET /v2/messaging/{threadGuid}

### Resources
- `lodgify://health` - Health check resource

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
3) If using an MCP client (e.g., Claude or VS Code), restart the MCP session after code changes. Hot-reload is not supported.
4) For CLI testing, re-run `bin/lodgify-mcp.js` after each change.

## Task Master AI Instructions

**Import Task Master's development workflow commands and guidelines, treat as if import is in the main CLAUDE.md file.**
@./.taskmaster/CLAUDE.md
- The owner of the repository is mikerobgit. the repository name is lodgify-mcp