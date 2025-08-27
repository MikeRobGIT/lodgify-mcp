# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.2.9] - 2025-08-27

### Added
- cspell configuration for comprehensive spell checking with project-specific word list
- New "check" script in package.json for combined code quality checks (linting, type checking, formatting, building, and testing)
- Additional badges in README.md for CI status, npm downloads, bundle size, and Node.js compatibility
- Comprehensive check command documentation in `.claude/commands/check.md`
- Version synchronization script (`scripts/sync-version.js`) for maintaining version consistency

### Changed  
- Enhanced project scripts and documentation to improve development workflow
- Streamlined command structure by removing outdated clear subtask commands
- Improved project visibility with enhanced README badges and metadata

### Technical Details
- Major refactoring of server architecture with improved modularization
- Enhanced test coverage and test infrastructure
- Updated type definitions and error handling
- Improved code organization and documentation

## [0.2.6] - 2025-08-25

### Fixed
- Fixed npx execution failure with ES modules by adding bin wrapper script
- Resolved duplicate main function execution issue
- Server now starts correctly when invoked via `npx -y lodgify-mcp@0.2.6`

### Changed
- Created `bin/lodgify-mcp.js` wrapper for proper npx compatibility
- Updated package.json bin field to point to wrapper instead of ES module directly
- Export main function from server.ts for wrapper to import
- Modified entry point detection to prevent double execution

### Technical Details
- The wrapper script uses dynamic import to load the ES module server
- Entry point detection now excludes node_modules paths to prevent wrapper conflicts
- All tests updated to work with new lazy initialization pattern

## [0.2.5] - 2025-08-25

### Fixed
- Initial attempt to fix npx execution with bin wrapper (had duplicate execution issue)

## [0.2.4] - 2025-08-25

### Fixed
- Critical fix: Server no longer exits on invalid/missing API key
- Implemented lazy client initialization to ensure MCP server always starts
- Environment validation errors are now properly reported via JSON-RPC instead of console
- Server provides graceful error messages when API key is invalid or missing

### Changed
- API client is now initialized only when first tool is called, not at server startup
- Environment validation provides fallback configuration to allow server to start

## [0.2.3] - 2025-08-24

### Fixed
- Fixed MCP protocol compatibility by suppressing dotenv console output with `quiet: true`
- Resolved stdio interference that prevented proper JSON-RPC communication

## [0.2.2] - 2025-08-24

### Fixed
- Added `-y` flag to npx/bunx commands in MCP configuration for auto-confirmation
- Build script now ensures dist/server.js has executable permissions
- Added `prepare` script to automatically build on install

### Changed
- Aligned package configuration with official MCP server best practices

## [0.2.1] - 2025-08-24

### Changed
- Prioritized Bun runtime in all scripts and documentation
- Updated package.json scripts to use `bun` commands instead of `npm`
- Updated README to show Bun installation methods first (`bunx` instead of `npx`)
- Improved MCP configuration examples with Bun-first approach

### Fixed
- Package naming issue in MCP configuration (correct package name is `lodgify-mcp`)

## [0.2.0] - 2025-08-24

### Added
- NPM package publication support
- Improved documentation for NPM users
- Package metadata and author information
- npm badges in README
- publishConfig for npm registry

### Changed
- Restructured README to prioritize NPM installation
- Updated .npmignore to exclude development files
- Simplified installation instructions
- Moved Docker/MCPO content to alternative methods section

### Technical
- Added proper npm publish configuration
- Optimized package size for npm distribution
- Enhanced package.json with complete metadata

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
