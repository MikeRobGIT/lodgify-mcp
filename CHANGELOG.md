# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

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
