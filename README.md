# Lodgify MCP Server

A Model Context Protocol (MCP) server that exposes Lodgify Public API v2 endpoints as tools for AI assistants like Claude.

## Features

- 🔧 **15+ Lodgify API endpoints** exposed as MCP tools
- 🔄 **Automatic retry logic** with exponential backoff for rate limiting (429 responses)
- 📝 **Complex parameter support** including bracket notation for nested objects
- ✅ **Type-safe validation** using Zod schemas
- 🛡️ **Comprehensive error handling** with structured error responses
- 🏥 **Health check resource** for connectivity verification
- 📊 **Detailed logging** with configurable log levels

## Prerequisites

- Node.js 18+ or Bun 1.0+
- Lodgify API key (obtain from your Lodgify account)
- MCP-compatible client (e.g., Claude Desktop)

## Installation

### Using npm
```bash
npm install
cp .env.example .env
# Edit .env and add your LODGIFY_API_KEY
npm run build
npm start
```

### Using Bun
```bash
bun install
cp .env.example .env
# Edit .env and add your LODGIFY_API_KEY
bun run build
bun start
```

## Configuration

### Environment Variables

Create a `.env` file with the following variables:

```env
# Required
LODGIFY_API_KEY="your_lodgify_api_key_here"

# Optional
LOG_LEVEL="info"        # Options: error | warn | info | debug
DEBUG_HTTP="0"          # Set to "1" for verbose HTTP debugging
```

### Claude Desktop Configuration

Add the following to your Claude Desktop MCP settings:

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

For Bun users:
```json
{
  "mcpServers": {
    "lodgify": {
      "command": "bun",
      "args": ["run", "/absolute/path/to/lodgify-mcp/dist/server.js"],
      "env": {
        "LODGIFY_API_KEY": "your_lodgify_api_key_here"
      }
    }
  }
}
```

## Tool Catalog

### Property Management

#### `lodgify.list_properties`
List all properties with optional filtering and pagination.

**Parameters:**
- `params` (optional): Query parameters for filtering
  - `page`: Page number
  - `limit`: Results per page
  - `includeDeleted`: Include deleted properties

**Example:**
```javascript
{
  "params": {
    "page": 1,
    "limit": 10,
    "includeDeleted": false
  }
}
```

#### `lodgify.get_property`
Get detailed information about a specific property.

**Parameters:**
- `id` (required): Property ID

**Example:**
```javascript
{
  "id": "prop-123"
}
```

#### `lodgify.list_property_rooms`
List all rooms for a specific property.

**Parameters:**
- `propertyId` (required): Property ID

**Example:**
```javascript
{
  "propertyId": "prop-123"
}
```

#### `lodgify.list_deleted_properties`
List properties that have been deleted.

**Parameters:**
- `params` (optional): Query parameters for filtering

### Booking Management

#### `lodgify.list_bookings`
List bookings with optional filtering by date range, status, etc.

**Parameters:**
- `params` (optional): Query parameters
  - `from`: Start date (YYYY-MM-DD)
  - `to`: End date (YYYY-MM-DD)
  - `status`: Booking status filter

**Example:**
```javascript
{
  "params": {
    "from": "2025-11-01",
    "to": "2025-11-30",
    "status": "confirmed"
  }
}
```

#### `lodgify.get_booking`
Get details of a specific booking.

**Parameters:**
- `id` (required): Booking ID

#### `lodgify.get_booking_payment_link`
Retrieve the payment link for a booking.

**Parameters:**
- `id` (required): Booking ID

#### `lodgify.create_booking_payment_link`
Create a new payment link for a booking.

**Parameters:**
- `id` (required): Booking ID
- `payload` (required): Payment link details
  - `amount`: Payment amount
  - `currency`: Currency code

**Example:**
```javascript
{
  "id": "book-456",
  "payload": {
    "amount": 1000,
    "currency": "USD"
  }
}
```

#### `lodgify.update_key_codes`
Update key codes for a booking (for smart locks).

**Parameters:**
- `id` (required): Booking ID
- `payload` (required): Key codes data

### Availability & Rates

#### `lodgify.availability_property`
Check availability for an entire property.

**Parameters:**
- `propertyId` (required): Property ID
- `params` (optional): Query parameters
  - `from`: Start date
  - `to`: End date

#### `lodgify.availability_room`
Check availability for a specific room type.

**Parameters:**
- `propertyId` (required): Property ID
- `roomTypeId` (required): Room Type ID
- `params` (optional): Query parameters

#### `lodgify.daily_rates`
Get daily rates calendar for a property.

**Parameters:**
- `params` (required): Query parameters
  - `propertyId`: Property ID
  - `from`: Start date
  - `to`: End date

#### `lodgify.rate_settings`
Get rate configuration settings.

**Parameters:**
- `params` (required): Query parameters
  - `propertyId`: Property ID

### Quotes & Messaging

#### `lodgify.get_quote`
Generate a quote for a property stay with complex parameters.

**Parameters:**
- `propertyId` (required): Property ID
- `params` (required): Quote parameters

**Example with bracket notation:**
```javascript
{
  "propertyId": "prop-123",
  "params": {
    "from": "2025-11-20",
    "to": "2025-11-25",
    "roomTypes[0].Id": 999,
    "roomTypes[0].quantity": 1,
    "guest_breakdown[adults]": 2,
    "guest_breakdown[children]": 0,
    "currency": "USD"
  }
}
```

#### `lodgify.get_thread`
Retrieve a messaging thread.

**Parameters:**
- `threadGuid` (required): Thread GUID

### Health Check

The server provides a health check resource:
- **URI**: `lodgify://health`
- **Returns**: Server status, API configuration, and version info

## Complex Parameter Support

The server supports Lodgify's bracket notation for complex nested parameters:

```javascript
// Nested objects are automatically flattened:
{
  "guest_breakdown": {
    "adults": 2,
    "children": 1
  }
}
// Becomes: guest_breakdown[adults]=2&guest_breakdown[children]=1

// Arrays with objects:
{
  "roomTypes": [
    { "Id": 123, "quantity": 1 }
  ]
}
// Becomes: roomTypes[0][Id]=123&roomTypes[0][quantity]=1

// Pre-bracketed keys are preserved:
{
  "filters[type]": "VILLA",
  "filters[amenities][0]": "POOL"
}
```

## Error Handling

The server implements comprehensive error handling:

### Rate Limiting (429)
- Automatic retry with exponential backoff
- Respects `Retry-After` header if present
- Maximum 5 retry attempts
- Maximum delay of 30 seconds

### Error Response Format
```json
{
  "error": true,
  "message": "Lodgify 404: Not Found",
  "status": 404,
  "path": "/v2/properties/invalid-id",
  "detail": {
    "code": "PROPERTY_NOT_FOUND"
  }
}
```

### Common Error Codes
- `400`: Bad Request - Invalid parameters
- `401`: Unauthorized - Check your API key
- `403`: Forbidden - Insufficient permissions
- `404`: Not Found - Resource doesn't exist
- `429`: Too Many Requests - Rate limited (auto-retry)
- `500`: Internal Server Error

## Development

### Running Tests

Tests are written using Bun's built-in test runner.

```bash
# Run all tests
bun test

# Run with coverage
bun test --coverage

# Watch mode
bun test --watch

# Run specific test file
bun test lodgify.test.ts

# Run tests matching a pattern
bun test --test-name-pattern "429 retry"
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

### Building
```bash
# Compile TypeScript
npm run build

# Development mode (with hot reload)
npm run dev
```

## Security Best Practices

1. **API Key Storage**: Never commit API keys to version control
2. **Environment Variables**: Use `.env` files for local development only
3. **Production Deployment**: Use secure secret management systems
4. **Key Rotation**: Regularly rotate your Lodgify API keys
5. **Access Control**: Limit API key permissions to required operations only
6. **Logging**: Never log sensitive data or API keys

## Troubleshooting

### Common Issues

#### "LODGIFY_API_KEY environment variable is required"
- Ensure your `.env` file exists and contains a valid API key
- Check that the API key is not wrapped in extra quotes

#### 401 Unauthorized Errors
- Verify your API key is correct and active
- Check API key permissions in your Lodgify account

#### 429 Rate Limiting
- The server automatically retries with exponential backoff
- Consider reducing request frequency if consistently hitting limits

#### Connection Errors
- Verify internet connectivity
- Check if Lodgify API is accessible: `https://api.lodgify.com`
- Review firewall/proxy settings

#### MCP Client Not Finding Tools
- Ensure the server is running: Check process logs
- Verify MCP configuration path is absolute
- Restart your MCP client after configuration changes

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## License

MIT License - see LICENSE file for details

## Support

For issues and questions:
- GitHub Issues: [Report bugs or request features](https://github.com/yourusername/lodgify-mcp/issues)
- Lodgify API Documentation: [https://docs.lodgify.com](https://docs.lodgify.com)
- MCP Documentation: [https://modelcontextprotocol.io](https://modelcontextprotocol.io)

## Changelog

See [CHANGELOG.md](CHANGELOG.md) for version history and release notes.