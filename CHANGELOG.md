# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.1.24] - 2025-11-06

### Added

- **Stateful HTTP Session Management**: Implemented official MCP SDK stateful session pattern with per-session server instances and event stores for session resumability
- **Session Reconnection Support**: InMemoryEventStore enables clients to reconnect and resume existing sessions after disconnection
- **CORS Support**: Full CORS middleware implementation with proper header exposure (`mcp-session-id`, `last-event-id`) for browser-based MCP clients
- **Session Lifecycle Management**: Comprehensive session cleanup with configurable timeout management (30-minute default) and proper resource disposal

### Changed

- **HTTP Server Architecture**: Refactored HTTP transport to use per-session McpServer instances following official MCP SDK patterns
- **Docker Configuration**: Simplified `docker-compose.yml` with streamlined HTTP server setup
- **Server Setup Module**: Exported `createMcpServer` function for better modularity and reusability
- **Dependencies**: Added `cors` (^2.8.5) and `@types/cors` (^2.8.19) for browser client support

### Technical Details

- Implemented official MCP stateful session pattern with isolated server instances per HTTP session
- Added InMemoryEventStore for session persistence and reconnection capabilities
- Enhanced CORS middleware with proper preflight handling and header exposure for browser compatibility
- Improved session cleanup mechanism with 30-minute timeout and graceful resource disposal
- Enhanced error handling and logging throughout HTTP transport layer
- Maintained full backward compatibility with existing MCP stdio transport
- All 218 existing tests passing with new HTTP session management features

## [0.1.23] - 2025-10-10

### Added

- **Enhanced GitHub Releases**: Automated changelog extraction system that includes version-specific changes directly in GitHub release bodies
- **Changelog Extraction Script**: New `scripts/extract-changelog.sh` utility for extracting version-specific sections from CHANGELOG.md
- **Configurable Timeout for Vacant Inventory**: Added `timeoutSeconds` parameter to `lodgify_list_vacant_inventory` tool (default: 180s, min: 30s, max: 600s) for better control over long-running availability operations

### Changed

- **GitHub Release Workflow**: Enhanced `.github/workflows/release.yml` to automatically extract and display changelog content in release bodies instead of just linking to CHANGELOG.md
- **Release Body Format**: Improved GitHub release notes with structured sections, emoji icons, and comprehensive installation instructions
- **Documentation**: Updated tool documentation with timeout configuration guidance and usage examples for vacant inventory operations

### Technical Details

- Implemented AWK-based changelog parsing script with version-specific section extraction
- Enhanced release workflow with changelog extraction step and multiline output handling
- Added timeout parameter validation with min/max constraints to vacant inventory tool schema
- Improved GitHub release presentation with formatted markdown, code blocks, and resource links
- Maintained backward compatibility with all existing MCP tools and API endpoints

## [0.1.22] - 2025-09-22

### Added

- **HTTP Bridge Server**: Introduced a new HTTP bridge server mode for better containerization and deployment flexibility
- **Docker Support**: Added dual Docker configurations with Dockerfile.mcp for MCP server and Dockerfile.http for HTTP bridge server
- **Enhanced Test Suite**: Comprehensive unit tests for response builder utilities, suggestion generator, and summary generator with 100+ new test cases
- **Type Guards**: New type guard utilities for safer runtime type checking of API responses

### Changed

- **Response Enhancement**: Improved MCP response system with better structured metadata and utilities for all tool operations
- **Tool Catalog Documentation**: Significantly expanded documentation with detailed enhanced response format examples and entity-specific details
- **Messaging Tools**: Refactored messaging endpoints to align with actual Lodgify API capabilities, removing non-functional endpoints
- **Entity Extractors**: Refined entity extraction logic for better handling of booking, property, and rate data

### Fixed

- **PR Review Feedback**: Addressed all review comments for the enhanced MCP response system
- **Messaging API**: Removed non-functional messaging endpoints and aligned with actual API capabilities
- **DeepWiki Badge**: Fixed broken badge link in README documentation

### Technical Details

- Added 528 test cases for response builder covering success/error scenarios and entity extraction
- Added 245 test cases for suggestion generator with context-aware recommendations
- Added 310 test cases for summary generator with human-readable output formatting
- Improved test server with proper mocking and response handling
- Enhanced type safety with new type guard functions for API response validation

## [0.1.21] - 2025-09-19

### Added

- **Comprehensive Response Enhancement System**: Complete utility system for enhancing MCP tool responses with structured metadata, summaries, suggestions, and warnings
- **Vacant Inventory Support**: Added comprehensive `extractVacantInventoryDetails` function for enhanced entity extraction from vacant inventory responses
- **Automated Version Management**: Added `scripts/bump-version.js` for streamlined version bumping with validation and changelog management
- **Enhanced Error Type System**: New `LodgifyApiError` interface and `LodgifyErrorCode` enum for improved error categorization
- **Example Documentation**: Added practical example usage file for list-vacant-inventory tool demonstrating various use cases

### Changed

- **Response Architecture**: Enhanced response system with modular utilities including `ResponseBuilder`, `SummaryGenerator`, `SuggestionGenerator`, and entity extractors
- **Error Handling Architecture**: Improved error handling with dual format support (API and legacy), enhanced type detection, and better error mapping functions
- **Health Check & Diagnostics**: Enhanced health check functionality in orchestrator with better diagnostic reporting, API call tracking, and issue identification
- **Response Builder**: Expanded response builder to handle vacant inventory data extraction with comprehensive metadata and statistics
- **Developer Experience**: Updated GitHub Copilot instructions for better AI-assisted development guidance

### Fixed

- **Type Safety**: Resolved 75+ TypeScript type errors and 6 lint warnings across response enhancement utilities
- **Test Failures**: Fixed failing integration tests for vacant inventory list operation with correct operation types and summaries
- **Entity Extraction**: Corrected entity extraction logic for proper handling of null/undefined data and numeric ID conversions

### Technical Details

- Added error validation functions `isLodgifyApiError`, `isLodgifyError`, and `mapApiErrorToLegacy` for robust error processing
- Enhanced TypeScript type safety across bookings, properties, and rates modules with proper type casting patterns
- Created comprehensive test suites: 25 tests for ResponseBuilder, 24 for SuggestionGenerator, 42 for SummaryGenerator, 52 integration tests
- Improved test coverage with 189+ additional lines covering response enhancement and vacant inventory features
- Better integration test coverage for list-vacant-inventory tool with comprehensive edge case handling
- Upgraded error handler backward compatibility with proper type checking and format conversion
- Implemented flexible interface patterns supporting both `EnhanceOptions` and `FlexibleBuilderOptions` for backward compatibility

## [0.1.20] - 2025-09-19

### Added

- **Enhanced Response System**: Complete overhaul of response handling with new modular utility system including response builders, validators, and formatters
- **Internationalization (i18n)**: Added multi-language support for validation messages (English, Spanish, French) with centralized resource management
- **Advanced Date Handling**: New date validation and formatting utilities with comprehensive ISO 8601 support and relative date calculation
- **Currency Formatting**: Professional currency display utilities supporting multiple locales and formats
- **Entity Extraction**: Smart extraction of IDs, names, and metadata from API responses
- **Suggestion Generation**: Intelligent context-aware suggestions for user guidance based on API responses
- **Summary Generation**: Automatic generation of human-readable summaries from complex API data
- **JSON Sanitization**: Enhanced data sanitization for secure response handling
- **GitHub Copilot Instructions**: Added `.github/copilot-instructions.md` for AI-assisted development guidance

### Changed

- **Response Architecture**: Refactored response enhancement from single module to modular system (`src/mcp/utils/response/`) with specialized components
- **Booking Tools**: Enhanced with response builders, validation, and improved error messages with actionable suggestions
- **Date Validation**: Significantly enhanced date validator with 580+ lines of comprehensive validation logic and i18n support
- **Test Coverage**: Expanded test suite with 800+ new test lines covering response enhancement, i18n, and edge cases
- **Documentation**: Added DeepWiki badge to README for improved visibility

### Removed

- **Example Files**: Removed outdated example files (`check-availability.js`, `create-quote.js`, `handle-errors.js`, `list-properties.js`) in favor of documentation

### Technical Details

- Introduced modular response system with `builder.ts`, `validators.ts`, `types.ts`, and `index.ts` for better separation of concerns
- Added comprehensive i18n system with resource bundles and translation support across 3 languages
- Enhanced date utilities relocated to `src/mcp/utils/date/` with specialized modules for formatting and validation
- New utility modules: `entity-extractors.ts`, `suggestion-generator.ts`, `summary-generator.ts`, `currency-formatter.ts`
- Added 1000+ lines of new test coverage including response enhancement, i18n resources, and ISO 8601 edge cases
- Improved type safety with dedicated TypeScript types for response structures

## [0.1.19] - 2025-09-17

### Added

- **Enhanced API Response Handling**: New response enhancer utility functions that provide improved formatting, validation, and processing of API responses across all MCP tools
- **Comprehensive Test Coverage**: Added extensive unit tests for the new response enhancement functionality

### Changed

- **Booking Tools Enhancement**: Improved response handling for booking operations with better data structure formatting and enhanced validation
- **Messaging Tools Enhancement**: Enhanced message thread handling with improved response formatting and metadata extraction
- **Rate Tools Enhancement**: Improved rate response processing with better data normalization and validation
- **Webhook Tools Enhancement**: Enhanced webhook subscription responses with clearer formatting and improved error messages
- **API Client Improvements**: Enhanced v1 bookings client with better response handling and improved error reporting

### Technical Details

- Introduced centralized response enhancement module (`src/mcp/utils/response-enhancer.ts`) with 665+ lines of utility functions
- Added 310+ lines of comprehensive test coverage for response enhancement functionality
- Improved consistency across all tool responses with standardized formatting patterns
- Enhanced data validation and type safety across API responses
- Better separation of concerns with dedicated response processing utilities

## [0.1.18] - 2025-09-14

### Fixed

- **Fixed `lodgify_list_vacant_inventory` availability detection**: The tool now correctly identifies unavailable properties when the Lodgify API returns `available: 0`. Previously, all properties were incorrectly reported as available regardless of their actual availability status.
- **Improved API response handling**: The tool now properly handles the array response structure returned by the Lodgify availability API, extracting the periods data correctly.

### Technical Details

- Fixed parsing of availability API responses which return an array structure rather than an object
- Added comprehensive test coverage for vacant inventory functionality
- Optimized API calls by skipping individual room availability checks when a property is unavailable at the property level

## [0.1.17] - 2025-09-09

### Changed

- **Consolidated Availability Tools**: Refactored and consolidated availability tools into a single modular implementation for improved maintainability and reduced code duplication
- Simplified availability API client architecture  
- Enhanced property helper tools with improved search functionality

### Technical Details

- Removed redundant availability tool implementations, reducing codebase by ~1,000 lines
- Streamlined date validation utilities
- Improved test coverage for availability functionality
- Updated documentation to reflect simplified availability tool architecture

## [0.1.16] - 2025-09-06

### Technical Details

- Maintenance release to trigger CI/CD pipeline
- Version bump with no code changes
- All tests passing and build successful

## [0.1.15] - 2025-09-06

### Changed

- Enhanced booking tools documentation with clearer stay filter options and use case examples
- Improved code formatting consistency in booking tool handlers

### Technical Details

- Updated `lodgify_list_bookings` tool description with comprehensive stay filter explanations
- Added common use case scenarios for different stay filter options (Upcoming, Current, Historic, etc.)
- Minor code formatting improvements for better readability

## [0.1.14] - 2025-09-06

### Changed

- Updated @biomejs/biome dependency from 2.2.0 to 2.2.3 for improved linting and formatting capabilities
- Removed obsolete package-lock.json in favor of Bun's bun.lock for more consistent dependency management

### Technical Details

- Cleaned up dependency files to maintain consistency with Bun-first development approach
- Minor maintenance release focused on tooling improvements

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
