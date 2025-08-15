# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.1.0] - 2025-08-14

### Added
- Initial release of Lodgify MCP Server
- Support for 15 Lodgify Public API v2 endpoints as MCP tools:
  - Property Management: list, get, list rooms, list deleted
  - Booking Management: list, get, payment links, key codes
  - Availability: property and room availability checks
  - Rates: daily rates and rate settings
  - Quotes: complex quote generation with bracket notation support
  - Messaging: thread retrieval
- Automatic retry logic with exponential backoff for 429 rate limiting
- Support for complex query parameters using bracket notation
- Type-safe validation using Zod schemas
- Comprehensive error handling with structured error responses
- Health check resource at `lodgify://health`
- Configurable logging with multiple log levels
- Full TypeScript support with strict mode
- Comprehensive test suite using Vitest
- Example scripts demonstrating key workflows
- Support for both Node.js 18+ and Bun 1.0+

### Features
- **Rate Limiting**: Automatic retry with exponential backoff (max 5 attempts)
- **Query Parameters**: Full support for Lodgify's bracket notation in parameters
- **Error Handling**: Structured error responses with status codes and details
- **Logging**: Configurable log levels (error, warn, info, debug)
- **Environment**: Support for `.env` configuration
- **Testing**: Unit tests, integration tests, and smoke tests
- **Documentation**: Comprehensive README with tool catalog and examples

### Technical Details
- Built with TypeScript and ES modules
- Uses @modelcontextprotocol/sdk for MCP implementation
- Zod for runtime type validation
- Biome for linting and formatting
- Vitest for testing framework
- Supports stdio transport for MCP communication

### Known Limitations
- Maximum retry delay capped at 30 seconds
- Requires API key with appropriate permissions
- Some endpoints may require specific Lodgify account features

### Security
- API keys stored in environment variables
- No sensitive data logging
- Supports secure secret management for production

## [Unreleased]

### Planned Features
- Support for additional Lodgify API endpoints
- Webhook support for real-time updates
- Batch operations for improved performance
- Caching layer for frequently accessed data
- Advanced filtering and search capabilities

---

For more information, see the [README](README.md) or visit the [GitHub repository](https://github.com/mikerobgit/lodgify-mcp).
