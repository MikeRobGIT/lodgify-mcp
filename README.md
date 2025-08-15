# Lodgify MCP Server

A Model Context Protocol (MCP) server that exposes Lodgify Public API v2 endpoints as tools for AI assistants like Claude. Built using the high-level McpServer SDK with enhanced metadata, capabilities declaration, and robust error handling.

## Features

- 🔧 **28+ Lodgify API endpoints** exposed as MCP tools with enhanced metadata
- 🚀 **High-level McpServer SDK** with automatic schema validation and JSON-RPC compliance
- 🎯 **Enhanced tool metadata** with clear titles, descriptions, and input schema annotations
- 📡 **Explicit capability declaration** for MCP handshake and discovery
- 🔄 **Automatic retry logic** with exponential backoff for rate limiting (429 responses)
- 📝 **Complex parameter support** including bracket notation for nested objects
- ✅ **Type-safe validation** using Zod schemas with automatic input validation
- 🛡️ **Robust JSON-RPC error handling** with structured error codes and messages
- 🔕 **Notification debouncing** to reduce client noise from rapid events
- 🏥 **Health check resource** for connectivity verification
- 📂 **File-based logging** that doesn't interfere with STDIO transport
- 🔒 **Security-focused** with automatic credential sanitization in logs

## Architecture

This server is built using the **high-level McpServer SDK** which provides:

### ✨ Enhanced MCP Features
- **Automatic Schema Validation**: Input parameters are validated against Zod schemas before reaching tool handlers
- **JSON-RPC Compliance**: All errors are properly formatted with standard JSON-RPC error codes
- **Enhanced Metadata**: Tools include comprehensive metadata (titles, descriptions, input annotations) for better LLM integration
- **Capability Declaration**: Server explicitly advertises supported features during MCP handshake
- **Notification Management**: Built-in debouncing reduces noise from rapid notification events

### 🔧 Tool Enhancement Features
- **Helper Tools**: Smart availability checkers that analyze bookings for more accurate results
- **Input Validation**: Comprehensive parameter validation with descriptive error messages
- **Error Context**: Structured error responses preserve full context for debugging
- **Safety Annotations**: Destructive operations are clearly marked with appropriate warnings

### 📂 Logging Architecture
- **File-Based Logging**: All logs written to `logs/lodgify-mcp-YYYY-MM-DD.log` to prevent STDIO interference
- **Security-First**: API keys and sensitive headers automatically redacted from all log outputs
- **Structured Format**: JSON-formatted logs with timestamps, levels, and contextual data
- **Debug Support**: Optional HTTP request/response debugging with `DEBUG_HTTP=1`

## Prerequisites

- Node.js 18+ or Bun 1.0+
- Lodgify API key (obtain from your Lodgify account)
- MCP-compatible client (e.g., Claude Desktop)

## Installation

### Using Docker (Recommended)

The easiest way to run the Lodgify MCP Server is using Docker:

```bash
# Quick start with Docker
docker run -p 3000:3000 \
  -e LODGIFY_API_KEY="your_api_key_here" \
  ghcr.io/mikerobgit/lodgify-mcp:latest
```

### Using Docker Compose

For development and production deployments:

```bash
# Clone the repository
git clone https://github.com/mikerobgit/lodgify-mcp
cd lodgify-mcp

# Setup environment
cp .env.example .env
# Edit .env and add your LODGIFY_API_KEY

# Development mode (with hot reload)
docker-compose --profile dev up

# Production mode
docker-compose --profile production up -d

# View logs
docker-compose logs -f lodgify-mcp
```

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

### Docker MCP Configuration

To connect Claude Desktop to the Dockerized MCP server:

```json
{
  "mcpServers": {
    "lodgify-docker": {
      "command": "docker",
      "args": [
        "run",
        "--rm",
        "-i",
        "-e", "LODGIFY_API_KEY=your_api_key_here",
        "-e", "LOG_LEVEL=info",
        "ghcr.io/mikerobgit/lodgify-mcp:latest"
      ]
    }
  }
}
```

Or with a locally built image:

```json
{
  "mcpServers": {
    "lodgify-docker": {
      "command": "docker",
      "args": [
        "run",
        "--rm",
        "-i",
        "--env-file", "/absolute/path/to/.env",
        "lodgify-mcp:latest"
      ]
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

#### `lodgify.update_property_availability`
Update availability settings for a property.

**Parameters:**
- `propertyId` (required): Property ID
- `payload` (required): Availability update details
  - `from`: Start date (YYYY-MM-DD)
  - `to`: End date (YYYY-MM-DD)
  - `available`: Availability status (boolean)
  - `minStay`: Minimum stay requirement (optional)
  - `maxStay`: Maximum stay limit (optional)

**Example:**
```javascript
{
  "propertyId": "prop-123",
  "payload": {
    "from": "2025-12-20",
    "to": "2025-12-31",
    "available": false,
    "minStay": 3
  }
}
```

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

#### `lodgify.create_booking`
Create a new booking in the system.

**Parameters:**
- `payload` (required): Booking details
  - `propertyId`: Property ID
  - `from`: Start date (YYYY-MM-DD)
  - `to`: End date (YYYY-MM-DD)
  - `guestBreakdown`: Guest breakdown object
    - `adults`: Number of adults (required)
    - `children`: Number of children (optional)
    - `infants`: Number of infants (optional)
  - `roomTypes`: Array of room type objects
    - `id`: Room type ID
    - `quantity`: Number of rooms (optional)

**Example:**
```javascript
{
  "payload": {
    "propertyId": "prop-123",
    "from": "2025-12-01",
    "to": "2025-12-07",
    "guestBreakdown": {
      "adults": 2,
      "children": 1
    },
    "roomTypes": [
      {
        "id": "room-456",
        "quantity": 1
      }
    ]
  }
}
```

#### `lodgify.update_booking`
Update an existing booking.

**Parameters:**
- `id` (required): Booking ID
- `payload` (required): Updated booking details
  - `status`: Booking status (optional)
  - `from`: New start date (optional)
  - `to`: New end date (optional)
  - `guestBreakdown`: Updated guest breakdown (optional)

**Example:**
```javascript
{
  "id": "book-789",
  "payload": {
    "status": "confirmed",
    "guestBreakdown": {
      "adults": 3,
      "children": 0
    }
  }
}
```

#### `lodgify.delete_booking`
Delete or cancel a booking.

**Parameters:**
- `id` (required): Booking ID

**Example:**
```javascript
{
  "id": "book-789"
}
```

### Availability & Rates

#### ✨ **Recommended Availability Tools**

#### `lodgify.check_next_availability`
**Best for: "When is this property next available?"**

Find the next available date for a property by analyzing bookings.

**Parameters:**
- `propertyId` (required): Property ID
- `fromDate` (optional): Start date to check from (YYYY-MM-DD, defaults to today)
- `daysToCheck` (optional): Number of days to check ahead (1-365, defaults to 90)

**Example:**
```javascript
{
  "propertyId": "435707",
  "fromDate": "2025-08-14",
  "daysToCheck": 30
}
```

**Response:**
```json
{
  "nextAvailableDate": "2025-08-19",
  "availableUntil": "2025-09-13", 
  "blockedPeriods": [
    {
      "arrival": "2025-08-16",
      "departure": "2025-08-18",
      "status": "Booked",
      "isBlocked": true
    }
  ],
  "totalDaysAvailable": 25,
  "message": "Available from 2025-08-19 to 2025-09-13 (25 days)"
}
```

#### `lodgify.check_date_range_availability`
**Best for: "Are these specific dates available?"**

Check if a specific date range is available for booking.

**Parameters:**
- `propertyId` (required): Property ID
- `checkInDate` (required): Check-in date (YYYY-MM-DD)
- `checkOutDate` (required): Check-out date (YYYY-MM-DD)

**Example:**
```javascript
{
  "propertyId": "435707",
  "checkInDate": "2025-08-20",
  "checkOutDate": "2025-08-25"
}
```

**Response:**
```json
{
  "isAvailable": true,
  "conflictingBookings": [],
  "message": "Available for 5 nights from 2025-08-20 to 2025-08-25"
}
```

#### `lodgify.get_availability_calendar`
**Best for: "Show me a calendar view of availability"**

Get a calendar view showing available and blocked dates.

**Parameters:**
- `propertyId` (required): Property ID
- `fromDate` (optional): Start date (YYYY-MM-DD, defaults to today)
- `daysToShow` (optional): Number of days to show (1-90, defaults to 30)

**Example:**
```javascript
{
  "propertyId": "435707",
  "fromDate": "2025-08-14",
  "daysToShow": 14
}
```

**Response:**
```json
{
  "calendar": [
    {
      "date": "2025-08-14",
      "isAvailable": false,
      "bookingStatus": "Tentative",
      "isToday": true
    },
    {
      "date": "2025-08-15",
      "isAvailable": true,
      "isToday": false
    }
  ],
  "summary": {
    "totalDays": 14,
    "availableDays": 10,
    "blockedDays": 4,
    "availabilityRate": 71
  }
}
```

#### **Raw API Availability Tools**

#### `lodgify.availability_property`
Get raw availability data for an entire property (advanced use).

**Parameters:**
- `propertyId` (required): Property ID
- `params` (optional): Query parameters
  - `from`: Start date (YYYY-MM-DD)
  - `to`: End date (YYYY-MM-DD)

**Note:** Returns technical availability data. For easier availability checking, use the recommended tools above.

#### `lodgify.availability_room`
Get raw availability data for a specific room type (advanced use).

**Parameters:**
- `propertyId` (required): Property ID
- `roomTypeId` (required): Room Type ID
- `params` (optional): Query parameters
  - `from`: Start date (YYYY-MM-DD)
  - `to`: End date (YYYY-MM-DD)

**Note:** Returns technical availability data. For easier availability checking, use the recommended tools above.

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

#### `lodgify.create_rate`
Create or update rates for a property.

**Parameters:**
- `payload` (required): Rate details
  - `propertyId`: Property ID
  - `roomTypeId`: Room type ID
  - `from`: Start date (YYYY-MM-DD)
  - `to`: End date (YYYY-MM-DD)
  - `rate`: Rate amount (positive number)
  - `currency`: Currency code (optional, 3 characters)

**Example:**
```javascript
{
  "payload": {
    "propertyId": "prop-123",
    "roomTypeId": "room-456",
    "from": "2025-12-01",
    "to": "2025-12-31",
    "rate": 150.00,
    "currency": "USD"
  }
}
```

#### `lodgify.update_rate`
Update a specific rate.

**Parameters:**
- `id` (required): Rate ID
- `payload` (required): Updated rate details
  - `rate`: New rate amount (optional)
  - `currency`: Currency code (optional)
  - `from`: New start date (optional)
  - `to`: New end date (optional)

**Example:**
```javascript
{
  "id": "rate-789",
  "payload": {
    "rate": 175.00,
    "currency": "EUR"
  }
}
```

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

### Webhook Management

#### `lodgify.subscribe_webhook`
Subscribe to a webhook event to receive notifications.

**Parameters:**
- `payload` (required): Webhook subscription details
  - `event`: Event name to subscribe to
  - `targetUrl`: URL where webhook notifications will be sent

**Example:**
```javascript
{
  "payload": {
    "event": "booking.created",
    "targetUrl": "https://your-app.com/webhooks/lodgify"
  }
}
```

#### `lodgify.list_webhooks`
List all active webhook subscriptions.

**Parameters:**
- `params` (optional): Query parameters for filtering
  - `page`: Page number
  - `limit`: Results per page

**Example:**
```javascript
{
  "params": {
    "page": 1,
    "limit": 10
  }
}
```

#### `lodgify.delete_webhook`
Unsubscribe from a webhook event.

**Parameters:**
- `id` (required): Webhook ID

**Example:**
```javascript
{
  "id": "webhook-123"
}
```

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

The server implements **JSON-RPC compliant error handling** with the high-level McpServer SDK:

### JSON-RPC Error Structure
All errors follow the standard JSON-RPC 2.0 error format:
```json
{
  "code": -32602,
  "message": "Invalid parameters: Missing required field 'id'",
  "data": {
    "originalError": "ValidationError",
    "details": "Property ID is required for this operation"
  }
}
```

### Error Code Mapping
- **-32700**: Parse Error (malformed JSON)
- **-32600**: Invalid Request (missing required fields)
- **-32601**: Method Not Found (unknown tool)
- **-32602**: Invalid Params (validation failures, missing required parameters)
- **-32603**: Internal Error (API failures, server errors, network issues)

### Lodgify API Error Handling
The server automatically maps Lodgify API errors to appropriate JSON-RPC codes:

#### Rate Limiting (429)
- **Behavior**: Automatic retry with exponential backoff
- **Respects**: `Retry-After` header if present
- **Limits**: Maximum 5 retry attempts, 30-second max delay
- **Error Code**: `-32603` (Internal Error) if max retries exceeded

#### Common Lodgify API Responses
- **400 Bad Request** → `-32602` Invalid Params
- **401 Unauthorized** → `-32603` Internal Error (check API key)
- **403 Forbidden** → `-32603` Internal Error (insufficient permissions)
- **404 Not Found** → `-32603` Internal Error (resource doesn't exist)
- **500 Internal Server Error** → `-32603` Internal Error

### Enhanced Error Context
Errors include full context for debugging:
```json
{
  "code": -32603,
  "message": "API Error: Lodgify 404: Property not found",
  "data": {
    "status": 404,
    "path": "/v2/properties/invalid-id",
    "method": "GET",
    "lodgifyError": {
      "code": "PROPERTY_NOT_FOUND",
      "message": "The specified property does not exist"
    }
  }
}
```

### Validation Error Examples
Input validation provides clear, actionable error messages:
```json
{
  "code": -32602,
  "message": "Invalid parameters",
  "data": {
    "validationErrors": [
      "Property ID must be a non-empty string",
      "Check-in date must be in YYYY-MM-DD format",
      "Check-out date must be after check-in date"
    ]
  }
}
```

## Development

### Docker Development

#### Building the Image

```bash
# Build for local development
docker build -t lodgify-mcp:latest .

# Build with specific port
docker build --build-arg PORT=8080 -t lodgify-mcp:latest .

# Multi-platform build (for M1 Macs and Linux)
docker buildx build --platform linux/amd64,linux/arm64 -t lodgify-mcp:latest .
```

#### Running Containers

```bash
# Run with environment file
docker run -p 3000:3000 --env-file .env lodgify-mcp:latest

# Run with individual environment variables
docker run -p 3000:3000 \
  -e LODGIFY_API_KEY="your_api_key" \
  -e LOG_LEVEL=debug \
  -e DEBUG_HTTP=1 \
  lodgify-mcp:latest

# Run in detached mode with auto-restart
docker run -d \
  --name lodgify-mcp \
  --restart unless-stopped \
  -p 3000:3000 \
  --env-file .env \
  lodgify-mcp:latest

# Check container health
docker inspect --format='{{.State.Health.Status}}' lodgify-mcp

# View container logs
docker logs -f lodgify-mcp
```

#### Docker Compose Commands

```bash
# Start development environment
docker-compose --profile dev up

# Start production environment
docker-compose --profile production up -d

# Rebuild and start
docker-compose --profile dev up --build

# Stop all services
docker-compose down

# Remove volumes and networks
docker-compose down -v

# View service logs
docker-compose logs -f lodgify-mcp-dev

# Execute commands in running container
docker-compose exec lodgify-mcp-dev sh

# Check service health
docker-compose ps
```

#### Debugging Docker Issues

```bash
# Check environment variables
docker run --rm lodgify-mcp:latest env

# Run with shell for debugging
docker run -it --entrypoint sh lodgify-mcp:latest

# Validate environment before starting
docker run --rm --env-file .env lodgify-mcp:latest /app/scripts/env-check.sh

# Check container resource usage
docker stats lodgify-mcp

# Inspect image layers
docker history lodgify-mcp:latest
```

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

### Logging and Debugging

#### Log File Location
- **File**: `logs/lodgify-mcp-YYYY-MM-DD.log` (created automatically)
- **Format**: Structured JSON with timestamps, levels, and context
- **Security**: API keys and sensitive data automatically redacted

#### Log Levels
Set `LOG_LEVEL` environment variable:
- `error`: Only critical errors
- `warn`: Warnings and errors
- `info`: General operational messages (default)
- `debug`: Detailed debugging information

#### HTTP Debugging
Enable detailed request/response logging:
```bash
export DEBUG_HTTP=1
```
This logs full HTTP requests and responses (with sensitive data redacted).

#### Example Log Analysis
```bash
# View recent errors
tail -f logs/lodgify-mcp-$(date +%Y-%m-%d).log | grep '"level":"error"'

# Monitor API calls
tail -f logs/lodgify-mcp-$(date +%Y-%m-%d).log | grep '"http"'

# Check server startup
head -20 logs/lodgify-mcp-$(date +%Y-%m-%d).log
```

### Common Issues

#### "LODGIFY_API_KEY environment variable is required"
- **Check**: Ensure your `.env` file exists and contains a valid API key
- **Verify**: API key is not wrapped in extra quotes
- **Debug**: Check log file for specific validation errors

#### JSON-RPC Error Responses
All errors now follow JSON-RPC 2.0 format. Check the `code` field:
- **-32602**: Invalid parameters (check your input data)
- **-32603**: Internal/API error (check API key, connectivity, Lodgify service status)

#### 401 Unauthorized Errors
- **Verify**: API key is correct and active in your Lodgify account
- **Check**: API key permissions in your Lodgify account settings
- **Debug**: Look for "401" errors in log files with full context

#### 429 Rate Limiting
- **Automatic**: Server automatically retries with exponential backoff
- **Monitor**: Check logs for "Max retries exceeded" messages
- **Action**: Consider reducing request frequency if consistently hitting limits

#### Connection Errors
- **Verify**: Internet connectivity to `https://api.lodgify.com`
- **Check**: Firewall/proxy settings
- **Debug**: Look for "Request failed" messages in logs with network details

#### MCP Client Not Finding Tools
- **Verify**: Server is running (check for "started successfully" in logs)
- **Check**: MCP configuration path is absolute
- **Action**: Restart your MCP client after configuration changes
- **Debug**: Look for startup errors or tool registration failures in logs

#### STDIO Transport Issues
- **File Logging**: All output goes to log files, not console, preventing STDIO interference
- **No Console Output**: This is expected - all logging is file-based for MCP compatibility
- **Monitor**: Use `tail -f logs/lodgify-mcp-$(date +%Y-%m-%d).log` to monitor in real-time

#### Availability Queries Issues
- **Raw availability returns "0001-01-01" dates**: This is expected. Use the new helper tools instead:
  - `lodgify_check_next_availability` for finding next available dates
  - `lodgify_check_date_range_availability` for checking specific dates
  - `lodgify_get_availability_calendar` for calendar views
- **Unexpected availability results**: The helper tools analyze actual bookings to determine availability, providing more accurate results than the raw API
- **Date format errors**: Always use YYYY-MM-DD format for dates (e.g., "2025-08-14")

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## License

MIT License - see LICENSE file for details

## Support

For issues and questions:
- GitHub Issues: [Report bugs or request features](https://github.com/mikerobgit/lodgify-mcp/issues)
- Lodgify API Documentation: [https://docs.lodgify.com](https://docs.lodgify.com)
- MCP Documentation: [https://modelcontextprotocol.io](https://modelcontextprotocol.io)

## Changelog

See [CHANGELOG.md](CHANGELOG.md) for version history and release notes.