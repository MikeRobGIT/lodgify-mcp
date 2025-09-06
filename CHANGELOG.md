# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.1.13] - 2025-09-06

### Added

- **AI Assistant System Prompts**: Comprehensive system prompts for hotel employee and front desk assistants
- Enhanced availability client capabilities with improved booking calendar functionality

### Changed

- Updated Biome configuration from schema version 1.9.4 to 1.9.0 for better compatibility
- Improved availability client implementation with enhanced type safety and functionality
- Enhanced test coverage for availability features with more comprehensive scenarios

### Technical Details

- Added two detailed system prompts (517 and 318 lines) for hospitality AI assistant implementations
- Refactored availability client with improved architecture and helper methods
- Enhanced availability testing with extended test cases and edge case coverage
- Updated package-lock.json with latest dependency resolutions

## [0.1.12] - 2025-09-05

### Added

- **HTTP Transport Server**: New `server-http.ts` for HTTP-based MCP communication alongside existing stdio transport
- Docker HTTP server deployment with dedicated Dockerfile.http and docker-compose.yml configuration
- Comprehensive environment checking with `scripts/env-check.sh` for Docker deployments
- Enhanced availability client with helper methods for next available date and calendar views
- Docker override support for development environments (docker-compose.override.yml)

### Changed

- Enhanced availability types with comprehensive booking calendar interfaces
- Updated installation documentation with HTTP server deployment options
- Improved Docker entrypoint script with environment validation and startup modes
- Extended package.json with HTTP server scripts for both development and production
- Updated bump-version command documentation with detailed release process

### Technical Details

- Added Express.js dependency for HTTP server implementation
- Enhanced logger configuration for better debugging capabilities
- Improved availability testing with comprehensive date utilities
- Updated .gitignore to handle Docker-related temporary files
- Enhanced Docker deployment workflow with multi-transport support

## [0.1.11] - 2025-09-03

### Changed

- Enhanced tool descriptions with example requests and responses for better developer experience
- Refactored tool schemas: Inlined Zod schemas directly in tool modules for improved maintainability
- Improved code formatting of Zod schemas in booking tools for better readability

### Technical Details

- Consolidated validation schemas within each tool module (availability, booking, rate, webhook tools)
- Removed obsolete API key entries from .env.example
- Code refactoring focused on schema organization without functional changes

## [0.1.10] - 2025-09-03

### Changed

- **Enhanced Error Handling**: All 35 MCP tool handlers now use comprehensive error wrapping for consistent error reporting
- Improved error serialization to prevent "[object Object]" from appearing in error responses
- Better handling of LodgifyError objects with detailed error messages including status codes and API details
- Enhanced debugging information when DEBUG_HTTP environment variable is enabled

### Technical Details

- Applied `wrapToolHandler` utility consistently across all tool modules (property, availability, booking, rate, webhook, messaging)
- Added proper HTTP status code mapping to MCP error codes for better error categorization
- Improved error context preservation with tool names and additional error metadata
- Removed obsolete test files (test-booking.js, test-refactored.js) that were no longer in use

## [0.1.9] - 2025-09-03

### Changed

- **Breaking**: Removed obsolete `bin/` directory and consolidated server executable to `dist/server.js`
- Updated CLI testing commands from `bin/lodgify-mcp.js` to `node dist/server.js` across all documentation
- Streamlined package.json bin configuration to use `dist/server.js` directly

### Technical Details

- Removed 19-line redundant `bin/lodgify-mcp.js` wrapper script
- Updated CI/CD workflows to remove bin directory references
- Modified server entry point to always run main function when executed as bin script
- Enhanced server startup consistency for bunx, npx, and direct execution
- Cleaned up Docker and workflow configurations to align with new structure

## [0.1.8] - 2025-01-02

### Fixed

- **Critical**: Resolved production MCP server startup issues that prevented the server from running via npx/bunx
- Fixed dotenv library output interfering with MCP's JSON communication protocol
- Fixed ES module import handling in bin script for better error recovery

### Technical Details

- Suppressed dotenv console output by temporarily overriding console.log during config() call
- Enhanced bin/lodgify-mcp.js with proper ES module dynamic import and error handling
- Prevents "[dotenv@17.x.x] injecting env..." messages from breaking MCP JSON protocol

## [0.1.7] - 2025-09-02

### Fixed

- Resolved GitHub Packages publishing failure due to scope mismatch
- Package now publishes to GitHub Packages as @MikeRobGIT/lodgify-mcp

### Technical Details

- Workflow temporarily renames package scope for GitHub Packages compatibility
- Maintains @mikerob scope for npm registry
- Added GitHub Packages installation instructions to release notes

## [0.1.6] - 2025-09-02

### Fixed

- Fixed GitHub Packages publishing in release workflow
- Resolved scope mismatch between npm package name (@mikerob) and GitHub owner (MikeRobGIT)

### Technical Details

- Configure explicit .npmrc for @mikerob scope mapping to GitHub Packages
- Remove incorrect scope parameter from Node.js setup in workflow
- Add proper authentication token setup for GitHub Packages registry

## [0.1.5] - 2025-09-02

### Changed

- Simplified CI/CD pipeline by removing redundant npm-publish workflow
- Now using only tag-based release workflow for more intentional releases

### Technical Details

- Removed npm-publish.yml workflow to prevent duplicate publishing attempts
- Enforces git tag-based releases as the single source of truth

## [0.1.4] - 2025-09-02

### Fixed

- Fixed "main is not a function" error in production MCP server by exporting main function from server.ts
- Resolved npx/bunx execution issues for global installations

### Changed

- Enhanced response schemas with consistent object structure formatting
- Updated custom quote tool description to clarify limitations
- Improved documentation and configuration files

### Technical Details

- Added main function export to support bin script execution
- Streamlined Lodgify MCP entry point
- Updated GitHub Actions workflows for improved CI/CD

## [0.1.3] - 2025-09-01

### Changed

- Updated bump-version command documentation for improved workflow

### Technical Details

- Minor version bump for maintenance and documentation updates

## [0.1.2] - 2025-08-31

### Added

- Intelligent date validation feedback system with contextual error messages
- Enhanced environment configuration for read-only mode
- Improved logging for read-only mode operations

### Changed

- Enhanced README.md for improved clarity and usability
- Updated Docker publish workflow to trigger on version tags
- Improved documentation and refactored server setup

### Fixed

- Cleaned up formatting in date validation utility

### Technical Details

- Removed .taskmaster from git tracking and added to .gitignore
- Updated bump-version command documentation for better workflow

## [0.1.1] - 2025-08-31

### Added

- Complete modular architecture refactoring of server.ts
- Registry pattern for centralized tool and resource management
- 15+ focused modules, each under 250 lines for maintainability
- Closure-based dependency injection via `getClient()` pattern
- Tool deprecation system for graceful API evolution
- Comprehensive documentation updates reflecting new architecture
- New `docs/MODULAR_ARCHITECTURE.md` with detailed architecture documentation

### Changed

- Refactored monolithic 2600+ line server.ts into modular components
- Organized tools by category (property, booking, availability, rate, webhook, messaging)
- Centralized error handling with automatic sanitization
- Improved type safety with proper TypeScript types throughout
- Updated CLAUDE.md and AGENTS.md with new module structure
- Enhanced README.md with architecture section

### Technical Details

- Zero breaking changes - all public APIs remain unchanged
- 228 tests passing with complete backward compatibility
- All TypeScript and lint warnings resolved
- Documentation fully updated to reflect modular architecture

## [0.1.0] - 2025-08-31

### Added

- Comprehensive read-only mode enforcement to prevent unauthorized write operations
- Environment variable normalization for boolean values (DEBUG_HTTP, LODGIFY_READ_ONLY)
- Enhanced logging for environment variable flow in server initialization
- Improved NPM beta workflow with better error handling and authentication verification
- NPM publish dry-run validation before actual publish
- First-time package publishing support in GitHub workflows

### Changed

- Updated package name to @mikerob/lodgify-mcp (scoped package)
- Enhanced GitHub workflows to handle scoped package publishing
- Improved error capture in workflows using tee and PIPESTATUS
- Adjusted default rate limits from 100 to 60 requests per window

### Fixed

- NPM scripts interference with version command (removed custom version/postversion scripts)
- GitHub workflow authentication issues with NPM_TOKEN
- Package name preservation during npm version operations
- Rate limit adjustments for better API abuse prevention

### Security

- Read-only mode implementation blocking all write requests when enabled
- Enhanced environment variable handling for safer configuration

## [0.0.1] - 2025-08-30

### Added

- Initial release of @mikerob/lodgify-mcp
- Model Context Protocol (MCP) server for Lodgify Public API v2
- Support for 30+ Lodgify API endpoints as MCP tools
- Comprehensive property management, booking, and availability features
- Read-only mode for operational safety
- Automatic retry logic with exponential backoff for rate limiting
- TypeScript implementation with full type safety
- Comprehensive test suite with 241 tests
- Support for both Bun and Node.js runtimes

### Features

- **Property Management**: List, get, and manage properties and rooms
- **Booking Management**: Create, update, and manage bookings with payment links
- **Availability Checking**: Real-time availability queries with calendar views
- **Rate Management**: Daily rates and rate settings management
- **Webhook Support**: Subscribe and manage webhooks for real-time updates
- **Quote Generation**: Complex quote generation with flexible parameters
- **Health Monitoring**: Built-in health check resource
- **Error Handling**: Structured error responses with detailed context
- **Logging**: Configurable file-based logging system
- **Security**: Read-only mode enforcement, API key protection

### Technical Details

- Built with @modelcontextprotocol/sdk for MCP implementation
- Uses Zod for runtime type validation
- Biome for code formatting and linting
- Vitest for testing framework
- Supports stdio transport for MCP communication
- Full TypeScript with strict mode enabled

---

For more information, see the [README](README.md) or visit the [GitHub repository](https://github.com/mikerobgit/lodgify-mcp).
