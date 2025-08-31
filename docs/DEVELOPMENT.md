# Development Guide

This guide covers development setup, testing, and contributing to the Lodgify MCP Server.

## Prerequisites

- **Bun** ≥ 1.0 (recommended) or **Node.js** ≥ 18
- **TypeScript** knowledge
- **Lodgify API key** for testing

## Development Setup

### 1. Clone and Install

```bash
# Clone the repository
git clone https://github.com/mikerobgit/lodgify-mcp
cd lodgify-mcp

# Install dependencies
bun install  # or npm install
```

### 2. Environment Configuration

```bash
# Setup environment
cp .env.example .env
```

Edit `.env` and configure:

```env
# Required
LODGIFY_API_KEY="your_lodgify_api_key_here"

# Optional Development Settings
LOG_LEVEL="debug"           # Options: error | warn | info | debug
DEBUG_HTTP="1"              # Set to "1" for verbose HTTP debugging
LODGIFY_READ_ONLY="1"       # Set to "1" to prevent write operations during development
```

### 3. Build and Run

```bash
# Build the project
bun run build  # or npm run build

# Run the server
bun start  # or npm start

# Development mode (with hot reload)
bun dev  # or npm run dev
```

## Development Commands

### Core Commands

```bash
# Development
bun dev              # Run TypeScript directly with hot reload
bun run build        # Compile TypeScript to dist/
bun start            # Run compiled server from dist/

# Quality Checks
bun test             # Run unit tests
bun test --watch     # Run tests in watch mode
bun test --coverage  # Run tests with coverage report
bun run lint         # Run ESLint
bun run typecheck    # Run TypeScript type checking
bun run format       # Format code with Prettier
```

### Testing Commands

```bash
# Run all tests
bun test

# Run with coverage
bun test --coverage

# Watch mode for development
bun test --watch

# Run specific test file
bun test src/core/http/http-client.test.ts

# Debug tests
bun test --inspect-brk
```

## Testing Strategy

### Unit Tests
- Focus on HTTP client retry logic
- Query parameter flattening
- Error formatting and sanitization
- Rate limiting behavior
- Date validation feedback system
- Feedback object generation and formatting

### Integration Tests
- Mock or live test each tool with sample inputs
- Validate tool outputs against expected shapes
- Test error handling paths

### Contract Tests
- Validate tool outputs match MCP specifications
- Ensure Zod schemas correctly validate inputs/outputs

### Smoke Tests
- Sequential execution of all tools with test credentials
- Health check validation
- End-to-end MCP communication

## Architecture Overview

The codebase follows a modular architecture:

```
src/
├── server.ts                    # MCP server entry point
├── mcp/                         # MCP-specific modules
│   ├── tools/                   # Tool implementations by category
│   ├── resources/               # Resource implementations
│   ├── errors/                  # Error handling
│   ├── schemas/                 # Zod validation schemas
│   └── utils/                   # Utilities (date validation, types)
├── core/                        # Core functionality
│   ├── http/                    # HTTP client with retry logic
│   ├── errors/                  # Error types
│   ├── rate-limiter/           # Rate limiting
│   └── retry/                   # Retry logic
├── api/                         # API client modules
│   ├── v1/                      # Lodgify API v1 clients
│   └── v2/                      # Lodgify API v2 clients
└── lodgify-orchestrator.ts     # Unified API orchestrator
```

### Key Patterns

1. **Registry Pattern**: Central registries manage all tools and resources
2. **Tool Categories**: Tools organized by domain (property, booking, availability, etc.)
3. **Error Handling**: Centralized error processing with automatic sanitization
4. **Type Safety**: Full TypeScript with Zod validation schemas
5. **Date Validation**: Feedback-based validation system with LLM self-correction support
6. **Module Size**: Each module under 250 lines for maintainability

## Code Quality Standards

### TypeScript Configuration
- Strict mode enabled
- No implicit any
- Strict null checks
- All imports must be typed

### Testing Requirements
- Unit test coverage target: ≥90% for client code
- Integration tests for all MCP tools
- Error path testing required

### Code Style
- ESLint configuration enforced
- Prettier for code formatting
- Clear separation between MCP server and HTTP client layers

## Tool Implementation Pattern

When adding new Lodgify tools:

### 1. Tool Module Creation
Create in appropriate category file (`src/mcp/tools/[category]-tools.ts`):

```typescript
import { z } from 'zod'
import { DateStringSchema } from '../schemas/common.js'
import { createValidator, ToolCategory } from '../utils/date-validator.js'
import type { ToolRegistration } from '../types'

// Define Zod schema for input validation
const MyToolSchema = z.object({
  id: z.string().describe('Property ID'),
  startDate: DateStringSchema.describe('Start date (YYYY-MM-DD)'),
  endDate: DateStringSchema.describe('End date (YYYY-MM-DD)'),
  // ... other parameters
})

// Create tool registration
export const myTool: ToolRegistration = {
  name: 'lodgify_my_tool',
  category: 'Property Management',
  config: {
    description: 'Description of what this tool does',
    inputSchema: MyToolSchema
  },
  handler: async (args) => {
    // Validate dates if tool uses date parameters
    const validator = createValidator(ToolCategory.AVAILABILITY)
    const rangeValidation = validator.validateDateRange(args.startDate, args.endDate)
    
    // Check for validation errors
    if (!rangeValidation.start.isValid || !rangeValidation.end.isValid) {
      throw new Error(`Date validation failed: ${rangeValidation.start.error || rangeValidation.end.error}`)
    }
    
    // Include feedback info if available
    let dateValidationInfo = null
    if (rangeValidation.start.feedback || rangeValidation.end.feedback) {
      dateValidationInfo = {
        dateValidation: {
          startDate: {
            original: rangeValidation.start.originalDate,
            validated: rangeValidation.start.validatedDate,
            feedback: rangeValidation.start.feedback
          },
          endDate: {
            original: rangeValidation.end.originalDate,
            validated: rangeValidation.end.validatedDate,
            feedback: rangeValidation.end.feedback
          },
          message: '⚠️ Date validation feedback available'
        }
      }
    }
    
    const client = getClient()
    // Destructure out any passed dates so they can’t sneak through
    const { startDate: _sd, endDate: _ed, ...rest } = args
    const result = await client.myMethod({
      ...rest,
      startDate: rangeValidation.start.validatedDate,
      endDate: rangeValidation.end.validatedDate,
    })

    // Include feedback in response (namespaced)
    return dateValidationInfo ? { ...result, ...dateValidationInfo } : result
  }
}
```

### 2. Registry Integration
Add to `src/mcp/tools/register-all.ts`:

```typescript
import { myTool } from './property-tools'

export function registerPropertyTools() {
  return [
    // ... existing tools
    myTool,
  ]
}
```

### 3. Client Method
Add to `lodgify-orchestrator.ts`:

```typescript
async myMethod(params: MyParams): Promise<MyResponse> {
  const url = `${this.baseUrl}/v2/my-endpoint/${params.id}`
  const queryParams = this.flattenQueryParams(params.query || {})
  
  return this.httpClient.get(url, { params: queryParams })
}
```

### 4. Tests
Create corresponding test files:

```typescript
describe('myTool', () => {
  it('should validate input parameters', () => {
    // Test Zod validation
  })

  it('should handle API responses correctly', () => {
    // Test tool handler
  })

  it('should handle errors gracefully', () => {
    // Test error scenarios
  })

  it('should provide date validation feedback', () => {
    // Test date validation with feedback
  })

  it('should handle LLM cutoff detection', () => {
    // Test 2024 date detection and feedback
  })
})
```

## Debugging

### MCP Server Debugging

1. Stop any running server (Ctrl+C)
2. Restart with debug logging:
   ```bash
   LOG_LEVEL=debug DEBUG_HTTP=1 bun dev
   ```
3. For MCP client testing, restart the client after code changes
4. Use CLI testing: `bin/lodgify-mcp.js` for quick validation

### Common Debug Scenarios

- **Connection Issues**: Check MCP client configuration
- **API Errors**: Enable `DEBUG_HTTP=1` for request/response logging  
- **Type Errors**: Run `bun run typecheck` for detailed TypeScript errors
- **Tool Failures**: Check input validation with Zod schemas

### Debugging Tools

```bash
# TypeScript compiler with watch
tsc --watch

# Node.js inspector
node --inspect-brk dist/server.js

# Bun inspector
bun --inspect server.ts
```

## Performance Optimization

### HTTP Client Optimization
- Connection pooling enabled
- Automatic retry with exponential backoff
- Rate limiting with sliding window
- Request/response compression

### Memory Management
- Streaming for large responses
- Connection cleanup
- Garbage collection optimization

## Security Considerations

### API Key Management
- Never log raw API keys
- Use environment variables only
- Implement key rotation procedures

### Data Sanitization
- Mask PII fields in error messages
- Remove sensitive data from logs
- Validate all inputs with Zod schemas

### Error Handling
- Never expose internal system details
- Structured error responses only
- Security headers in responses

## Contributing Guidelines

### Before Submitting

1. Run the full test suite: `bun test`
2. Check linting: `bun run lint`
3. Verify types: `bun run typecheck`
4. Format code: `bun run format`
5. Update documentation if needed

### Pull Request Process

1. Fork the repository
2. Create feature branch: `git checkout -b feature/amazing-feature`
3. Make changes with tests
4. Commit: `git commit -m 'Add amazing feature'`
5. Push: `git push origin feature/amazing-feature`
6. Open Pull Request with description

### Commit Message Format

```
type(scope): description

- feat: new feature
- fix: bug fix
- docs: documentation
- style: formatting
- refactor: code restructure
- test: testing
- chore: maintenance
```

## Release Process

### Version Bumping

```bash
# Patch version (bug fixes)
npm version patch

# Minor version (new features)
npm version minor

# Major version (breaking changes)
npm version major
```

### Publishing

```bash
# Build and test
bun run build
bun test

# Publish to npm
npm publish
```

## Support

For development questions:

- **GitHub Issues**: [Technical questions and bug reports](https://github.com/mikerobgit/lodgify-mcp/issues)
- **Discussions**: [General development discussion](https://github.com/mikerobgit/lodgify-mcp/discussions)
- **Documentation**: [API reference and guides](https://docs.lodgify.com)